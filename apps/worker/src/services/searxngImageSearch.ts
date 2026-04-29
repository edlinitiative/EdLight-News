/**
 * SearXNG image search adapter — self-hosted, free, no API key needed.
 *
 * SearXNG is a metasearch engine that aggregates results from Google, Bing,
 * DuckDuckGo, and others. It runs as a lightweight Docker container alongside
 * the worker and provides unlimited, rate-limit-free image search.
 *
 * Used as a fallback when Brave Search API is unavailable (no key, quota
 * exhausted, or API errors).
 *
 * Integration points:
 *   - tieredImagePipeline.ts → Tier 1b (after Brave, before Unsplash)
 *   - reverseImageSearch.ts  → Step 3 (after Vision + Brave)
 *   - webImageSearch.ts      → after Brave API, before Brave HTML scraping
 */

import type { ImageCandidate, StoryType } from "./imageTypes.js";
import { computeImageScore } from "./imageScoring.js";

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_WIDTH = 1200;
const MIN_WIDTH_REVERSE = 1080;
const SEARXNG_TIMEOUT_MS = 10_000;
const INTER_QUERY_DELAY_MS = 300;

/** Stock photo domains to skip (we have Unsplash for that) */
const STOCK_DOMAIN_RE = /getty|shutterstock|alamy|istockphoto|depositphotos|dreamstime|123rf/i;

// ── SearXNG response types ─────────────────────────────────────────────────

interface SearxngImageResult {
  url: string;            // page URL
  title: string;
  img_src: string;        // full-size image URL
  thumbnail_src?: string; // thumbnail URL
  resolution?: string;    // e.g. "1920 x 1080"
  source?: string;        // engine name (google, bing, etc.)
  engine?: string;
  parsed_url?: string[];
}

interface SearxngWebResult {
  url: string;
  title: string;
  content?: string;
  engine?: string;
}

