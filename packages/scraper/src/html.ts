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
 * Extract the publisher image URL from HTML meta tags.
 *
 * Checks og:image, twitter:image, and twitter:image:src in that order.
 * Resolves relative URLs against baseUrl. Returns null if no valid image found.
 */
export function extractPublisherImage(
  html: string,
  baseUrl: string,
): string | null {
  const $ = cheerio.load(html);

  const candidates = [
    $('meta[property="og:image"]').attr("content"),
    $('meta[name="twitter:image"]').attr("content"),
    $('meta[name="twitter:image:src"]').attr("content"),
    $('meta[property="og:image:url"]').attr("content"),
  ];

  for (const raw of candidates) {
    if (!raw?.trim()) continue;
    const src = raw.trim();

    // Skip tiny placeholders, data URIs, and SVGs
    if (src.startsWith("data:")) continue;
    if (src.endsWith(".svg")) continue;

    try {
      const resolved = src.startsWith("http") ? src : new URL(src, baseUrl).toString();
      return resolved;
    } catch {
      // URL resolution failed, try next candidate
    }
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
