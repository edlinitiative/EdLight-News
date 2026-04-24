/**
 * Editorial image sourcing pipeline for IG posts.
 *
 * Cascade: Unsplash → Wikimedia Commons → null (caller falls back to Gemini AI)
 *
 * Each result is scored on quality criteria. The caller can set a minimum
 * threshold (default 5) to decide whether to use the image or fall through
 * to AI generation.
 *
 * Zero-cost, lightweight — no sharp/image-processing dependencies.
 */

import type { Item } from "@edlight-news/types";
import { detectPersonName } from "./wikidata.js";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ScoredImage {
  url: string;
  source: "unsplash" | "wikimedia";
  score: number;
  width: number;
  height: number;
  author?: string;
  license?: string;
  /** Unsplash download tracking URL (must be triggered per API TOS) */
  downloadLocation?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const UNSPLASH_API = "https://api.unsplash.com";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const UA = "EdLight-News-Worker/1.0 (editorial image search; news@edlight.org)";

/** Minimum width to be considered usable for 1080px IG slides */
const MIN_WIDTH = 1200;

// ── Scoring ────────────────────────────────────────────────────────────────

function scoreImage(width: number, height: number, hasPeople: boolean): number {
  let s = 0;
  if (width >= 3200) s += 7;
  else if (width >= 2400) s += 5;
  else if (width >= 1800) s += 4;
  else if (width >= MIN_WIDTH) s += 2;
  else s -= 4;
  if (width < 1500) s -= 2;
  if (hasPeople) s += 2;               // People boost engagement
  // Portrait or square orientation bonus for 4:5 IG
  if (height >= width * 0.9) s += 1;
  if (width / Math.max(height, 1) > 2.1) s -= 2;
  return s;
}

function scoreQueryMatch(query: string, haystack: string): number {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);

  if (terms.length === 0) return 0;

  const lowerHaystack = haystack.toLowerCase();
  const matches = terms.filter((term) => lowerHaystack.includes(term)).length;
  return matches / terms.length;
}

// ── Unsplash search ────────────────────────────────────────────────────────

interface UnsplashPhoto {
  urls: { regular: string; full: string; raw: string };
  width: number;
  height: number;
  user: { name: string };
  links: { download_location: string };
  /** Topic IDs for the photo */
  topic_submissions?: Record<string, unknown>;
}