interface SearxngResponse {
  results: SearxngImageResult[] | SearxngWebResult[];
  number_of_results?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getSearxngUrl(): string | null {
  return process.env.SEARXNG_URL?.replace(/\/+$/, "") || null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Parse resolution string like "1920 x 1080" into { width, height }.
 * SearXNG sometimes provides this from upstream engines.
 */
function parseResolution(res?: string): { width: number; height: number } {
  if (!res) return { width: 0, height: 0 };
  const match = res.match(/(\d+)\s*[x×]\s*(\d+)/i);
  if (!match) return { width: 0, height: 0 };
  return { width: parseInt(match[1], 10), height: parseInt(match[2], 10) };
}

/** Small delay to avoid hammering upstream engines through SearXNG */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Image Search (for tiered pipeline) ─────────────────────────────────────

/**
 * Search SearXNG for editorial images matching a query.
 *
 * Equivalent to `searchBraveImages()` — returns a single best `ImageCandidate`
 * from the image category results.
 *
 * @param query      Search query (e.g. "Ariel Henry Haiti premier ministre")
 * @param storyType  Story classification for scoring
 * @param entityName Optional entity name for relevance boosting
 * @returns Best image candidate or null
 */
export async function searchSearxngImages(
  query: string,
  storyType: StoryType,
  entityName?: string,
): Promise<ImageCandidate | null> {
  const baseUrl = getSearxngUrl();
  if (!baseUrl) return null;

  try {
    const url = new URL(`${baseUrl}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("categories", "images");
    url.searchParams.set("format", "json");
    url.searchParams.set("safesearch", "2");         // strict
    url.searchParams.set("engines", "google images,bing images,duckduckgo images");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "EdLight-News-Worker/1.0",
      },
      signal: AbortSignal.timeout(SEARXNG_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[searxngImages] API returned ${res.status} for "${query}"`);
      return null;
    }

    const data = (await res.json()) as SearxngResponse;
    const results = data.results as SearxngImageResult[];
    if (!results?.length) return null;

    let best: ImageCandidate | null = null;

    for (const img of results.slice(0, 15)) {
      const imageUrl = img.img_src;
      if (!imageUrl) continue;

      // Skip SVGs, PDFs
      if (/\.(svg|pdf)$/i.test(imageUrl)) continue;

      // Parse dimensions from resolution string
      const { width: w, height: h } = parseResolution(img.resolution);

      // Skip images below IG minimum resolution (if dimensions known)
      if (w > 0 && w < MIN_WIDTH) continue;

      // Skip stock photo sites
      const pageDomain = getDomain(img.url || "");
      const imgDomain = getDomain(imageUrl);
      if (STOCK_DOMAIN_RE.test(pageDomain) || STOCK_DOMAIN_RE.test(imgDomain)) continue;

      const metadata = `${img.title ?? ""} ${pageDomain}`;
      const entityMatch = entityName
        ? metadata.toLowerCase().includes(entityName.toLowerCase())
        : false;

      const { total, breakdown } = computeImageScore({
        query,
        imageMetadata: metadata,
        storyType,
        entityMatch,
        tier: "editorial",
        width: w || MIN_WIDTH, // Assume minimum if unknown (SearXNG doesn't always report)
        height: h || MIN_WIDTH,
        licenseStatus: "editorial_fair_use",
      });

      if (!best || total > best.score) {
        best = {
          url: imageUrl,
          source: "searxng",
          tier: "editorial",
          licenseStatus: "editorial_fair_use",
          score: total,
          scoreBreakdown: breakdown,
          width: w || 0,
          height: h || 0,
          sourceDomain: pageDomain || imgDomain,
          sourceType: "web_search",
          entityName,
          license: "Editorial Fair Use",
          sourceUrl: img.url,
        };
      }
    }

    return best;
  } catch (err) {
    console.warn(
      `[searxngImages] search failed for "${query}":`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ── High-Quality Image Search (for reverse image search) ───────────────────

/**
 * Search SearXNG for a high-quality version of a news photo.
 *
 * Equivalent to `searchBraveForHQImage()` in reverseImageSearch.ts —
 * uses the item's metadata-derived query to find a high-res editorial image.
 */
export async function searchSearxngForHQImage(
  query: string,
): Promise<ImageCandidate | null> {
  const baseUrl = getSearxngUrl();
  if (!baseUrl) return null;

  try {
    const url = new URL(`${baseUrl}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("categories", "images");
    url.searchParams.set("format", "json");
    url.searchParams.set("safesearch", "2");
    url.searchParams.set("engines", "google images,bing images,duckduckgo images");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "EdLight-News-Worker/1.0",
      },
      signal: AbortSignal.timeout(SEARXNG_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[searxngReverseImage] returned ${res.status} for "${query}"`);
      return null;
    }

    const data = (await res.json()) as SearxngResponse;
    const results = data.results as SearxngImageResult[];
    if (!results?.length) return null;

    let best: ImageCandidate | null = null;

    for (const img of results.slice(0, 20)) {
      const imageUrl = img.img_src;
      if (!imageUrl) continue;
      if (/\.(svg|pdf)$/i.test(imageUrl)) continue;

      const { width: w, height: h } = parseResolution(img.resolution);

      // For reverse search, need minimum shortest side of 1080
      if (w > 0 && h > 0 && Math.min(w, h) < MIN_WIDTH_REVERSE) continue;

      const pageDomain = getDomain(img.url || "");
      const imgDomain = getDomain(imageUrl);
      if (STOCK_DOMAIN_RE.test(pageDomain) || STOCK_DOMAIN_RE.test(imgDomain)) continue;

      const metadata = `${img.title ?? ""} ${pageDomain}`;

      const { total, breakdown } = computeImageScore({
        query,
        imageMetadata: metadata,
        storyType: "event",
        entityMatch: false,
        tier: "editorial",
        width: w || MIN_WIDTH_REVERSE,
        height: h || MIN_WIDTH_REVERSE,
        licenseStatus: "editorial_fair_use",
      });

      // Boost like Brave reverse search does
      const boostedTotal = Math.min(100, total + 8);

      if (!best || boostedTotal > best.score) {
        best = {
          url: imageUrl,
          source: "searxng",
          tier: "editorial",
          licenseStatus: "editorial_fair_use",
          score: boostedTotal,
          scoreBreakdown: breakdown,
          width: w || 0,
          height: h || 0,
          sourceDomain: pageDomain || imgDomain,
          sourceType: "reverse_image_search",
          license: "Editorial Fair Use",
          sourceUrl: img.url,
        };
      }
    }

    return best;
  } catch (err) {
    console.warn(
      `[searxngReverseImage] search failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ── Web Search (for webImageSearch.ts fallback) ────────────────────────────

/**
 * Search SearXNG web results and return page URLs.
 *
 * Equivalent to `searchBraveAPI()` in webImageSearch.ts — returns
 * a list of page URLs from which og:image can be extracted.
 */
export async function searchSearxngWeb(query: string): Promise<string[]> {
  const baseUrl = getSearxngUrl();
  if (!baseUrl) return [];

  try {
    const url = new URL(`${baseUrl}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("categories", "general");
    url.searchParams.set("format", "json");
    url.searchParams.set("safesearch", "2");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "EdLight-News-Worker/1.0",
      },
      signal: AbortSignal.timeout(SEARXNG_TIMEOUT_MS),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as SearxngResponse;
    const results = data.results as SearxngWebResult[];
    if (!results?.length) return [];

    return results
      .filter((r) => r.url?.startsWith("http"))
      .map((r) => r.url)
      .slice(0, 10);
  } catch {
    return [];
  }
}

export { delay as searxngDelay, INTER_QUERY_DELAY_MS };
