/**
 * Tiered image sourcing pipeline for IG posts.
 *
 * Implements the 5-layer architecture:
 *   1. Story classification (person / event / topic)
 *   2. Tiered source search (official → editorial → archive → stock → fallback)
 *   3. Licensing gate (blocks unsafe images from auto-publishing)
 *   4. Weighted multi-factor ranking
 *   5. Best candidate selection
 *
 * Decision logic varies by story type:
 *
 *   Person-led:
 *     Wikidata portrait → Official Flickr → Wikimedia Commons → Unsplash → fallback
 *
 *   Event-led:
 *     Official Flickr → Wikimedia Commons → LoC (if historical) → Unsplash → fallback
 *
 *   Topic-led:
 *     Wikimedia Commons → LoC → Unsplash → fallback
 *
 * Replaces the flat Unsplash → Commons cascade with a smarter tiered approach
 * while maintaining backward compatibility with `findEditorialImage()`.
 */

import type { Item } from "@edlight-news/types";
import type { ImageCandidate, StoryType } from "./imageTypes.js";
import { classifyStory, extractPersonName } from "./storyClassifier.js";
import { findOfficialSources, getFlickrUserIds } from "./officialSourceRegistry.js";
import { searchFlickr } from "./flickrSearch.js";
import { searchLibraryOfCongress } from "./locSearch.js";
import { computeImageScore } from "./imageScoring.js";
import { detectPersonName } from "./wikidata.js";

// ── Re-export for backward compat ──────────────────────────────────────────

export type { ImageCandidate };

// ── Constants ──────────────────────────────────────────────────────────────

const UNSPLASH_API = "https://api.unsplash.com";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const UA = "EdLight-News-Worker/1.0 (tiered image pipeline; contact@edlight.news)";
const MIN_WIDTH = 1200;

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
    url.searchParams.set("iiurlwidth", "1280");

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
 * Find the best image for an item using the tiered sourcing strategy.
 *
 * This is the upgraded replacement for `findEditorialImage()` with:
 * - Story classification (person/event/topic)
 * - Official source registry (government Flickr accounts)
 * - Library of Congress (free historical archive)
 * - Weighted multi-factor scoring
 * - Licensing gate (blocks unsafe images)
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

  // Collect all candidates across tiers
  const candidates: ImageCandidate[] = [];

  // ── Tier 1: Official sources (Flickr government accounts) ──────────────
  const titleAndSummary = `${item.title ?? ""} ${item.summary ?? ""}`;
  const keywords = titleAndSummary.split(/\s+/).filter((w) => w.length > 3);
  const officialSources = findOfficialSources(keywords);
  const flickrUserIds = getFlickrUserIds(officialSources);

  if (flickrUserIds.length > 0) {
    for (const query of queries.slice(0, 2)) {
      const flickrResult = await searchFlickr(query, storyType, {
        officialUserIds: flickrUserIds,
        officialEntries: officialSources,
        entityName: personName ?? undefined,
        minScore,
      });
      if (flickrResult) {
        candidates.push(flickrResult);
        // Official source with high score? Short-circuit
        if (flickrResult.score >= 60) break;
      }
    }
  }

  // ── Tier 2: Wikimedia Commons (archive) ────────────────────────────────
  for (const query of queries.slice(0, 3)) {
    const commonsResult = await searchCommonsTiered(query, storyType, personName ?? undefined);
    if (commonsResult) {
      candidates.push(commonsResult);
      if (commonsResult.score >= 55) break; // Good enough from Commons
    }
  }

  // ── Tier 3: Library of Congress (historical archive, free) ─────────────
  // Especially useful for Haiti history and U.S. content
  const isHistorical = item.utilityMeta?.series === "HaitiHistory" ||
    item.utilityMeta?.series === "HaitiFactOfTheDay" ||
    /\bhistoi(?:re|rical)\b/i.test(titleAndSummary);

  if (isHistorical || storyType === "event") {
    for (const query of queries.slice(0, 2)) {
      const locResult = await searchLibraryOfCongress(query, storyType, personName ?? undefined, minScore);
      if (locResult) {
        candidates.push(locResult);
        break; // One LoC result is enough
      }
    }
  }

  // ── Tier 4: Unsplash (stock — generic fallback) ────────────────────────
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

  // ── Tier 5: Flickr broad search (CC-licensed) ─────────────────────────
  if (candidates.length === 0) {
    for (const query of queries.slice(0, 2)) {
      const flickrBroad = await searchFlickr(query, storyType, {
        entityName: personName ?? undefined,
        minScore,
      });
      if (flickrBroad) {
        candidates.push(flickrBroad);
        break;
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
