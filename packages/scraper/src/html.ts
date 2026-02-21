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
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; EdLight-News/1.0; +https://edlight.org) AppleWebKit/537.36";

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
 *
 * @param pageUrl - The URL to fetch
 * @param selector - CSS selector that matches repeating item containers
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
 *
 * @param html - Raw HTML string
 * @param listItemSelector - CSS selector for link containers
 * @param baseUrl - Base URL for resolving relative hrefs
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

/**
 * Extract the best article image URL from HTML.
 *
 * Multi-strategy approach (in priority order):
 * 1. Open Graph / Twitter Card meta tags
 * 2. JSON-LD schema.org image
 * 3. First large image inside the article body
 *
 * Resolves relative URLs against baseUrl. Returns null if no valid image found.
 */
export function extractPublisherImage(
  html: string,
  baseUrl: string,
): string | null {
  const $ = cheerio.load(html);

  // ── Strategy 1: Meta tags (og:image, twitter:image) ──────────────────
  const metaCandidates = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[property="og:image:secure_url"]').attr("content"),
    $('meta[property="og:image:url"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('meta[name="twitter:image:src"]').attr("content"),
    $('link[rel="image_src"]').attr("href"),
  ];

  for (const raw of metaCandidates) {
    const url = resolveImageUrl(raw, baseUrl);
    if (url) return url;
  }

  // ── Strategy 2: JSON-LD structured data ───────────────────────────────
  $('script[type="application/ld+json"]').each((_i, el) => {
    // Return early handled below
  });

  for (const el of $('script[type="application/ld+json"]').toArray()) {
    try {
      const ld = JSON.parse($(el).html() ?? "");
      const items = Array.isArray(ld) ? ld : [ld];
      for (const item of items) {
        // Handle @graph pattern (WordPress, etc.)
        const nodes = item["@graph"] ? item["@graph"] : [item];
        for (const node of nodes) {
          if (!node) continue;
          // Look for image on Article, NewsArticle, BlogPosting, WebPage types
          const imgField =
            node.image ?? node.thumbnailUrl ?? node.primaryImageOfPage?.url;
          const imgUrl = extractImageFromLd(imgField, baseUrl);
          if (imgUrl) return imgUrl;
        }
      }
    } catch {
      // Malformed JSON-LD — skip
    }
  }

  // ── Strategy 3: First large image in article body ─────────────────────
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
      const src = $(img).attr("src") || $(img).attr("data-src") || $(img).attr("data-lazy-src");
      const url = resolveImageUrl(src, baseUrl);
      if (!url) continue;

      // Skip tiny images (icons, avatars, tracking pixels)
      const width = parseInt($(img).attr("width") ?? "0", 10);
      const height = parseInt($(img).attr("height") ?? "0", 10);
      if ((width > 0 && width < 200) || (height > 0 && height < 150)) continue;

      // Skip common non-content image patterns
      const lower = url.toLowerCase();
      if (
        lower.includes("avatar") ||
        lower.includes("icon") ||
        lower.includes("logo") ||
        lower.includes("emoji") ||
        lower.includes("gravatar") ||
        lower.includes("spinner") ||
        lower.includes("placeholder") ||
        lower.includes("ad-") ||
        lower.includes("/ads/") ||
        lower.includes("pixel") ||
        lower.includes("badge") ||
        lower.includes("button")
      ) continue;

      return url;
    }
  }

  return null;
}

/** Resolve and validate a candidate image URL. Returns null if invalid. */
function resolveImageUrl(raw: string | undefined | null, baseUrl: string): string | null {
  if (!raw?.trim()) return null;
  const src = raw.trim();

  // Skip data URIs, SVGs, and tiny placeholders
  if (src.startsWith("data:")) return null;
  if (src.endsWith(".svg")) return null;
  if (src.endsWith(".gif") && src.includes("1x1")) return null;

  try {
    return src.startsWith("http") ? src : new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
}

/** Extract an image URL from a JSON-LD image field (string, object, or array). */
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
    return resolveImageUrl(
      (obj.url ?? obj.contentUrl ?? obj["@id"]) as string | undefined,
      baseUrl,
    );
  }
  return null;
}

/**
 * Fetch an article page and extract its main content.
 *
 * Uses simple heuristics: <article>, role="main", .post-content, .entry-content,
 * or falls back to <body>. Strips nav, footer, aside, script, style.
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
    // Try common article selectors
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

  // Clean up whitespace: collapse runs of whitespace/newlines
  text = text.replace(/\s{2,}/g, " ").trim();

  // Truncate extremely long articles to ~10k chars to avoid blowing LLM context
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

  // Publisher image — extract before removing noise (meta tags may be stripped)
  // We re-parse from the original HTML to ensure meta tags are present
  const publisherImageUrl = extractPublisherImage(html, url);

  return { title, text, publishedAt, canonicalUrl, publisherImageUrl };
}
