/**
 * High-quality image finder for publisher images.
 *
 * When an article has a publisher image that is too low-resolution for IG
 * (< 1080 px shortest side), this service builds a targeted search query
 * from the article's OWN metadata (title, entities, source) — no AI vision
 * needed — then searches Brave Image Search for a high-quality version of
 * the same photo (typically the original wire-service image from AP/Reuters/AFP).
 *
 * Why NOT use Gemini Vision?
 * - The article title + entity names already describe the image contents
 *   better than any vision model could (e.g. "Tatiana Auguste élue Canada").
 * - Gemini Vision costs ~$0.01-0.07 per call, per item, every 30 minutes.
 * - The existing Brave API key handles this at zero additional cost.
 *
 * Pipeline integration: called from buildIgQueue.ts BEFORE the generic
 * tiered keyword search. If a high-res match is found, it becomes the
 * overrideImageUrl; otherwise the pipeline falls through to the normal
 * Brave → Unsplash → LoC → Commons cascade.
 */

import type { Item } from "@edlight-news/types";
import type { ImageCandidate } from "./imageTypes.js";
import { computeImageScore } from "./imageScoring.js";
import { findVisionMatch } from "./googleVisionSearch.js";

// ── Constants ──────────────────────────────────────────────────────────────

const BRAVE_IMAGE_API = "https://api.search.brave.com/res/v1/images/search";
const MIN_WIDTH = 1080;
const BRAVE_TIMEOUT_MS = 10_000;
const HEAD_TIMEOUT_MS = 5_000;

// ── Build a focused search query from article metadata ─────────────────────

/**
 * Construct a search query tailored to find the exact news photo.
 *
 * Strategy:
 * 1. Lead with entity names (person, org) — they're the most discriminating.
 * 2. Append key title words (stripping common French stop-words).
 * 3. Add source name to bias toward the same wire-service photo.
 * 4. Cap at ~15 words so Brave returns precise results.
 */
