/**
 * Tiered image sourcing pipeline for IG posts.
 *
 * Implements a 4-tier architecture:
 *   1. Story classification (person / event / topic)
 *   2. Tiered source search (Brave → Unsplash → LoC → Wikimedia)
 *   3. Weighted multi-factor ranking
 *   4. Best candidate selection
 *
 * Tier cascade (all story types):
 *   Tier 1 — Brave Image Search (contextual, finds real editorial images)
 *   Tier 2 — Unsplash (high-quality stock, curated, proper licensing)
 *   Tier 3 — Library of Congress (archival, free, especially good for Haiti history)
 *   Tier 4 — Wikimedia Commons (last resort, variable quality)
 *
 * All tiers always run and contribute candidates. The best candidate
 * by composite score wins, regardless of which tier found it.
 */

import type { Item } from "@edlight-news/types";
import type { ImageCandidate, StoryType } from "./imageTypes.js";
import { classifyStory, extractPersonName } from "./storyClassifier.js";
import { searchLibraryOfCongress } from "./locSearch.js";
import { computeImageScore } from "./imageScoring.js";
import { detectPersonName } from "./wikidata.js";

// ── Re-export for backward compat ──────────────────────────────────────────

export type { ImageCandidate };

// ── Constants ──────────────────────────────────────────────────────────────

const UNSPLASH_API = "https://api.unsplash.com";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const UA = "EdLight-News-Worker/1.0 (tiered image pipeline; news@edlight.org)";
const MIN_WIDTH = 1200;

// ── Brave Image Search adapter ─────────────────────────────────────────────

const BRAVE_IMAGE_API = "https://api.search.brave.com/res/v1/images/search";

interface BraveImageResult {
  title: string;
  url: string;           // page URL
  thumbnail: {
    src: string;         // thumbnail URL (reliable, hosted by Brave CDN)
  };
  properties: {
    url: string;         // full-size image URL
    width?: number;
    height?: number;
  };
  source: string;        // source domain
  page_age?: string;     // ISO date
}

/**
 * Search Brave Image Search API for contextual editorial images.
 *
 * Uses the dedicated image search endpoint (not web search) which returns
 * structured results with dimensions, making it far more reliable than
 * og:image scraping.
 *
 * Free tier: 2,000 queries/month — well within our ~300/month usage.
 */
