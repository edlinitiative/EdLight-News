import { fetch } from "undici";
import * as cheerio from "cheerio";

export interface HTMLItem {
  title: string;
  url: string;
  description: string;
}

export interface ExtractedArticle {
  title: string;
  text: string;
  publishedAt: Date | null;
  canonicalUrl: string;
  /** Publisher image URL from og:image / twitter:image meta tags */
  publisherImageUrl: string | null;
  /** Publisher image confidence 0-1 */
  publisherImageConfidence: number;
}

// ── Candidate image types ─────────────────────────────────────────────────
export type CandidateKind = "og" | "twitter" | "jsonld" | "rss" | "body";

export interface CandidateImage {
  url: string;
  kind: CandidateKind;
  /** 0-1 hint for how reliable this source typically is */
  scoreHint: number;
  /** If srcset provided the width, record it here */
  width?: number;
}

export interface PickedImage {
  url: string | null;
  confidence: number;
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; EdLight-News/1.0; +https://edlight.org) AppleWebKit/537.36";

// ── Junk image patterns ───────────────────────────────────────────────────
const JUNK_PATTERNS = [
  "avatar", "icon", "logo", "emoji", "gravatar", "spinner",
  "placeholder", "ad-", "/ads/", "pixel", "badge", "button",
  "sprite", "tracking", "1x1", "spacer",
];

/**
 * Fetch raw HTML from a URL.
 */
export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }

  return res.text();
}

/**
 * Scrape a web page by CSS selector and return extracted items.
 */
export async function scrapeHTML(
  pageUrl: string,
  selector: string,
): Promise<HTMLItem[]> {
  const html = await fetchHtml(pageUrl);
  const $ = cheerio.load(html);
  const items: HTMLItem[] = [];

  $(selector).each((_i, el) => {
    const $el = $(el);
    const anchor = $el.find("a").first();
    const title =
      anchor.text().trim() ||
      $el.find("h1,h2,h3,h4").first().text().trim();
    const href = anchor.attr("href") ?? "";
    const url = href.startsWith("http")
      ? href
      : new URL(href, pageUrl).toString();
    const description = $el.find("p").first().text().trim();

    if (title && url) {
      items.push({ title, url, description });
    }
  });

  return items;
}

/**
 * Parse a list/index page and return article URLs.
 */
export function parseListPage(
  html: string,
  listItemSelector: string,
  baseUrl: string,
): string[] {
  const $ = cheerio.load(html);
  const urls: string[] = [];

  $(listItemSelector).each((_i, el) => {
    const href = $(el).find("a").first().attr("href") ?? $(el).attr("href");
    if (!href) return;
    const resolved = href.startsWith("http")
      ? href
      : new URL(href, baseUrl).toString();
    if (!urls.includes(resolved)) {
      urls.push(resolved);
    }
  });

  return urls;
}

// ── Image candidate extraction ────────────────────────────────────────────

/**
 * Extract all candidate images from HTML using multiple strategies.
 * Returns an array of candidates sorted by scoreHint descending.
 */