function buildSearchQuery(item: Item): string {
  const parts: string[] = [];

  // ── Entity name (most powerful signal for news photos) ────────────────
  if (item.entity?.personName) {
    parts.push(item.entity.personName);
  }

  // ── Title keywords (skip stop-words) ─────────────────────────────────
  const STOP_WORDS = new Set([
    // French
    "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "au",
    "aux", "pour", "par", "sur", "dans", "est", "sont", "a", "été", "se",
    "ce", "qui", "que", "d", "l", "n", "s", "c", "qu",
    // English
    "the", "a", "an", "of", "in", "to", "for", "and", "is", "at", "on",
    "by", "with", "from", "has", "was", "are", "its", "it", "be", "as",
    // Connectors
    "—", "-", ":", "|", "–", "/",
  ]);

  const titleWords = (item.title ?? "")
    .replace(/[''"""«»()[\]{}]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w.toLowerCase()))
    .slice(0, 8);
  parts.push(...titleWords);

  // ── Source name (biases toward same news outlet's wire photo) ─────────
  if (item.source?.name) {
    parts.push(item.source.name);
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique = parts.filter((p) => {
    const lower = p.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  // Cap at 15 words
  return unique.slice(0, 15).join(" ");
}

// ── Check publisher image dimensions via HEAD request ──────────────────────

/**
 * Quick dimension check: try to determine if the publisher image is already
 * large enough by probing the image with a HEAD request. Some CDNs expose
 * content-length which can hint at quality, but dimensions in the Item
 * metadata (imageMeta) are more reliable.
 */
async function isPublisherImageSmall(item: Item, minShortestSide: number): Promise<boolean> {
  // If we already have stored dimensions, use those
  const w = item.imageMeta?.width;
  const h = item.imageMeta?.height;

  if (w && h) {
    return Math.min(w, h) < minShortestSide;
  }

  // No stored dimensions — check content-length as heuristic.
  // Images < 50 KB are almost certainly low-res.
  try {
    const headRes = await fetch(item.imageUrl!, {
      method: "HEAD",
      signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EdLight-News/1.0; +https://edlight.org)",
      },
      redirect: "follow",
    });

    if (headRes.ok) {
      const contentLength = parseInt(headRes.headers.get("content-length") ?? "0", 10);
      // A 1080×1080 JPEG at decent quality is typically > 100 KB.
      // If the image is under 50 KB it's almost certainly too small.
      if (contentLength > 0 && contentLength < 50_000) {
        return true;
      }
    }
  } catch {
    // HEAD failed — assume it might be small
  }

  // Unknown dimensions and HEAD didn't help — assume small to be safe.
  // The search is cheap (just a Brave API call we already pay for).
  return true;
}

// ── Brave Image Search ─────────────────────────────────────────────────────

interface BraveImageResult {
  title: string;
  url: string;
  thumbnail: { src: string };
  properties: {
    url: string;
    width?: number;
    height?: number;
  };
  source: string;
  page_age?: string;
}

/**
 * Search Brave Image Search using the article-metadata-derived query.
 * Filters for images that are large enough for IG (≥ 1080 px shortest side).
 */
async function searchBraveForHQImage(
  query: string,
  item: Item,
): Promise<ImageCandidate | null> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL(BRAVE_IMAGE_API);
    url.searchParams.set("q", query);
    url.searchParams.set("count", "15");
    url.searchParams.set("safesearch", "strict");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(BRAVE_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[reverseImageSearch] Brave returned ${res.status} for "${query}"`);
      return null;
    }

    const data = (await res.json()) as { results?: BraveImageResult[] };
    if (!data.results?.length) return null;

    let best: ImageCandidate | null = null;

    for (const img of data.results) {
      const w = img.properties?.width ?? 0;
      const h = img.properties?.height ?? 0;

      // Skip images below IG minimum
      if (Math.min(w, h) < MIN_WIDTH) continue;

      // Skip stock photo watermarked sites
      const domain = (img.source ?? "").toLowerCase();
      if (/getty|shutterstock|alamy|istockphoto|depositphotos|dreamstime|123rf/i.test(domain)) continue;

      const imageUrl = img.properties?.url || img.thumbnail?.src;
      if (!imageUrl) continue;
      if (/\.(svg|pdf)$/i.test(imageUrl)) continue;

      const metadata = `${img.title ?? ""} ${domain}`;

      const { total, breakdown } = computeImageScore({
        query,
        imageMetadata: metadata,
        storyType: "event",
        entityMatch: false,
        tier: "editorial",
        captureDate: img.page_age,
        width: w,
        height: h,
        licenseStatus: "editorial_fair_use",
      });

      // Boost score: entity-matched queries are more likely to return
      // the actual news photo than generic keyword searches.
      const boostedTotal = Math.min(100, total + 8);

      if (!best || boostedTotal > best.score) {
        best = {
          url: imageUrl,
          source: "brave",
          tier: "editorial",
          licenseStatus: "editorial_fair_use",
          score: boostedTotal,
          scoreBreakdown: breakdown,
          width: w,
          height: h,
          sourceDomain: domain,
          sourceType: "reverse_image_search",
          license: "Editorial Fair Use",
          sourceUrl: img.url,
          captureDate: img.page_age,
        };
      }
    }

    return best;
  } catch (err) {
    console.warn(
      `[reverseImageSearch] Brave search failed:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Attempt to find a high-quality version of the item's publisher image
 * using the article's own metadata + Brave Image Search.
 *
 * Zero additional API cost — uses the Brave API key you already pay for.
 * No Gemini Vision, no image processing libraries needed.
 *
 * Returns an `ImageCandidate` with the high-res URL, or null if:
 * - The item has no publisher image
 * - The publisher image is already high-enough quality
 * - Brave found no high-res matches
 *
 * @param item              The content item with its (potentially low-res) publisher image
 * @param minShortestSide   Minimum shortest-side pixels for IG (default 1080)
 */
export async function findHighResVersion(
  item: Item,
  minShortestSide = 1080,
): Promise<ImageCandidate | null> {
  // Only run if item has a publisher image
  if (!item.imageUrl) return null;

  // Check if the publisher image is already good enough
  const tooSmall = await isPublisherImageSmall(item, minShortestSide);
  if (!tooSmall) return null;

  console.log(
    `[reverseImageSearch] Publisher image for ${item.id} appears low-res — ` +
    `searching for high-quality version…`,
  );

  // ── Step 1: Google Cloud Vision WEB_DETECTION ───────────────────────────
  // Finds the *exact same photo* indexed across the web at higher resolution.
  // No text intermediary — pixel-level matching. Uses ~1 of your 1,000 free
  // monthly calls (quota enforced in googleVisionSearch.ts).
  if (item.imageUrl) {
    try {
      const visionMatch = await findVisionMatch(item.imageUrl);
      if (visionMatch) {
        console.log(
          `[reverseImageSearch] ✅ Vision exact match for ${item.id}: ` +
          `${visionMatch.sourceDomain} (${visionMatch.sourceType}, score=${visionMatch.score})`,
        );
        return visionMatch;
      }
    } catch (err) {
      console.warn(
        `[reverseImageSearch] Vision search failed for ${item.id}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  // ── Step 2: Brave metadata text search (fallback) ────────────────────────
  // Uses article title + entity names to search Brave Images for a high-res
  // editorial photo. Less precise than Vision but works without a Vision key.
  const query = buildSearchQuery(item);
  if (query.length < 5) {
    console.log(`[reverseImageSearch] Query too short for ${item.id}: "${query}"`);
    return null;
  }
  console.log(`[reverseImageSearch] Brave fallback query: "${query}"`);

  // Search Brave Images
  const result = await searchBraveForHQImage(query, item);

  if (result) {
    console.log(
      `[reverseImageSearch] ✅ Found HQ match for ${item.id}: ` +
      `${result.width}×${result.height} from ${result.sourceDomain} ` +
      `(score=${result.score.toFixed(1)})`,
    );
  } else {
    console.log(`[reverseImageSearch] ⚠️  No HQ match found for ${item.id}`);
  }

  return result;
}