async function searchUnsplash(query: string, accessKey: string): Promise<ScoredImage | null> {
  try {
    const url = new URL(`${UNSPLASH_API}/search/photos`);
    url.searchParams.set("query", query);
    url.searchParams.set("orientation", "portrait");
    url.searchParams.set("per_page", "8");
    url.searchParams.set("content_filter", "high"); // Safe content only

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    });

    if (!res.ok) {
      console.warn(`[editorialImageSearch] Unsplash API error: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as { results: UnsplashPhoto[] };
    if (!data.results?.length) return null;

    let best: ScoredImage | null = null;

    for (const photo of data.results) {
      if (photo.width < MIN_WIDTH) continue;

      // Detect people heuristic: Unsplash topic_submissions often contain "people" topics
      const hasPeople = photo.topic_submissions
        ? Object.keys(photo.topic_submissions).some((k) =>
            k.toLowerCase().includes("people") || k.toLowerCase().includes("portrait"),
          )
        : false;

      const s = scoreImage(photo.width, photo.height, hasPeople);
      const queryScore = scoreQueryMatch(query, [photo.user.name, Object.keys(photo.topic_submissions ?? {}).join(" ")].join(" "));

      if (!best || s + queryScore > best.score) {
        best = {
          url: photo.urls.full,
          source: "unsplash",
          score: s + queryScore,
          width: photo.width,
          height: photo.height,
          author: photo.user.name,
          license: "Unsplash License",
          downloadLocation: photo.links.download_location,
        };
      }
    }

    return best;
  } catch (err) {
    console.warn("[editorialImageSearch] Unsplash search failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Wikimedia Commons search ───────────────────────────────────────────────

type CommonsImageInfo = {
  thumburl?: string;
  url?: string;
  width?: number;
  height?: number;
  extmetadata?: {
    Artist?: { value?: string };
    LicenseShortName?: { value?: string };
  };
};

type CommonsPage = {
  pageid?: number;
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

const ACCEPTABLE_LICENSES = new Set([
  "public domain", "pd", "pd-usgov", "cc0", "cc0 1.0", "cc-zero",
  "cc by 2.0", "cc by 3.0", "cc by 4.0",
  "cc-by-2.0", "cc-by-3.0", "cc-by-4.0",
  "cc by-sa 2.0", "cc by-sa 3.0", "cc by-sa 4.0",
  "cc-by-sa-2.0", "cc-by-sa-3.0", "cc-by-sa-4.0",
]);

async function searchCommons(query: string): Promise<ScoredImage | null> {
  try {
    const url = new URL(COMMONS_API);
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "6");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|extmetadata|size");
    url.searchParams.set("iiurlwidth", "2160");

    const res = await fetch(url.toString(), { headers: { "User-Agent": UA } });
    if (!res.ok) return null;

    const json = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } };
    const pages = Object.values(json.query?.pages ?? {});

    let best: ScoredImage | null = null;

    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (!info) continue;

      const imageUrl = info.thumburl ?? info.url;
      if (!imageUrl) continue;
      if (/\.(svg|pdf|tiff?)$/i.test(imageUrl)) continue;

      const w = info.width ?? 0;
      const h = info.height ?? 0;
      if (w < MIN_WIDTH) continue;

      const license = info.extmetadata?.LicenseShortName?.value?.toLowerCase().trim();
      if (!license || !ACCEPTABLE_LICENSES.has(license)) continue;

      const author = info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "").trim();
      const title = p.title ?? "";
      const s = scoreImage(w, h, false) + scoreQueryMatch(query, `${title} ${author ?? ""}`);

      if (!best || s > best.score) {
        best = {
          url: imageUrl,
          source: "wikimedia",
          score: s,
          width: w,
          height: h,
          author,
          license,
        };
      }
    }

    return best;
  } catch (err) {
    console.warn("[editorialImageSearch] Commons search failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Query building ─────────────────────────────────────────────────────────

function buildSearchQueries(item: Item): string[] {
  const titleWords = (item.title ?? "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 6);

  const queries: string[] = [];
  const utilitySeries = item.utilityMeta?.series;
  const isHistorySeries =
    utilitySeries === "HaitiHistory" || utilitySeries === "HaitiFactOfTheDay";
  const isProfileSeries = utilitySeries === "HaitianOfTheWeek";
  const geoHint =
    item.geoTag === "HT" || isHistorySeries || isProfileSeries ? "Haiti" : "";
  const personName = item.entity?.personName ?? detectPersonName(item.title ?? "", item.category);

  if (personName) {
    queries.push([personName, geoHint].filter(Boolean).join(" ").trim());
    if (isProfileSeries) queries.push(`${personName} portrait ${geoHint}`.trim());
    if (isHistorySeries) queries.push(`${personName} Haiti history`.trim());
    queries.push(personName);
  }

  const titleQuery = [...titleWords, geoHint].filter(Boolean).join(" ").trim();
  if (titleQuery) queries.push(titleQuery);

  if (isHistorySeries && titleWords.length > 0) {
    queries.push([...titleWords, "Haiti", "history"].join(" "));
  }

  if ((item.category === "scholarship" || item.category === "opportunity" || item.category === "bourses") && item.source?.name) {
    queries.push(`${item.source.name} ${geoHint} education`);
  }

  return [...new Set(queries.filter((query) => query.length >= 4))].slice(0, 4);
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Search for a high-quality editorial image suitable for IG carousel backgrounds.
 *
 * Pipeline: Unsplash (portrait, 5 results) → Wikimedia Commons → null
 *
 * Returns the highest-scoring image above `minScore`, or null if nothing found.
 * The caller (geminiImageGen) decides whether to fall back to AI generation.
 */
export async function findEditorialImage(
  item: Item,
  minScore = 5,
): Promise<ScoredImage | null> {
  const queries = buildSearchQueries(item);
  if (queries.length === 0) return null;

  const unsplashKey = process.env.Unsplash_ACCESS_KEY;
  let best: ScoredImage | null = null;

  for (const query of queries) {
    console.log(`[editorialImageSearch] Searching for "${query}"...`);

    if (unsplashKey) {
      const unsplashResult = await searchUnsplash(query, unsplashKey);
      if (unsplashResult && (!best || unsplashResult.score > best.score)) {
        best = unsplashResult;
      }
      if (best && best.source === "unsplash" && best.score >= minScore + 1.5) {
        break;
      }
    }

    const commonsResult = await searchCommons(query);
    if (commonsResult && (!best || commonsResult.score > best.score)) {
      best = commonsResult;
    }
  }

  if (best && best.score >= minScore) {
    console.log(
      `[editorialImageSearch] ✅ ${best.source} hit: ${best.width}×${best.height} ` +
      `score=${best.score.toFixed(2)}${best.author ? ` by ${best.author}` : ""}`,
    );

    if (best.source === "unsplash" && best.downloadLocation && unsplashKey) {
      fetch(`${best.downloadLocation}?client_id=${unsplashKey}`, {
        method: "GET",
      }).catch(() => {/* fire-and-forget per TOS */});
    }

    return best;
  }

  console.log(`[editorialImageSearch] ⚠️  No editorial image found for "${item.title.slice(0, 60)}"`);
  return null;
}
