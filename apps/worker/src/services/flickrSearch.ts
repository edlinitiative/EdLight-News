/**
 * Flickr image search for official government accounts.
 *
 * Uses the Flickr API (free, requires API key from flickr.com/services/api).
 * Without a FLICKR_API_KEY, falls through gracefully (returns null).
 *
 * Targets specific government Flickr accounts from the official source
 * registry — much higher trust than generic Flickr search.
 *
 * Most official government Flickr accounts publish under:
 * - U.S. Government Work (public domain)
 * - CC BY 2.0
 * - "No known copyright restrictions"
 */

import type { ImageCandidate, StoryType, LicenseStatus } from "./imageTypes.js";
import { computeImageScore } from "./imageScoring.js";
import type { OfficialSourceEntry } from "./imageTypes.js";

const FLICKR_API = "https://www.flickr.com/services/rest/";
const UA = "EdLight-News-Worker/1.0 (flickr search; contact@edlight.news)";

// ── Flickr license mapping ─────────────────────────────────────────────────
// https://www.flickr.com/services/api/flickr.photos.licenses.getInfo.html

const FLICKR_LICENSE_MAP: Record<number, { name: string; status: LicenseStatus }> = {
  0:  { name: "All Rights Reserved",           status: "licensed_editorial" },
  1:  { name: "CC BY-NC-SA 2.0",               status: "licensed_editorial" },  // Non-commercial
  2:  { name: "CC BY-NC 2.0",                  status: "licensed_editorial" },  // Non-commercial
  3:  { name: "CC BY-NC-ND 2.0",               status: "licensed_editorial" },  // Non-commercial
  4:  { name: "CC BY 2.0",                     status: "cc_attribution" },
  5:  { name: "CC BY-SA 2.0",                  status: "cc_attribution" },
  6:  { name: "CC BY-ND 2.0",                  status: "cc_attribution" },
  7:  { name: "No known copyright restrictions", status: "safe_public_domain" },
  8:  { name: "United States Government Work",  status: "safe_public_domain" },
  9:  { name: "CC0 1.0",                       status: "safe_public_domain" },
  10: { name: "Public Domain Mark 1.0",         status: "safe_public_domain" },
};

// ── Types ──────────────────────────────────────────────────────────────────

interface FlickrPhoto {
  id: string;
  owner: string;
  secret: string;
  server: string;
  farm: number;
  title: string;
  license: number;
  datetaken?: string;
  ownername?: string;
  o_width?: string;
  o_height?: string;
  url_l?: string;
  url_o?: string;
  url_c?: string;
  width_l?: number;
  height_l?: number;
  width_o?: number;
  height_o?: number;
  width_c?: number;
  height_c?: number;
  tags?: string;
}