export function extractCandidateImages(
  html: string,
  baseUrl: string,
): CandidateImage[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const candidates: CandidateImage[] = [];

  function addCandidate(raw: string | undefined | null, kind: CandidateKind, scoreHint: number, width?: number) {
    const url = resolveImageUrl(raw, baseUrl);
    if (!url || seen.has(url)) return;
    if (isJunkImage(url)) return;
    seen.add(url);
    candidates.push({ url, kind, scoreHint, width });
  }

  // ── Strategy 1: Open Graph meta tags ──────────────────────────────────
  addCandidate($('meta[property="og:image"]').attr("content"), "og", 0.95);
  addCandidate($('meta[property="og:image:secure_url"]').attr("content"), "og", 0.93);
  addCandidate($('meta[property="og:image:url"]').attr("content"), "og", 0.91);

  // ── Strategy 2: Twitter Card meta tags ────────────────────────────────
  addCandidate($('meta[name="twitter:image"]').attr("content"), "twitter", 0.90);
  addCandidate($('meta[name="twitter:image:src"]').attr("content"), "twitter", 0.88);

  // ── Strategy 3: link rel="image_src" ──────────────────────────────────
  addCandidate($('link[rel="image_src"]').attr("href"), "og", 0.85);

  // ── Strategy 4: JSON-LD structured data ───────────────────────────────
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const ld = JSON.parse($(el).html() ?? "");
      const items = Array.isArray(ld) ? ld : [ld];
      for (const item of items) {
        const nodes: Record<string, unknown>[] = item["@graph"] ? item["@graph"] : [item];

        // Build @id lookup map so we can resolve cross-references
        // (e.g. WordPress Yoast "#primaryimage" → actual ImageObject node)
        const idMap = new Map<string, Record<string, unknown>>();
        for (const n of nodes) {
          if (n && typeof n["@id"] === "string") idMap.set(n["@id"], n);
        }

        /** Resolve a JSON-LD field that may be an @id reference. */
        const resolveRef = (field: unknown): unknown => {
          if (!field || typeof field !== "object" || Array.isArray(field)) return field;
          const obj = field as Record<string, unknown>;
          if (typeof obj["@id"] === "string" && Object.keys(obj).length <= 2) {
            // Looks like a reference — resolve it
            return idMap.get(obj["@id"]) ?? field;
          }
          return field;
        };

        for (const node of nodes) {
          if (!node) continue;
          // Resolve @id references before extracting image URLs
          const imgField = resolveRef(node.image)
            ?? node.thumbnailUrl
            ?? (resolveRef((node.primaryImageOfPage as Record<string, unknown>)?.url
                ?? node.primaryImageOfPage));
          const ldUrl = extractImageFromLd(imgField, baseUrl);
          if (ldUrl && !seen.has(ldUrl) && !isJunkImage(ldUrl)) {
            seen.add(ldUrl);
            candidates.push({ url: ldUrl, kind: "jsonld", scoreHint: 0.87 });
          }
        }
      }
    } catch {
      // Malformed JSON-LD — skip
    }
  }

  // ── Strategy 5: Article body images ───────────────────────────────────
  const articleSelectors = [
    "article",
    '[role="main"]',
    ".post-content",
    ".entry-content",
    ".article-body",
    ".story-body",
    "main",
    ".content",
  ];

  for (const sel of articleSelectors) {
    const container = $(sel).first();
    if (!container.length) continue;

    for (const img of container.find("img").toArray()) {
      const src =
        $(img).attr("src") ||
        $(img).attr("data-src") ||
        $(img).attr("data-lazy-src");

      // Check for srcset and parse largest image
      const srcset = $(img).attr("srcset");
      const srcsetResult = parseSrcsetLargest(srcset, baseUrl);

      const imgWidth = parseInt($(img).attr("width") ?? "0", 10);
      const imgHeight = parseInt($(img).attr("height") ?? "0", 10);

      // Skip tiny images
      if ((imgWidth > 0 && imgWidth < 200) || (imgHeight > 0 && imgHeight < 150)) continue;

      // Prefer srcset largest; fall back to src
      if (srcsetResult) {
        addCandidate(srcsetResult.url, "body", 0.65, srcsetResult.width);
      }
      addCandidate(src, "body", 0.55, imgWidth > 0 ? imgWidth : undefined);
    }

    // Only process the first matching container
    break;
  }

  // Sort by scoreHint descending
  candidates.sort((a, b) => b.scoreHint - a.scoreHint);
  return candidates;
}

/**
 * Pick the best image from a list of candidates.
 * Returns the URL and a confidence score (0-1).
 */
export function pickBestImage(candidates: CandidateImage[]): PickedImage {
  if (candidates.length === 0) {
    return { url: null, confidence: 0 };
  }

  // Already sorted by scoreHint; refine with heuristics
  let bestCandidate = candidates[0]!;
  let bestScore = bestCandidate.scoreHint;

  for (const c of candidates) {
    let score = c.scoreHint;

    // Boost for size hints in URL
    const lower = c.url.toLowerCase();
    if (/(?:1200|1024|large|full|hero|featured)/i.test(lower)) {
      score += 0.05;
    }

    // Boost if srcset reported a large width
    if (c.width && c.width >= 800) {
      score += 0.08;
    } else if (c.width && c.width >= 600) {
      score += 0.04;
    }

    // Slight penalty for very long URLs (often tracking / ad URLs)
    if (c.url.length > 500) {
      score -= 0.05;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = c;
    }
  }

  // Clamp confidence to 0-1
  const confidence = Math.min(1, Math.max(0, bestScore));
  return { url: bestCandidate.url, confidence };
}

/**
 * Legacy wrapper — extract the best publisher image URL from HTML.
 * Calls extractCandidateImages + pickBestImage under the hood.
 */