async function searchBraveImages(
  query: string,
  storyType: StoryType,
  entityName?: string,
): Promise<ImageCandidate | null> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL(BRAVE_IMAGE_API);
    url.searchParams.set("q", query);
    url.searchParams.set("count", "10");
    url.searchParams.set("safesearch", "strict");

    const res = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[braveImages] API returned ${res.status} for "${query}"`);
      return null;
    }

    const data = (await res.json()) as { results?: BraveImageResult[] };
    if (!data.results?.length) return null;

    let best: ImageCandidate | null = null;

    for (const img of data.results) {
      const w = img.properties?.width ?? 0;
      const h = img.properties?.height ?? 0;

      // Skip images below IG minimum resolution
      if (w < MIN_WIDTH) continue;

      // Skip stock photo sites — we have Unsplash for that
      const domain = (img.source ?? "").toLowerCase();
      if (/getty|shutterstock|alamy|istockphoto|depositphotos|dreamstime|123rf/i.test(domain)) continue;

      const imageUrl = img.properties?.url || img.thumbnail?.src;
      if (!imageUrl) continue;

      // Skip SVGs, PDFs
      if (/\.(svg|pdf)$/i.test(imageUrl)) continue;

      const metadata = `${img.title ?? ""} ${domain}`;
      const entityMatch = entityName
        ? metadata.toLowerCase().includes(entityName.toLowerCase())
        : false;

      const { total, breakdown } = computeImageScore({
        query,
        imageMetadata: metadata,
        storyType,
        entityMatch,
        tier: "editorial",
        captureDate: img.page_age,
        width: w,
        height: h,
        licenseStatus: "editorial_fair_use",
      });

      if (!best || total > best.score) {
        best = {
          url: imageUrl,
          source: "brave",
          tier: "editorial",
          licenseStatus: "editorial_fair_use",
          score: total,
          scoreBreakdown: breakdown,
          width: w,
          height: h,
          sourceDomain: domain,
          sourceType: "web_search",
          entityName,
          license: "Editorial Fair Use",
          sourceUrl: img.url,
          captureDate: img.page_age,
        };
      }
    }

    return best;
  } catch (err) {
    console.warn(`[braveImages] search failed for "${query}":`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Unsplash adapter (upgraded to ImageCandidate) ──────────────────────────

interface UnsplashPhoto {
  urls: { regular: string; full: string; raw: string };
  width: number;
  height: number;
  user: { name: string };
  links: { download_location: string };
  topic_submissions?: Record<string, unknown>;
  created_at?: string;
  tags?: Array<{ title: string }>;
}

async function searchUnsplashTiered(
  query: string,
  accessKey: string,
  storyType: StoryType,
  entityName?: string,
): Promise<ImageCandidate | null> {
  try {
    const url = new URL(`${UNSPLASH_API}/search/photos`);
    url.searchParams.set("query", query);
    url.searchParams.set("orientation", "portrait");
    url.searchParams.set("per_page", "8");
    url.searchParams.set("content_filter", "high");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { results: UnsplashPhoto[] };
    if (!data.results?.length) return null;

    let best: ImageCandidate | null = null;

    for (const photo of data.results) {
      if (photo.width < MIN_WIDTH) continue;

      const metadata = [
        photo.user.name,
        ...(photo.tags?.map((t) => t.title) ?? []),
        ...Object.keys(photo.topic_submissions ?? {}),
      ].join(" ");

      const entityMatch = entityName
        ? metadata.toLowerCase().includes(entityName.toLowerCase())
        : false;

      const { total, breakdown } = computeImageScore({
        query,
        imageMetadata: metadata,
        storyType,
        entityMatch,
        tier: "stock",
        captureDate: photo.created_at,
        width: photo.width,
        height: photo.height,
        licenseStatus: "cc_attribution", // Unsplash License ≈ CC-like
      });

      if (!best || total > best.score) {
        best = {
          url: photo.urls.full,
          source: "unsplash",
          tier: "stock",
          licenseStatus: "cc_attribution",
          score: total,
          scoreBreakdown: breakdown,
          width: photo.width,
          height: photo.height,
          sourceDomain: "unsplash.com",
          sourceType: "stock",
          entityName,
          author: photo.user.name,
          license: "Unsplash License",
          sourceUrl: photo.urls.regular,
          captureDate: photo.created_at,
          downloadLocation: photo.links.download_location,
        };
      }
    }

    return best;
  } catch {
    return null;
  }
}

// ── Wikimedia Commons adapter (upgraded to ImageCandidate) ──────────────────

type CommonsImageInfo = {
  thumburl?: string;
  url?: string;
  width?: number;
  height?: number;
  extmetadata?: {
    Artist?: { value?: string };
    LicenseShortName?: { value?: string };
    DateTimeOriginal?: { value?: string };
  };
};

type CommonsPage = {
  pageid?: number;
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

const PD_LICENSES = new Set([
  "public domain", "pd", "pd-usgov", "cc0", "cc0 1.0", "cc-zero",
  "pd-old", "pd-old-70", "pd-old-100", "pd-author", "pd-self",
  "pd-usgov-military", "pd-usgov-white house", "pd-usgov-potus",
  "pd-usgov-nasa", "pd-usgov-dos", "pd-usgov-fema",
  "pd-textlogo", "pd-ineligible",
]);

const CC_LICENSES = new Set([
  "cc by 2.0", "cc by 3.0", "cc by 4.0",
  "cc-by-2.0", "cc-by-3.0", "cc-by-4.0",
  "cc by-sa 2.0", "cc by-sa 3.0", "cc by-sa 4.0",
  "cc-by-sa-2.0", "cc-by-sa-3.0", "cc-by-sa-4.0",
]);

function classifyCommonsLicense(license?: string): { status: import("./imageTypes.js").LicenseStatus; name: string } {
  if (!license) return { status: "unknown_do_not_publish", name: "Unknown" };
  const norm = license.toLowerCase().trim();
  if (PD_LICENSES.has(norm)) return { status: "safe_public_domain", name: license };
  if (CC_LICENSES.has(norm)) return { status: "cc_attribution", name: license };
  return { status: "unknown_do_not_publish", name: license };
}

async function searchCommonsTiered(
  query: string,
  storyType: StoryType,
  entityName?: string,
): Promise<ImageCandidate | null> {
  try {
    const url = new URL(COMMONS_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "8");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|extmetadata|size");
    url.searchParams.set("iiurlwidth", "2160");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
    const pages = Object.values(json.query?.pages ?? {});

    let best: ImageCandidate | null = null;

    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info) continue;

      const imageUrl = info.thumburl ?? info.url;
      if (!imageUrl) continue;
      if (/\.(svg|pdf|tiff?)$/i.test(imageUrl)) continue;

      const w = info.width ?? 0;
      const h = info.height ?? 0;
      if (w < 800) continue; // More lenient for Commons

      const rawLicense = info.extmetadata?.LicenseShortName?.value?.toLowerCase().trim();
      const { status: licenseStatus, name: licenseName } = classifyCommonsLicense(rawLicense);

      // Skip images with unknown licenses
      if (licenseStatus === "unknown_do_not_publish") continue;

      const author = info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "").trim();
      const title = p.title ?? "";

      const metadata = `${title} ${author ?? ""}`;
      const entityMatch = entityName
        ? metadata.toLowerCase().includes(entityName.toLowerCase())
        : false;

      const { total, breakdown } = computeImageScore({
        query,
        imageMetadata: metadata,
        storyType,
        entityMatch,
        tier: "archive",
        captureDate: info.extmetadata?.DateTimeOriginal?.value,
        width: w,
        height: h,
        licenseStatus,
      });

      if (!best || total > best.score) {
        best = {
          url: imageUrl,
          source: "wikimedia",
          tier: "archive",
          licenseStatus,
          score: total,
          scoreBreakdown: breakdown,
          width: w,
          height: h,
          sourceDomain: "commons.wikimedia.org",
          sourceType: "archive",
          entityName,
          author,
          license: licenseName,
          sourceUrl: p.pageid ? `https://commons.wikimedia.org/?curid=${p.pageid}` : undefined,
          captureDate: info.extmetadata?.DateTimeOriginal?.value,
        };
      }
    }

    return best;
  } catch {
    return null;
  }
}