interface FlickrSearchResponse {
  photos?: {
    photo?: FlickrPhoto[];
    total?: number;
  };
  stat?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getFlickrApiKey(): string | undefined {
  return process.env.FLICKR_API_KEY;
}

/** Build the best available image URL from Flickr size variants. */
function bestImageUrl(photo: FlickrPhoto): { url: string; width: number; height: number } | null {
  // Prefer: original > large (1024) > medium 800
  if (photo.url_o && photo.width_o && photo.height_o) {
    return { url: photo.url_o, width: photo.width_o, height: photo.height_o };
  }
  if (photo.url_l && photo.width_l && photo.height_l) {
    return { url: photo.url_l, width: photo.width_l, height: photo.height_l };
  }
  if (photo.url_c && photo.width_c && photo.height_c) {
    return { url: photo.url_c, width: photo.width_c, height: photo.height_c };
  }
  // Construct from farm/server (large size = _b suffix, ~1024px)
  return {
    url: `https://live.staticflickr.com/${photo.server}/${photo.id}_${photo.secret}_b.jpg`,
    width: 1024,
    height: 768,
  };
}

// ── Search ─────────────────────────────────────────────────────────────────

/**
 * Search Flickr for images, optionally restricted to specific user IDs.
 *
 * If `officialUserIds` is provided, only searches those accounts (Tier 1).
 * Otherwise, searches broadly with license filtering (Tier 3/4).
 */
export async function searchFlickr(
  query: string,
  storyType: StoryType,
  options?: {
    officialUserIds?: string[];
    officialEntries?: OfficialSourceEntry[];
    entityName?: string;
    minScore?: number;
  },
): Promise<ImageCandidate | null> {
  const apiKey = getFlickrApiKey();
  if (!apiKey) return null; // Graceful fallback — no key configured

  const minScore = options?.minScore ?? 30;

  try {
    const url = new URL(FLICKR_API);
    url.searchParams.set("method", "flickr.photos.search");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("text", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("nojsoncallback", "1");
    url.searchParams.set("sort", "relevance");
    url.searchParams.set("per_page", "8");
    url.searchParams.set("content_type", "1");  // Photos only
    url.searchParams.set("media", "photos");
    url.searchParams.set("extras", "url_l,url_o,url_c,license,date_taken,owner_name,o_dims,tags");

    // If targeting official accounts, restrict to those user IDs
    if (options?.officialUserIds?.length) {
      url.searchParams.set("user_id", options.officialUserIds[0]!);
    } else {
      // Broad search — only allow safe licenses
      // 4=CC-BY, 5=CC-BY-SA, 7=No known copyright, 8=US Gov, 9=CC0, 10=PD Mark
      url.searchParams.set("license", "4,5,7,8,9,10");
    }

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[flickrSearch] API error: ${res.status}`);
      return null;
    }

    const data = (await res.json()) as FlickrSearchResponse;
    if (!data.photos?.photo?.length) return null;

    let best: ImageCandidate | null = null;

    for (const photo of data.photos.photo) {
      const img = bestImageUrl(photo);
      if (!img) continue;
      if (img.width < 800) continue; // Too small

      // Determine license status
      const licenseInfo = FLICKR_LICENSE_MAP[photo.license] ?? {
        name: "Unknown",
        status: "unknown_do_not_publish" as LicenseStatus,
      };

      // If from an official account, override license to official_reusable
      const isOfficial = options?.officialUserIds?.includes(photo.owner);
      const officialEntry = options?.officialEntries?.find(
        (e) => e.flickrUserId === photo.owner,
      );
      const finalLicenseStatus: LicenseStatus = isOfficial
        ? officialEntry?.licenseStatus ?? "official_reusable"
        : licenseInfo.status;

      // Build metadata for relevance scoring
      const metadata = [
        photo.title,
        photo.ownername ?? "",
        photo.tags ?? "",
      ].join(" ");

      const entityMatch = options?.entityName
        ? metadata.toLowerCase().includes(options.entityName.toLowerCase())
        : false;

      const { total, breakdown } = computeImageScore({
        query,
        imageMetadata: metadata,
        storyType,
        entityMatch,
        tier: isOfficial ? "official" : "stock",
        officialBoost: officialEntry?.trustBoost ?? 0,
        captureDate: photo.datetaken,
        width: img.width,
        height: img.height,
        licenseStatus: finalLicenseStatus,
      });

      if (total >= minScore && (!best || total > best.score)) {
        best = {
          url: img.url,
          source: "flickr",
          tier: isOfficial ? "official" : "stock",
          licenseStatus: finalLicenseStatus,
          score: total,
          scoreBreakdown: breakdown,
          width: img.width,
          height: img.height,
          sourceDomain: "flickr.com",
          sourceType: isOfficial ? "official" : "stock",
          entityName: options?.entityName,
          author: photo.ownername,
          license: licenseInfo.name,
          sourceUrl: `https://www.flickr.com/photos/${photo.owner}/${photo.id}`,
          captureDate: photo.datetaken,
        };
      }
    }

    // For official account searches, also try the other user IDs if first didn't work
    if (!best && options?.officialUserIds && options.officialUserIds.length > 1) {
      for (const userId of options.officialUserIds.slice(1)) {
        const alt = await searchFlickr(query, storyType, {
          ...options,
          officialUserIds: [userId],
        });
        if (alt && alt.score > (best?.score ?? 0)) {
          best = alt;
        }
      }
    }

    if (best) {
      console.log(
        `[flickrSearch] ✅ Flickr ${best.tier} hit: score=${best.score.toFixed(1)} ` +
        `by ${best.author ?? "unknown"} (${best.license})`,
      );
    }

    return best;
  } catch (err) {
    console.warn("[flickrSearch] Search failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
