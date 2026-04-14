/**
 * Reverse image search service.
 *
 * When an article has a publisher image that is too low-resolution for IG
 * (< 1080 px shortest side), this service uses Gemini Vision to describe
 * the image content and then searches Brave Image Search for a high-quality
 * version of the **same** image (or a visually equivalent one).
 *
 * This bridges the gap where the article shows image A (low-res publisher
 * og:image) and the IG post shows image B (keyword-matched stock photo).
 * By searching for a description of the actual image, we can often find
 * the same photo at wire-service resolution (AP, Reuters, AFP).
 *
 * Pipeline integration point: called from buildIgQueue.ts BEFORE the
 * generic tiered keyword search. If a high-res match is found, it becomes
 * the overrideImageUrl; otherwise the pipeline falls through to the normal
 * Brave → Unsplash → LoC → Commons cascade.
 */

import type { Item } from "@edlight-news/types";
import type { ImageCandidate } from "./imageTypes.js";
import { computeImageScore } from "./imageScoring.js";

// ── Constants ──────────────────────────────────────────────────────────────

const BRAVE_IMAGE_API = "https://api.search.brave.com/res/v1/images/search";
const MIN_WIDTH = 1080;
const GEMINI_VISION_TIMEOUT_MS = 15_000;
const BRAVE_TIMEOUT_MS = 10_000;

// ── Gemini Vision — describe the publisher image ───────────────────────────

/**
 * Use Gemini Vision to generate a detailed description of an image.
 * The description is optimised for reverse-image search: it focuses on
 * identifiable people, settings, logos, and distinctive visual elements.
 */
async function describeImageWithGemini(imageUrl: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[reverseImageSearch] No GEMINI_API_KEY set — skipping vision describe");
    return null;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(GEMINI_VISION_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: [
                    "Describe this image for a reverse image search query.",
                    "Focus on:",
                    "- Full names of any recognisable people (politicians, public figures)",
                    "- Specific setting (parliament, podium, press conference, office, etc.)",
                    "- Distinctive objects, logos, flags, or banners visible",
                    "- The action taking place (speaking, signing, meeting, etc.)",
                    "",
                    "Return ONLY a concise search query (10-20 words) that would find",
                    "this exact image or a very similar one on a news image search engine.",
                    "Do not include quotation marks. Do not explain — just the query.",
                  ].join("\n"),
                },
                {
                  inlineData: undefined, // will be set below
                  fileData: {
                    mimeType: "image/jpeg",
                    fileUri: imageUrl,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 100,
          },
        }),
      },
    );

    if (!res.ok) {
      // Gemini may not support fileUri for arbitrary URLs — try with
      // an inline image download instead.
      return await describeImageInline(imageUrl, apiKey);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text || text.length < 5) return null;

    console.log(`[reverseImageSearch] Gemini described image: "${text}"`);
    return text;
  } catch {
    // Fall back to inline download approach
    return await describeImageInline(imageUrl, apiKey);
  }
}

/**
 * Fallback: download the image, base64-encode it, and send as inlineData
 * to Gemini Vision. More reliable than fileUri for arbitrary publisher URLs.
 */
async function describeImageInline(
  imageUrl: string,
  apiKey: string,
): Promise<string | null> {
  try {
    // Download the image
    const imgRes = await fetch(imageUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EdLight-News/1.0; +https://edlight.org)",
      },
      redirect: "follow",
    });

    if (!imgRes.ok) return null;

    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await imgRes.arrayBuffer());
    if (buffer.length < 1_000 || buffer.length > 20_000_000) return null;

    const base64 = buffer.toString("base64");
    const mimeType = contentType.split(";")[0]!.trim();

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(GEMINI_VISION_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: [
                    "Describe this image for a reverse image search query.",
                    "Focus on:",
                    "- Full names of any recognisable people (politicians, public figures)",
                    "- Specific setting (parliament, podium, press conference, office, etc.)",
                    "- Distinctive objects, logos, flags, or banners visible",
                    "- The action taking place (speaking, signing, meeting, etc.)",
                    "",
                    "Return ONLY a concise search query (10-20 words) that would find",
                    "this exact image or a very similar one on a news image search engine.",
                    "Do not include quotation marks. Do not explain — just the query.",
                  ].join("\n"),
                },
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 100,
          },
        }),
      },
    );

    if (!res.ok) {
      console.warn(`[reverseImageSearch] Gemini Vision inline returned ${res.status}`);
      return null;
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text || text.length < 5) return null;

    console.log(`[reverseImageSearch] Gemini described image (inline): "${text}"`);
    return text;
  } catch (err) {
    console.warn(
      "[reverseImageSearch] inline vision failed:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ── Brave Image Search with vision-derived query ───────────────────────────

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
 * Search Brave Image Search using the Gemini-derived description.
 * Filters for images that are large enough for IG (≥ 1080 px shortest side).
 */
async function searchBraveForHQImage(
  visionQuery: string,
  item: Item,
): Promise<ImageCandidate | null> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL(BRAVE_IMAGE_API);
    url.searchParams.set("q", visionQuery);
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
      console.warn(`[reverseImageSearch] Brave returned ${res.status} for "${visionQuery}"`);
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
        query: visionQuery,
        imageMetadata: metadata,
        storyType: "event", // generic — vision query carries the context
        entityMatch: false,
        tier: "editorial",
        captureDate: img.page_age,
        width: w,
        height: h,
        licenseStatus: "editorial_fair_use",
      });

      // Boost score slightly: vision-matched images are more likely to be
      // the actual photo than keyword-matched ones.
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
 * using Gemini Vision + Brave Image Search.
 *
 * Returns an `ImageCandidate` with the high-res URL, or null if:
 * - The item has no publisher image
 * - The publisher image is already high-enough quality
 * - Gemini Vision failed to describe the image
 * - Brave found no high-res matches
 *
 * @param item   - The content item with its (potentially low-res) publisher image
 * @param minShortestSide - Minimum shortest-side pixels for IG (default 1080)
 */
export async function findHighResVersion(
  item: Item,
  minShortestSide = 1080,
): Promise<ImageCandidate | null> {
  // Only run if item has a publisher image
  if (!item.imageUrl) return null;

  // Check if the publisher image is already good enough
  const width = item.imageMeta?.width;
  const height = item.imageMeta?.height;

  if (width && height && Math.min(width, height) >= minShortestSide) {
    // Already high-res — no need to reverse search
    return null;
  }

  // If we don't know the dimensions, still try — the image may be low-res
  // without us knowing (no dimensions were stored)
  console.log(
    `[reverseImageSearch] Publisher image for ${item.id} is ${width ?? "?"}×${height ?? "?"} — ` +
    `searching for high-res version…`,
  );

  // Step 1: Describe the image with Gemini Vision
  const visionQuery = await describeImageWithGemini(item.imageUrl);
  if (!visionQuery) {
    console.log(`[reverseImageSearch] Gemini Vision could not describe image for ${item.id}`);
    return null;
  }

  // Step 2: Search Brave with the vision-derived query
  const result = await searchBraveForHQImage(visionQuery, item);

  if (result) {
    console.log(
      `[reverseImageSearch] ✅ Found high-res match for ${item.id}: ` +
      `${result.width}×${result.height} from ${result.sourceDomain} ` +
      `(score=${result.score.toFixed(1)})`,
    );
  } else {
    console.log(
      `[reverseImageSearch] ⚠️  No high-res match found for ${item.id}`,
    );
  }

  return result;
}