// ── Query building ─────────────────────────────────────────────────────────

function buildSearchQueries(item: Item, storyType: StoryType, personName: string | null): string[] {
  const titleWords = (item.title ?? "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6);

  const queries: string[] = [];
  const geoHint = item.geoTag === "HT" ? "Haiti" : "";
  const isHistory = item.utilityMeta?.series === "HaitiHistory";
  const isProfile = item.utilityMeta?.series === "HaitianOfTheWeek";

  // Person-led queries
  if (personName) {
    if (storyType === "person") {
      queries.push(`${personName} official portrait`);
      queries.push(`${personName} ${geoHint}`.trim());
    }
    queries.push(personName);
    if (isProfile) queries.push(`${personName} portrait Haiti`);
    if (isHistory) queries.push(`${personName} Haiti history`);
  }

  // Event-led queries
  if (storyType === "event") {
    const titleQuery = titleWords.join(" ");
    if (titleQuery) {
      queries.push(`${titleQuery} ${geoHint}`.trim());
      if (isHistory) queries.push(`${titleQuery} history`);
    }
  }

  // Topic-led queries
  const titleQuery = [...titleWords, geoHint].filter(Boolean).join(" ").trim();
  if (titleQuery) queries.push(titleQuery);

  // Category-specific
  if ((item.category === "scholarship" || item.category === "opportunity") && item.source?.name) {
    queries.push(`${item.source.name} ${geoHint} education`.trim());
  }

  return [...new Set(queries.filter((q) => q.length >= 4))].slice(0, 5);
}

// ── Main tiered pipeline ───────────────────────────────────────────────────

/**
 * Find the best image for an item using the 4-tier sourcing strategy.
 *
 * Tier cascade (all tiers always run, best score wins):
 *   1. Brave Image Search — contextual editorial images from the web
 *   2. Unsplash — high-quality stock photography
 *   3. Library of Congress — archival, especially Haiti history
 *   4. Wikimedia Commons — last resort, variable quality
 *
 * Returns the best `ImageCandidate` above `minScore`, or null.
 */
export async function findTieredImage(
  item: Item,
  minScore = 25,
): Promise<ImageCandidate | null> {
  const storyType = classifyStory(item);
  const personName = extractPersonName(item);
  const queries = buildSearchQueries(item, storyType, personName);

  if (queries.length === 0) return null;

  console.log(
    `[tieredImageSearch] Searching for ${storyType} story: ` +
    `"${item.title?.slice(0, 50)}…" queries=[${queries.map((q) => `"${q}"`).join(", ")}]`,
  );

  // Collect candidates from ALL tiers — best score wins regardless of tier
  const candidates: ImageCandidate[] = [];

  // ── Tier 1: Brave Image Search (contextual editorial images) ───────────
  // Finds the *actual* image for the story — the real politician, the real
  // event, the real location — not a generic stock photo.
  for (const query of queries.slice(0, 2)) {
    const braveResult = await searchBraveImages(query, storyType, personName ?? undefined);
    if (braveResult) {
      candidates.push(braveResult);
      // High-score contextual hit? No need to try more queries
      if (braveResult.score >= 55) break;
    }
  }

  // ── Tier 2: Unsplash (high-quality stock fallback) ─────────────────────
  const unsplashKey = process.env.Unsplash_ACCESS_KEY;
  if (unsplashKey) {
    for (const query of queries.slice(0, 2)) {
      const unsplashResult = await searchUnsplashTiered(query, unsplashKey, storyType, personName ?? undefined);
      if (unsplashResult) {
        candidates.push(unsplashResult);
        break;
      }
    }
  }

  // ── Tier 3: Library of Congress (archival, free) ───────────────────────
  // Valuable for Haiti history, U.S. policy, disaster coverage, maps, and
  // news photography. No longer gated to historical/event content only.
  for (const query of queries.slice(0, 2)) {
    const locResult = await searchLibraryOfCongress(query, storyType, personName ?? undefined, minScore);
    if (locResult) {
      candidates.push(locResult);
      break;
    }
  }

  // ── Tier 4: Wikimedia Commons (last resort) ────────────────────────────
  // Only searched if higher tiers haven't found a strong candidate (score ≥ 50).
  // Commons images are often low-resolution, diagrams, or maps that don't
  // meet the IG editorial bar.
  const bestSoFar = candidates.reduce((max, c) => Math.max(max, c.score), 0);
  if (bestSoFar < 50) {
    for (const query of queries.slice(0, 3)) {
      const commonsResult = await searchCommonsTiered(query, storyType, personName ?? undefined);
      if (commonsResult) {
        candidates.push(commonsResult);
        if (commonsResult.score >= 55) break;
      }
    }
  }

  // ── Select the best candidate ──────────────────────────────────────────
  if (candidates.length === 0) {
    console.log(`[tieredImageSearch] ⚠️  No image found for "${item.title?.slice(0, 60)}"`);
    return null;
  }

  // Sort by score descending, pick the best
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]!;

  if (best.score < minScore) {
    console.log(
      `[tieredImageSearch] ⚠️  Best score ${best.score.toFixed(1)} below threshold ${minScore} ` +
      `for "${item.title?.slice(0, 60)}"`,
    );
    return null;
  }

  console.log(
    `[tieredImageSearch] ✅ Selected: ${best.source}/${best.tier} ` +
    `score=${best.score.toFixed(1)} license=${best.licenseStatus} ` +
    `${best.width}×${best.height}${best.author ? ` by ${best.author}` : ""}`,
  );

  // Unsplash download tracking (required by TOS)
  if (best.source === "unsplash" && best.downloadLocation && unsplashKey) {
    fetch(`${best.downloadLocation}?client_id=${unsplashKey}`, {
      method: "GET",
    }).catch(() => {/* fire-and-forget per TOS */});
  }

  return best;
}

// ── Backward-compatible wrapper ────────────────────────────────────────────

/**
 * Drop-in replacement for the old `findEditorialImage()`.
 *
 * Returns a simplified `ScoredImage`-like shape that the existing
 * `generateContextualImage()` function in `geminiImageGen.ts` expects.
 */
export async function findEditorialImageTiered(
  item: Item,
  minScore = 5,
): Promise<{ url: string; source: string; score: number; width: number; height: number; author?: string; license?: string; downloadLocation?: string } | null> {
  // Map old minScore (0-10 scale) to new scale (0-100)
  const newMinScore = Math.max(minScore * 5, 20);
  const candidate = await findTieredImage(item, newMinScore);
  if (!candidate) return null;

  return {
    url: candidate.url,
    source: candidate.source,
    score: candidate.score / 10, // Map back to old 0-10 scale for compatibility
    width: candidate.width,
    height: candidate.height,
    author: candidate.author,
    license: candidate.license,
    downloadLocation: candidate.downloadLocation,
  };
}
