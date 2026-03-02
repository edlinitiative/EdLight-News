/**
 * Web-based image search for historical illustrations.
 *
 * Strategy (multi-engine, with fallback):
 *  1. Brave Search API (preferred — set BRAVE_SEARCH_API_KEY env var)
 *     Free tier: 2,000 queries/month at https://brave.com/search/api/
 *  2. Brave HTML scraping     (fallback — subject to 429 rate limits)
 *  3. DuckDuckGo HTML         (fallback — aggressive rate-limits)
 *  4. Google HTML              (fallback — captcha-prone)
 *  5. Fetch top result pages (preferring educational / archival sites)
 *  6. Extract the primary image (og:image / twitter:image / first large img)
 *
 * This gives much better coverage than Wikimedia Commons alone for
 * Haitian historical events — educational sites like FIU Island Luminous,
 * Le Nouvelliste, DLOC, etc. often have the actual historical photographs.
 */

/* ── Types ──────────────────────────────────────────────────────────── */

export interface WebImageResult {
  imageUrl: string;
  pageUrl: string;
  pageTitle?: string;
  sourceDomain: string;
}

export interface WebImageCacheEntry {
  imageUrl: string;
  pageUrl: string;
  pageTitle?: string;
  sourceDomain: string;
  resolvedAt: string;
}

/* ── Cache key (shared by resolver + batch script) ──────────────────── */

/** Normalised cache key from an entry's title_fr. */
export function cacheKey(titleFr: string): string {
  return titleFr
    .normalize("NFC")
    .replace(/[""''`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* ── Configuration ──────────────────────────────────────────────────── */

/**
 * Domains that tend to host high-quality, properly attributed historical
 * images.  Results from these domains are tried first.
 */
const PREFERRED_DOMAINS = [
  "islandluminous.fiu.edu",
  "dloc.com",
  "ufdc.ufl.edu",
  "loc.gov",
  "archives.gov",
  "haiti-reference.com",
  "haitireference.com",
  "britannica.com",
  "jstor.org",
  "smithsonianmag.com",
  "newyorker.com",
  "history.com",
  "nationalgeographic.com",
  "lenouvelliste.com",
  "alterpresse.org",
  "zinnedproject.org",
  "blackagendareport.com",
  "openedition.org",
  "berose.fr",
  "sens-public.org",
  "sciencedirect.com",
  "haitipolicy.org",
  "haitiantimes.com",
  "miamiherald.com",
  "nytimes.com",
  "bbc.com",
  "bbc.co.uk",
];

/** Domains to skip entirely (stock photos, social media, etc.). */
const SKIP_DOMAINS = [
  "pinterest.com",
  "pinterest.fr",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "youtube.com",
  "tiktok.com",
  "amazon.com",
  "ebay.com",
  "alamy.com",
  "gettyimages.com",
  "shutterstock.com",
  "istockphoto.com",
  "dreamstime.com",
  "depositphotos.com",
  "123rf.com",
  "stock.adobe.com",
  "google.com",
  "bing.com",
  "duckduckgo.com",
];

/** Minimum image URL length to be considered (avoid tracking pixels). */
const MIN_IMAGE_URL_LEN = 30;

/** Maximum number of page fetches per entry. */
const MAX_PAGE_FETCHES = 2;

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/* ── Helpers ─────────────────────────────────────────────────────────── */

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isPreferred(url: string): boolean {
  const d = getDomain(url);
  return PREFERRED_DOMAINS.some((pref) => d.includes(pref));
}

function shouldSkip(url: string): boolean {
  const d = getDomain(url);
  return (
    SKIP_DOMAINS.some((skip) => d.includes(skip)) ||
    d.includes("wikipedia.org") || // Already handled by Wikimedia resolver
    d.includes("wikimedia.org")
  );
}

function isPlausibleImageUrl(url: string): boolean {
  if (url.length < MIN_IMAGE_URL_LEN) return false;
  const lower = url.toLowerCase();
  // Reject known non-image patterns
  if (lower.includes("favicon")) return false;
  if (lower.includes("1x1")) return false;
  if (lower.includes("pixel")) return false;
  if (lower.includes("tracking")) return false;
  if (lower.includes("spacer")) return false;
  if (lower.includes("/logo")) return false;
  // Reject site-wide profile images (e.g. newspaper logo used as og:image)
  if (lower.includes("profil")) return false;
  if (lower.endsWith("logo.png") || lower.endsWith("logo.jpg")) return false;
  // Must look like an image URL or be from a known image CDN
  const hasImageExt = /\.(jpe?g|png|gif|webp|bmp|tiff?)/i.test(url);
  const isImageCdn =
    /upload\.wikimedia|cloudinary|imgix|cdn\.|images\./i.test(url);
  return hasImageExt || isImageCdn || /image|photo|img|media|thumb/i.test(url);
}

/* ── Search Engines ──────────────────────────────────────────────────── */

/**
 * Search Brave via the official API (free tier: 2,000 queries/month).
 * Set BRAVE_SEARCH_API_KEY in env to enable.
 * Returns structured results — far more reliable than HTML scraping.
 */
async function searchBraveAPI(query: string): Promise<string[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      web?: { results?: Array<{ url: string }> };
    };
    return (data.web?.results ?? []).map((r) => r.url);
  } catch {
    return [];
  }
}

/**
 * Search Brave via HTML scraping (fallback when API key isn't set).
 * Subject to aggressive rate-limiting.
 */
async function searchBraveHTML(query: string): Promise<string[]> {
  try {
    const url = `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    if (html.length < 1_000) return []; // blocked or empty

    const links: string[] = [];
    const seen = new Set<string>();
    const BRAVE_INTERNAL =
      /search\.brave\.com|brave\.com|cdn\.search\.brave|tiles\.search\.brave|imgs\.search\.brave/;

    for (const m of html.matchAll(
      /href="(https?:\/\/[^"]+)"/g,
    )) {
      const href = m[1];
      if (BRAVE_INTERNAL.test(href)) continue;
      // skip fragment-heavy reference links and anchor-only URLs
      if (href.includes("#") && href.split("#")[1].length > 0) continue;
      if (!seen.has(href)) {
        seen.add(href);
        links.push(href);
      }
    }
    return links;
  } catch {
    return [];
  }
}

