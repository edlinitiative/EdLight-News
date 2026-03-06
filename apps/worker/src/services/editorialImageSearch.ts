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
const UA = "EdLight-News-Worker/1.0 (editorial image search; contact@edlight.news)";

/** Minimum width to be considered usable for 1080px IG slides */
const MIN_WIDTH = 1200;

// ── Scoring ────────────────────────────────────────────────────────────────

function scoreImage(width: number, height: number, hasPeople: boolean): number {
  let s = 0;
  if (width >= 3000) s += 3;           // High-res bonus
  else if (width >= MIN_WIDTH) s += 5;  // Meets minimum
  if (width < 1500) s -= 2;            // Low-res penalty
  if (hasPeople) s += 2;               // People boost engagement
  // Portrait or square orientation bonus for 4:5 IG
  if (height >= width * 0.9) s += 1;
  return s;
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
    url.searchParams.set("per_page", "5");
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

      if (!best || s > best.score) {
        // Use 'regular' (1080w) for bandwidth, 'full' for max quality
        best = {
          url: photo.urls.regular,
          source: "unsplash",
          score: s,
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
    url.searchParams.set("iiurlwidth", "1280");

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
      const s = scoreImage(w, h, false);

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

function buildSearchQuery(item: Item): string {
  // Use first ~5 meaningful words from title
  const words = (item.title ?? "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5);

  const geoHint = item.geoTag === "HT" ? "Haiti" : "";
  return [...words, geoHint].filter(Boolean).join(" ");
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
  const query = buildSearchQuery(item);
  if (!query || query.length < 4) return null;

  console.log(`[editorialImageSearch] Searching for "${query}"...`);

  // 1. Try Unsplash
  const unsplashKey = process.env.Unsplash_ACCESS_KEY;
  if (unsplashKey) {
    const unsplashResult = await searchUnsplash(query, unsplashKey);
    if (unsplashResult && unsplashResult.score >= minScore) {
      console.log(
        `[editorialImageSearch] ✅ Unsplash hit: ${unsplashResult.width}×${unsplashResult.height} ` +
        `score=${unsplashResult.score} by ${unsplashResult.author}`,
      );

      // Trigger download tracking per Unsplash API TOS
      if (unsplashResult.downloadLocation) {
        fetch(`${unsplashResult.downloadLocation}?client_id=${unsplashKey}`, {
          method: "GET",
        }).catch(() => {/* fire-and-forget per TOS */});
      }

      return unsplashResult;
    }
  }

  // 2. Try Wikimedia Commons
  const commonsResult = await searchCommons(query);
  if (commonsResult && commonsResult.score >= minScore) {
    console.log(
      `[editorialImageSearch] ✅ Commons hit: ${commonsResult.width}×${commonsResult.height} ` +
      `score=${commonsResult.score} (${commonsResult.license})`,
    );
    return commonsResult;
  }

  console.log(`[editorialImageSearch] ⚠️  No editorial image found for "${query}"`);
  return null;
}
