/**
 * pickStockFootage — resolves topic-appropriate b-roll for a reel.
 *
 * Strategy by topic:
 *  - histoire    → Wikimedia Commons (public domain archival)
 *  - all others  → Pexels (free commercial license)
 *  - on failure  → BRAND_ASSETS.fallbackFootage (always wins; never blocks)
 *
 * We pull `count` clips so the composer can cycle through them across the
 * body section. Each returned clip carries provenance so the on-screen
 * `sourceLabel` chip and the IG caption credits stay accurate.
 */

import type { ReelTopic } from "./types.js";
import { BRAND_ASSETS } from "./brand.js";

export interface StockClip {
  /** Direct URL to a downloadable MP4/JPG. */
  url: string;
  /** "video" or "image" — composer treats them differently. */
  kind: "video" | "image";
  /** Provider attribution. */
  provider: "pexels" | "wikimedia" | "brand-fallback";
  /** Photographer / contributor name when available. */
  credit?: string;
  /** Original page URL — used in caption credits. */
  sourceUrl?: string;
  /** Width / height in pixels (best-effort). */
  width?: number;
  height?: number;
}

export interface PickStockFootageInput {
  topic: ReelTopic;
  /** Free-text query (usually the headline or 3-5 keywords). */
  query: string;
  /** How many clips to fetch. Composer will cycle. Defaults to 3. */
  count?: number;
}

const PEXELS_API = "https://api.pexels.com/videos/search";
const PEXELS_PHOTOS_API = "https://api.pexels.com/v1/search";
const WIKIMEDIA_API = "https://commons.wikimedia.org/w/api.php";

/**
 * Public entry. Always resolves — falls back to brand assets so reels never
 * fail to compose because stock search is down.
 */
export async function pickStockFootage(
  input: PickStockFootageInput,
): Promise<StockClip[]> {
  const count = input.count ?? 3;

  try {
    if (input.topic === "histoire") {
      const wiki = await searchWikimedia(input.query, count);
      if (wiki.length > 0) return wiki;
    }
    const pexels = await searchPexels(input.query, count);
    if (pexels.length > 0) return pexels;
  } catch (err) {
    console.warn(
      `[pickStockFootage] provider error, falling back to brand assets: ${(err as Error).message}`,
    );
  }

  return brandFallback(count);
}

// ── Pexels ─────────────────────────────────────────────────────────────────

async function searchPexels(query: string, count: number): Promise<StockClip[]> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    // Not configured — silently skip so the fallback chain proceeds.
    return [];
  }

  // Try video first; if no usable results, fall back to photos.
  const videos = await pexelsVideos(query, count, apiKey);
  if (videos.length >= count) return videos;
  const photos = await pexelsPhotos(query, count - videos.length, apiKey);
  return [...videos, ...photos];
}

async function pexelsVideos(
  query: string,
  count: number,
  apiKey: string,
): Promise<StockClip[]> {
  const url = new URL(PEXELS_API);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(Math.min(count * 2, 15)));
  url.searchParams.set("orientation", "portrait");

  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) {
    throw new Error(`Pexels videos ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = (await res.json()) as PexelsVideoResponse;

  return (data.videos ?? [])
    .map((v): StockClip | null => {
      // Prefer 1080p portrait, then any portrait, then any.
      const portrait = v.video_files.filter((f) => f.height >= f.width);
      const pick =
        portrait.find((f) => f.height === 1920) ??
        portrait.find((f) => f.height >= 1280) ??
        portrait[0] ??
        v.video_files[0];
      if (!pick) return null;
      return {
        url: pick.link,
        kind: "video",
        provider: "pexels",
        credit: v.user?.name,
        sourceUrl: v.url,
        width: pick.width,
        height: pick.height,
      };
    })
    .filter((c): c is StockClip => c !== null)
    .slice(0, count);
}

async function pexelsPhotos(
  query: string,
  count: number,
  apiKey: string,
): Promise<StockClip[]> {
  if (count <= 0) return [];
  const url = new URL(PEXELS_PHOTOS_API);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(Math.min(count, 15)));
  url.searchParams.set("orientation", "portrait");

  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) return [];
  const data = (await res.json()) as PexelsPhotoResponse;

  return (data.photos ?? [])
    .slice(0, count)
    .map((p): StockClip => ({
      url: p.src.large2x ?? p.src.large ?? p.src.original,
      kind: "image",
      provider: "pexels",
      credit: p.photographer,
      sourceUrl: p.url,
      width: p.width,
      height: p.height,
    }));
}

// ── Wikimedia Commons ──────────────────────────────────────────────────────

async function searchWikimedia(query: string, count: number): Promise<StockClip[]> {
  const userAgent =
    process.env.WIKIMEDIA_USER_AGENT ?? "EdLightNewsBot/1.0 (https://edlightnews.com)";

  const url = new URL(WIKIMEDIA_API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6"); // File namespace
  url.searchParams.set("gsrsearch", `${query} filetype:bitmap`);
  url.searchParams.set("gsrlimit", String(Math.min(count * 2, 10)));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|size|extmetadata");
  url.searchParams.set("origin", "*");

  const res = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!res.ok) {
    throw new Error(`Wikimedia ${res.status}`);
  }
  const data = (await res.json()) as WikimediaResponse;

  const pages = data.query?.pages ? Object.values(data.query.pages) : [];
  return pages
    .map((p): StockClip | null => {
      const info = p.imageinfo?.[0];
      if (!info?.url) return null;
      return {
        url: info.url,
        kind: "image",
        provider: "wikimedia",
        credit:
          info.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "").trim() ??
          undefined,
        sourceUrl: info.descriptionurl,
        width: info.width,
        height: info.height,
      };
    })
    .filter((c): c is StockClip => c !== null)
    .slice(0, count);
}

// ── Brand fallback ─────────────────────────────────────────────────────────

function brandFallback(count: number): StockClip[] {
  const out: StockClip[] = [];
  const sources = BRAND_ASSETS.fallbackFootage;
  for (let i = 0; i < count; i++) {
    const url = sources[i % sources.length];
    out.push({ url, kind: "video", provider: "brand-fallback" });
  }
  return out;
}

// ── External response types (only the fields we use) ──────────────────────

interface PexelsVideoResponse {
  videos?: Array<{
    url: string;
    user?: { name?: string };
    video_files: Array<{ link: string; width: number; height: number }>;
  }>;
}

interface PexelsPhotoResponse {
  photos?: Array<{
    url: string;
    photographer?: string;
    width: number;
    height: number;
    src: {
      original: string;
      large?: string;
      large2x?: string;
    };
  }>;
}

interface WikimediaResponse {
  query?: {
    pages?: Record<
      string,
      {
        imageinfo?: Array<{
          url: string;
          descriptionurl?: string;
          width?: number;
          height?: number;
          extmetadata?: { Artist?: { value?: string } };
        }>;
      }
    >;
  };
}