/**
 * Search DuckDuckGo's HTML endpoint and return the result page URLs.
 * Returns empty array if rate-limited (caller should fall back).
 */
async function searchDDG(query: string): Promise<string[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    if (html.length < 500) return []; // rate-limited (empty/blocked response)

    const links: string[] = [];
    const seen = new Set<string>();
    const regex = /uddg=([^"&]+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      try {
        const decoded = decodeURIComponent(match[1]);
        if (decoded.startsWith("http") && !seen.has(decoded)) {
          seen.add(decoded);
          links.push(decoded);
        }
      } catch {
        // bad encoding, skip
      }
    }
    return links;
  } catch {
    return [];
  }
}

/**
 * Search Google and extract result URLs.
 * Google HTML search returns links in a few different formats.
 */
async function searchGoogle(query: string): Promise<string[]> {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=fr`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    const links: string[] = [];
    const seen = new Set<string>();

    // Google wraps organic results in various anchor patterns.
    // Pattern 1: /url?q=ENCODED_URL (older/JS-disabled Google)
    for (const m of html.matchAll(/\/url\?q=(https?:\/\/[^&"]+)/g)) {
      try {
        const decoded = decodeURIComponent(m[1]);
        if (!seen.has(decoded)) { seen.add(decoded); links.push(decoded); }
      } catch { /* skip */ }
    }

    // Pattern 2: data-href="URL" or href="https://..." in result divs
    if (links.length === 0) {
      for (const m of html.matchAll(/(?:data-href|href)="(https?:\/\/(?!www\.google|accounts\.google|support\.google|maps\.google|play\.google)[^"]+)"/g)) {
        const u = m[1];
        if (!seen.has(u)) { seen.add(u); links.push(u); }
      }
    }

    return links;
  } catch {
    return [];
  }
}

/**
 * Multi-engine search: prefers Brave API (reliable, rate-limited by quota),
 * then falls back to HTML scraping: Brave → DDG → Google.
 */
export async function searchWeb(query: string): Promise<string[]> {
  // 1. Brave Search API (best: structured JSON, no scraping)
  let results = await searchBraveAPI(query);
  if (results.length >= 2) return results;

  // 2. Brave HTML scraping fallback
  results = await searchBraveHTML(query);
  if (results.length >= 2) return results;

  // 3. DDG fallback
  results = await searchDDG(query);
  if (results.length >= 2) return results;

  // 4. Google as last resort
  results = await searchGoogle(query);
  return results;
}

/* ── Page Image Extraction ───────────────────────────────────────────── */

/**
 * Fetch a web page and extract its primary image from Open Graph / Twitter
 * Card meta tags.  Falls back to the first large <img> in the body.
 */
export async function extractPageImage(
  pageUrl: string,
): Promise<{ imageUrl: string; pageTitle?: string } | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) return null;

    const html = await res.text();

    // Detect bot-check / CAPTCHA pages (not real content)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    if (titleMatch) {
      const tLower = titleMatch.toLowerCase();
      if (
        tLower.includes("bot") ||
        tLower.includes("captcha") ||
        tLower.includes("robot") ||
        tLower.includes("verify") ||
        tLower.includes("challenge") ||
        tLower.includes("blocked") ||
        tLower.includes("access denied") ||
        tLower.includes("just a moment")
      ) {
        return null;
      }
    }

    // 1. og:image  (most common)
    const ogImage =
      html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      )?.[1] ??
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
      )?.[1];

    // 2. twitter:image
    const twImage =
      html.match(
        /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
      )?.[1] ??
      html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
      )?.[1];

    // 3. First <img> with a src that looks like a content photo
    let fallbackImg: string | null = null;
    if (!ogImage && !twImage) {
      const imgRe =
        /<img[^>]*src=["']([^"']{30,})["'][^>]*(?:width=["'](\d+))?/gi;
      let imgMatch: RegExpExecArray | null;
      while ((imgMatch = imgRe.exec(html)) !== null) {
        const src = imgMatch[1];
        const width = imgMatch[2] ? parseInt(imgMatch[2], 10) : 0;
        if (isPlausibleImageUrl(src) && (width === 0 || width >= 200)) {
          fallbackImg = src;
          break;
        }
      }
    }

    const rawUrl = ogImage ?? twImage ?? fallbackImg;
    if (!rawUrl || !isPlausibleImageUrl(rawUrl)) return null;

    // Resolve relative URLs
    const imageUrl = rawUrl.startsWith("http")
      ? rawUrl
      : new URL(rawUrl, pageUrl).toString();

    return { imageUrl, pageTitle: titleMatch };
  } catch {
    return null;
  }
}

/* ── High-level resolver ─────────────────────────────────────────────── */

/**
 * Resolve a web image for a Haitian history event:
 *  1. Build search queries from the title
 *  2. Search DDG → Google (multi-engine fallback)
 *  3. Prioritise preferred domains
 *  4. Extract og:image from top pages
 */
export async function resolveWebImage(
  titleFr: string,
  year?: number | null,
): Promise<WebImageResult | null> {
  const queries = [
    `${titleFr} Haiti histoire`,
    year ? `${titleFr} Haiti ${year}` : `${titleFr} Haiti`,
  ];

  for (const query of queries) {
    const resultUrls = await searchWeb(query);

    // Remove skip domains, dedupe
    const filtered = resultUrls.filter((u) => !shouldSkip(u));

    // Sort: preferred domains first
    const preferred = filtered.filter((u) => isPreferred(u));
    const others = filtered.filter((u) => !isPreferred(u));
    const ordered = [...preferred, ...others].slice(0, MAX_PAGE_FETCHES);

    for (const url of ordered) {
      const result = await extractPageImage(url);
      if (result) {
        return {
          imageUrl: result.imageUrl,
          pageUrl: url,
          pageTitle: result.pageTitle,
          sourceDomain: getDomain(url),
        };
      }
    }
  }

  return null;
}
