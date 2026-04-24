/**
 * Library of Congress image search.
 *
 * Uses the LoC JSON API (loc.gov/apis) — completely free, no API key needed.
 * Excellent for historical content, especially U.S. history and Haiti.
 *
 * All LoC "Free to Use and Reuse" content is public domain.
 * https://www.loc.gov/free-to-use/
 */

import type { ImageCandidate } from "./imageTypes.js";
import { computeImageScore } from "./imageScoring.js";
import type { StoryType } from "./imageTypes.js";

const LOC_API = "https://www.loc.gov";
const UA = "EdLight-News-Worker/1.0 (loc image search; news@edlight.org)";

// ── Types ──────────────────────────────────────────────────────────────────

interface LocResult {
  image_url?: string[];
  title?: string;
  date?: string;
  url?: string;
  rights_advisory?: string[];
  subject?: string[];
  contributor?: string[];
}

interface LocSearchResponse {
  results?: LocResult[];
}

// ── Search ─────────────────────────────────────────────────────────────────

/**
 * Search the Library of Congress for images matching a query.
 *
 * Targets the Prints & Photographs division (most relevant for editorial use).
 * Returns the best candidate above the minimum score, or null.
 */
export async function searchLibraryOfCongress(
  query: string,
  storyType: StoryType,
  entityName?: string,
  minScore = 30,
): Promise<ImageCandidate | null> {
  try {
    const url = new URL(`${LOC_API}/search/`);
    url.searchParams.set("q", query);
    url.searchParams.set("fa", "online-format:image");
    url.searchParams.set("fo", "json");
    url.searchParams.set("c", "6"); // 6 results
    // Prefer Prints & Photographs division
    url.searchParams.set("sp", "1");

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[locSearch] LoC API error: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as LocSearchResponse;
    if (!data.results?.length) return null;

    let best: ImageCandidate | null = null;

    for (const item of data.results) {
      // Need at least one image URL
      const imageUrls = item.image_url?.filter((u) => /\.(jpg|jpeg|png|gif|tif)/i.test(u));
      if (!imageUrls?.length) continue;

      // Prefer larger versions — LoC provides multiple sizes
      // Sort by URL length heuristic (longer URLs tend to be higher-res thumbnails)
      // or look for specific size indicators
      const imageUrl =
        imageUrls.find((u) => /large|full|pnp/i.test(u)) ??
        imageUrls[imageUrls.length - 1] ??
        imageUrls[0];

      if (!imageUrl) continue;

      // Build metadata string for relevance scoring
      const metadata = [
        item.title ?? "",
        ...(item.subject ?? []),
        ...(item.contributor ?? []),
      ].join(" ");

      const entityMatch = entityName
        ? metadata.toLowerCase().includes(entityName.toLowerCase())
        : false;

      const { total, breakdown } = computeImageScore({
        query,
        imageMetadata: metadata,
        storyType,
        entityMatch,
        tier: "archive",
        captureDate: item.date,
        width: 1600, // LoC images are typically high-res; assume good quality
        height: 1200,
        licenseStatus: "safe_public_domain",
      });

      if (total >= minScore && (!best || total > best.score)) {
        best = {
          url: imageUrl,
          source: "loc",
          tier: "archive",
          licenseStatus: "safe_public_domain",
          score: total,
          scoreBreakdown: breakdown,
          width: 1600,
          height: 1200,
          sourceDomain: "loc.gov",
          sourceType: "archive",
          entityName,
          author: item.contributor?.[0],
          license: "Public Domain",
          sourceUrl: item.url,
          captureDate: item.date,
        };
      }
    }

    if (best) {
      console.log(
        `[locSearch] ✅ LoC hit: score=${best.score.toFixed(1)} for "${query}"`,
      );
    }

    return best;
  } catch (err) {
    console.warn("[locSearch] Search failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