export function extractPublisherImage(
  html: string,
  baseUrl: string,
): string | null {
  const candidates = extractCandidateImages(html, baseUrl);
  const picked = pickBestImage(candidates);
  return picked.url;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Resolve and validate a candidate image URL. Returns null if invalid. */
function resolveImageUrl(raw: string | undefined | null, baseUrl: string): string | null {
  if (!raw?.trim()) return null;
  const src = raw.trim();

  // Skip data URIs, SVGs, and tiny placeholders
  if (src.startsWith("data:")) return null;
  if (src.endsWith(".svg")) return null;
  if (src.endsWith(".gif") && src.includes("1x1")) return null;

  try {
    const resolved = src.startsWith("http") ? src : new URL(src, baseUrl).toString();
    // Reject URLs with fragment identifiers — they point to page anchors,
    // not image resources (e.g. WordPress Yoast "#primaryimage" refs).
    if (resolved.includes("#")) return null;
    return resolved;
  } catch {
    return null;
  }
}

/** Check if a URL looks like a junk/non-content image. */
function isJunkImage(url: string): boolean {
  const lower = url.toLowerCase();
  return JUNK_PATTERNS.some((p) => lower.includes(p));
}

/** Extract an image URL from a JSON-LD image field (string, object, or array).
 *  NOTE: We intentionally do NOT fall back to obj["@id"] — in JSON-LD, @id is a
 *  cross-reference identifier (e.g. WordPress Yoast "#primaryimage"), not a
 *  content URL.  Use the @graph resolver below for @id references. */
function extractImageFromLd(
  field: unknown,
  baseUrl: string,
): string | null {
  if (!field) return null;
  if (typeof field === "string") return resolveImageUrl(field, baseUrl);
  if (Array.isArray(field)) {
    for (const item of field) {
      const url = extractImageFromLd(item, baseUrl);
      if (url) return url;
    }
    return null;
  }
  if (typeof field === "object" && field !== null) {
    const obj = field as Record<string, unknown>;
    // Only use url / contentUrl — never @id (it's an identifier, not a resource)
    return resolveImageUrl(
      (obj.url ?? obj.contentUrl) as string | undefined,
      baseUrl,
    );
  }
  return null;
}

/** Parse a srcset attribute and return the largest image URL + width. */
function parseSrcsetLargest(
  srcset: string | undefined | null,
  baseUrl: string,
): { url: string; width: number } | null {
  if (!srcset) return null;

  let bestUrl: string | null = null;
  let bestWidth = 0;

  // srcset format: "url 300w, url 600w, ..."
  for (const part of srcset.split(",")) {
    const tokens = part.trim().split(/\s+/);
    if (tokens.length < 2) continue;
    const url = resolveImageUrl(tokens[0], baseUrl);
    if (!url) continue;

    const descriptor = tokens[1]!;
    const widthMatch = descriptor.match(/^(\d+)w$/);
    if (widthMatch) {
      const w = parseInt(widthMatch[1]!, 10);
      if (w > bestWidth) {
        bestWidth = w;
        bestUrl = url;
      }
    }
  }

  return bestUrl ? { url: bestUrl, width: bestWidth } : null;
}

/**
 * Fetch an article page and extract its main content.
 */
export async function extractArticleContent(
  url: string,
  selectors?: { articleBody?: string; title?: string },
): Promise<ExtractedArticle> {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  // Remove noise
  $("script, style, nav, footer, aside, header, .sidebar, .comments, .ad, .advertisement").remove();

  // Title
  let title = "";
  if (selectors?.title) {
    title = $(selectors.title).first().text().trim();
  }
  if (!title) {
    title =
      $("h1").first().text().trim() ||
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $("title").text().trim() ||
      "";
  }

  // Body text
  let text = "";
  if (selectors?.articleBody) {
    text = $(selectors.articleBody).first().text().trim();
  }
  if (!text) {
    const articleSelectors = [
      "article",
      '[role="main"]',
      ".post-content",
      ".entry-content",
      ".article-body",
      ".story-body",
      "main",
    ];
    for (const sel of articleSelectors) {
      const found = $(sel).first().text().trim();
      if (found && found.length > 100) {
        text = found;
        break;
      }
    }
  }
  if (!text) {
    text = $("body").text().trim();
  }

  // Clean up whitespace
  text = text.replace(/\s{2,}/g, " ").trim();
  if (text.length > 10_000) {
    text = text.slice(0, 10_000) + "…";
  }

  // Published date
  let publishedAt: Date | null = null;
  const dateStr =
    $('meta[property="article:published_time"]').attr("content") ||
    $("time").attr("datetime") ||
    $('[itemprop="datePublished"]').attr("content");
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) publishedAt = d;
  }

  // Canonical URL
  const canonicalUrl =
    $('link[rel="canonical"]').attr("href") ||
    $('meta[property="og:url"]').attr("content") ||
    url;

  // Publisher image — extract using the candidate system
  const candidates = extractCandidateImages(html, url);
  const picked = pickBestImage(candidates);

  return {
    title,
    text,
    publishedAt,
    canonicalUrl,
    publisherImageUrl: picked.url,
    publisherImageConfidence: picked.confidence,
  };
}
