/**
 * Free-licensed image search for IG posts.
 *
 * When a source's publisher images are unsafe for IG (watermarked, copyrighted),
 * this service finds a free-licensed alternative via:
 *
 *   1. Gemini keyword extraction (title + summary → search queries)
 *   2. Wikimedia Commons search (public domain / CC0 preferred)
 *
 * Reuses the proven Commons API patterns from historyIllustrationResolver.ts.
 */

import { callGemini } from "@edlight-news/generator";
import type { Item } from "@edlight-news/types";

// ── Types ──────────────────────────────────────────────────────────────────

type CommonsImageInfo = {
  thumburl?: string;
  url?: string;
  descriptionurl?: string;
  width?: number;
  height?: number;
  extmetadata?: {
    Artist?: { value?: string };
    LicenseShortName?: { value?: string };
    AttributionRequired?: { value?: string };
    Copyrighted?: { value?: string };
    UsageTerms?: { value?: string };
  };
};

type CommonsPage = {
  pageid?: number;
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

export interface FreeImageResult {
  imageUrl: string;
  pageUrl: string;
  author?: string;
  license?: string;
  query: string; // The search query that found this image
}

interface GeminiImageKeywords {
  /** Public figure name if mentioned (e.g. "Donald Trump") */
  personName?: string;
  /** 2-3 search queries optimized for Wikimedia Commons */
  commonsQueries: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const UA = "EdLight-News-Worker/1.0 (commons image search; contact@edlight.news)";

/** Licenses considered safe for IG embedding without in-image attribution */
const SAFE_LICENSES = new Set([
  "public domain",
  "pd",
  "pd-usgov",
  "pd-usgov-military",
  "pd-usgov-military-army",
  "pd-usgov-military-navy",
  "pd-usgov-military-air force",
  "pd-usgov-white house",
  "pd-usgov-potus",
  "pd-usgov-fema",
  "pd-usgov-nasa",
  "pd-usgov-usaid",
  "pd-usgov-dos",
  "pd-author",
  "pd-self",
  "pd-old-70",
  "pd-old-100",
  "pd-old",
  "pd-textlogo",
  "pd-ineligible",
  "cc0",
  "cc0 1.0",
  "cc-zero",
]);

/**
 * Slightly broader set — CC BY is acceptable if we store attribution in metadata.
 * These are still free-licensed but require credit (stored in item.imageAttribution).
 */
const ACCEPTABLE_LICENSES = new Set([
  ...SAFE_LICENSES,
  "cc by 2.0",
  "cc by 3.0",
  "cc by 4.0",
  "cc-by-2.0",
  "cc-by-3.0",
  "cc-by-4.0",
  "cc by-sa 2.0",
  "cc by-sa 3.0",
  "cc by-sa 4.0",
  "cc-by-sa-2.0",
  "cc-by-sa-3.0",
  "cc-by-sa-4.0",
]);

// ── Gemini keyword extraction ──────────────────────────────────────────────

const KEYWORD_PROMPT = `You are a search query expert. Given a news article title and summary, 
extract 2-3 search queries optimized for finding a relevant photograph on Wikimedia Commons.

Focus on:
- Named public figures (presidents, ministers, officials) → use their full name
- Specific locations (cities, buildings, landmarks) → use the proper name
- Events or topics → use descriptive terms that would match real photographs

Rules:
- Queries should find PHOTOGRAPHS, not logos or diagrams
- Prefer queries that would match official/government photos (public domain)
- For Haitian topics, try both French and English query variants
- Keep queries concise (2-5 words each)

Return ONLY valid JSON, no markdown:
{
  "personName": "Full Name" or null,
  "commonsQueries": ["query 1", "query 2", "query 3"]
}

Article title: {TITLE}
Summary: {SUMMARY}`;

async function extractImageKeywords(item: Item): Promise<GeminiImageKeywords> {
  try {
    const prompt = KEYWORD_PROMPT
      .replace("{TITLE}", item.title)
      .replace("{SUMMARY}", (item.summary ?? "").slice(0, 300));

    const raw = await callGemini(prompt);
    const parsed = JSON.parse(raw);

    return {
      personName: parsed.personName ?? undefined,
      commonsQueries: Array.isArray(parsed.commonsQueries)
        ? parsed.commonsQueries.filter((q: unknown) => typeof q === "string" && q.length > 0).slice(0, 4)
        : [],
    };
  } catch (err) {
    console.warn("[commonsImageSearch] Gemini keyword extraction failed:", err instanceof Error ? err.message : err);
    // Fallback: use title words as search query
    const fallbackQuery = item.title
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .split(/\s+/)
      .slice(0, 5)
      .join(" ");
    return { commonsQueries: fallbackQuery ? [fallbackQuery] : [] };
  }
}

// ── Wikimedia Commons search ───────────────────────────────────────────────

function stripHtml(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function isAcceptableLicense(license?: string): boolean {
  if (!license) return false;
  const normalized = license.toLowerCase().trim();
  return ACCEPTABLE_LICENSES.has(normalized);
}

function isSafeLicense(license?: string): boolean {
  if (!license) return false;
  const normalized = license.toLowerCase().trim();
  return SAFE_LICENSES.has(normalized);
}

/**
 * Search Wikimedia Commons for images matching a query.
 * Filters results to only return free-licensed images.
 * Prefers public domain over CC BY.
 */
async function searchCommons(query: string): Promise<FreeImageResult | null> {
  const url = new URL(COMMONS_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrnamespace", "6"); // File: namespace
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|extmetadata");
  url.searchParams.set("iiurlwidth", "1280");

  const res = await fetch(url.toString(), { headers: { "User-Agent": UA } });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    query?: { pages?: Record<string, CommonsPage> };
  };

  const pages = Object.values(json.query?.pages ?? {});

  // Sort: prefer PD/CC0 over CC BY
  let bestPD: FreeImageResult | null = null;
  let bestCC: FreeImageResult | null = null;

  for (const p of pages) {
    const info = p.imageinfo?.[0];
    if (!info) continue;

    const imageUrl = info.thumburl ?? info.url;
    if (!imageUrl || !p.pageid) continue;

    // Skip SVGs, PDFs, non-photo files
    if (/\.(svg|pdf|tiff?)$/i.test(imageUrl)) continue;
    // Skip very small thumbnails (likely icons)
    if (info.thumburl && /\/\d{1,2}px-/i.test(info.thumburl)) continue;

    // ── Dimension gate: reject images whose short side is below 1080px ──
    // The API returns the original image dimensions via iiprop=size.
    // Images below 1080px on their shortest side look blurry on IG (1080×1350).
    const origW = info.width;
    const origH = info.height;
    if (origW && origH && Math.min(origW, origH) < 1080) continue;

    const license = stripHtml(info.extmetadata?.LicenseShortName?.value);
    const author = stripHtml(info.extmetadata?.Artist?.value);

    if (isSafeLicense(license) && !bestPD) {
      bestPD = {
        imageUrl,
        pageUrl: `https://commons.wikimedia.org/?curid=${p.pageid}`,
        author,
        license,
        query,
      };
    } else if (isAcceptableLicense(license) && !bestCC) {
      bestCC = {
        imageUrl,
        pageUrl: `https://commons.wikimedia.org/?curid=${p.pageid}`,
        author,
        license,
        query,
      };
    }

    // PD is ideal — stop searching
    if (bestPD) break;
  }

  return bestPD ?? bestCC;
}

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Find a free-licensed image for an item whose publisher image is unsafe for IG.
 *
 * Pipeline:
 *   1. If item already has a Wikidata/branded/commons image → skip (already safe)
 *   2. Ask Gemini for smart search keywords based on title + summary
 *   3. Search Wikimedia Commons with each query until we find a match
 *   4. Return the best free-licensed image, or null if nothing found
 *
 * The caller (buildIgQueue) uses the result to override item.imageUrl for IG
 * formatting, without changing the item in Firestore.
 */
export async function findFreeImage(item: Item): Promise<FreeImageResult | null> {
  // Already has a safe image source — no search needed
  if (item.imageSource && item.imageSource !== "publisher") {
    return null;
  }

  const keywords = await extractImageKeywords(item);

  // If a person was detected, try their name first (highest relevance)
  if (keywords.personName) {
    const queries = [
      `${keywords.personName} official portrait`,
      keywords.personName,
      ...keywords.commonsQueries,
    ];
    // Dedupe
    const unique = [...new Set(queries)];
    for (const q of unique) {
      const result = await searchCommons(q);
      if (result) {
        console.log(`[commonsImageSearch] ✅ Found image for "${item.title.slice(0, 50)}…" via query "${q}" (${result.license})`);
        return result;
      }
    }
  } else {
    // No person — try the generated queries
    for (const q of keywords.commonsQueries) {
      const result = await searchCommons(q);
      if (result) {
        console.log(`[commonsImageSearch] ✅ Found image for "${item.title.slice(0, 50)}…" via query "${q}" (${result.license})`);
        return result;
      }
    }
  }

  console.log(`[commonsImageSearch] ⚠️  No free image found for "${item.title.slice(0, 60)}…"`);
  return null;
}
