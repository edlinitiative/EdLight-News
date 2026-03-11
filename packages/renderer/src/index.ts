/**
 * @edlight-news/renderer
 *
 * Generates branded card images and captures article screenshots using Playwright.
 * Falls back gracefully if Chromium is unavailable.
 */

import type { ContentVersion, Asset, ItemCategory } from "@edlight-news/types";
import { chromium, type Browser } from "playwright-core";

// ── Category → gradient mapping ───────────────────────────────────────────
const CATEGORY_GRADIENTS: Record<string, string> = {
  scholarship: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
  opportunity: "linear-gradient(135deg, #78350f 0%, #92400e 100%)",
  news:        "linear-gradient(135deg, #0f766e 0%, #134e4a 100%)",
  event:       "linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)",
  resource:    "linear-gradient(135deg, #14532d 0%, #0f766e 100%)",
  local_news:  "linear-gradient(135deg, #7f1d1d 0%, #1e3a8a 100%)",
};
const DEFAULT_GRADIENT = "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";

// ── Category labels (French) ──────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  scholarship: "Bourse",
  opportunity: "Opportunité",
  news:        "Actualité",
  event:       "Événement",
  resource:    "Ressource",
  local_news:  "Haïti",
};

// ── Shared browser instance (reused across calls within same process) ─────
let _browser: Browser | null = null;

/** Shared browser instance — exported so ig-carousel.ts can reuse it. */
export async function getBrowserInstance(): Promise<Browser> {
  return getBrowser();
}

async function getBrowser(): Promise<Browser> {
  if (_browser?.isConnected()) return _browser;

  const executablePaths = [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ].filter(Boolean) as string[];

  for (const executablePath of executablePaths) {
    try {
      _browser = await chromium.launch({
        executablePath,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });
      return _browser;
    } catch {
      // Try next path
    }
  }

  _browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  return _browser;
}

// ── Branded card sizes ────────────────────────────────────────────────────
export type BrandedCardSize = "landscape" | "square" | "portrait";

const SIZE_DIMS: Record<BrandedCardSize, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
};

/**
 * Build the branded card HTML string.
 * Supports 1200×630 (landscape), 1080×1080 (square), and 1080×1350 (portrait / IG 4:5).
 */
function buildBrandedCardHTML(opts: {
  title: string;
  category?: string;
  sourceName?: string;
  date?: string;
  size: BrandedCardSize;
}): string {
  const { width, height } = SIZE_DIMS[opts.size];
  const gradient = CATEGORY_GRADIENTS[opts.category ?? ""] ?? DEFAULT_GRADIENT;
  const catLabel = CATEGORY_LABELS[opts.category ?? ""] ?? "";
  const source = opts.sourceName ?? "";
  const date = opts.date ?? "";
  const metaParts = [source, date].filter(Boolean).join(" · ");

  const isLandscape = opts.size === "landscape";
  const padding = isLandscape ? 60 : 80;
  const catFontSize = isLandscape ? 18 : 22;
  const titleFontSize = isLandscape ? 42 : 54;
  const titleMaxClamp = isLandscape ? 5 : 7;
  const metaFontSize = isLandscape ? 18 : 22;
  const brandFontSize = isLandscape ? 24 : 30;

  const title =
    opts.title.length > 160
      ? opts.title.slice(0, 157) + "…"
      : opts.title;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${width}px;
    height: ${height}px;
    font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: ${gradient};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: ${padding}px;
    color: white;
    overflow: hidden;
  }
  .top {
    display: flex;
    align-items: flex-start;
  }
  .category {
    display: inline-block;
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(8px);
    border-radius: 24px;
    padding: 10px 24px;
    font-size: ${catFontSize}px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
  .middle {
    flex: 1;
    display: flex;
    align-items: center;
  }
  .title {
    font-size: ${titleFontSize}px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.5px;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: ${titleMaxClamp};
    -webkit-box-orient: vertical;
  }
  .bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .meta {
    font-size: ${metaFontSize}px;
    opacity: 0.75;
    max-width: 650px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .brand {
    font-size: ${brandFontSize}px;
    font-weight: 800;
    opacity: 0.9;
    letter-spacing: 0.5px;
  }
  .brand span {
    color: #facc15;
  }
</style>
</head>
<body>
  <div class="top">
    ${catLabel ? `<span class="category">${escapeHtml(catLabel)}</span>` : ""}
  </div>
  <div class="middle">
    <div class="title">${escapeHtml(title)}</div>
  </div>
  <div class="bottom">
    <div class="meta">${escapeHtml(metaParts)}</div>
    <div class="brand">Ed<span>Light</span> News</div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Public API ────────────────────────────────────────────────────────────

export interface BrandedCardOptions {
  title: string;
  category?: ItemCategory;
  sourceName?: string;
  date?: string;
  /** Default: "square" (1080×1080) for backwards compat */
  size?: BrandedCardSize;
}

/**
 * Render a branded card PNG for an article.
 * Returns a Buffer containing the PNG image data.
 *
 * @throws if Chromium cannot be launched.
 */
export async function renderBrandedCardPNG(
  opts: BrandedCardOptions,
): Promise<Buffer> {
  const size = opts.size ?? "square";
  const { width, height } = SIZE_DIMS[size];
  const browser = await getBrowser();
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });

  try {
    const html = buildBrandedCardHTML({ ...opts, size });
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    const buffer = await page.screenshot({ type: "png", timeout: 60_000 });
    return Buffer.from(buffer);
  } finally {
    await page.close();
  }
}

/**
 * Gracefully close the shared browser instance.
 * Call this during worker shutdown.
 */
export async function closeBrowser(): Promise<void> {
  if (_browser?.isConnected()) {
    await _browser.close();
    _browser = null;
  }
}

// ── Smart screenshot (article element, not full page) ─────────────────────

/** Selectors to try when looking for the article hero/header area */
const ARTICLE_CONTAINER_SELECTORS = [
  "article header",
  "article .post-thumbnail",
  "article .featured-image",
  ".entry-header",
  ".post-header",
  ".article-header",
  ".hero-image",
  "[class*='hero']",
  "article",
  '[role="main"]',
  "main",
];

/** Selectors for overlay/popup elements that should be hidden */
const OVERLAY_SELECTORS = [
  '[class*="cookie"]', '[class*="Cookie"]',
  '[class*="consent"]', '[class*="Consent"]',
  '[class*="popup"]', '[class*="Popup"]',
  '[class*="modal"]', '[class*="Modal"]',
  '[class*="overlay"]', '[class*="Overlay"]',
  '[class*="banner"]', '[id*="cookie"]',
  '[id*="consent"]', '[id*="popup"]',
];

/**
 * Navigate to a URL and capture a smart screenshot of the article area.
 *
 * Strategy:
 * 1. Try to find a large <img> element inside the article and screenshot it.
 * 2. Fall back to screenshotting the article container element.
 * 3. Last resort: clip the top 1200×630 of the viewport.
 *
 * Returns a PNG Buffer, or null if the page fails to load.
 */
export async function screenshotArticleImage(
  url: string,
): Promise<{ buffer: Buffer; width: number; height: number } | null> {
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage({
      viewport: { width: 1200, height: 800 },
    });

    // Block unnecessary resources
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["font", "media", "websocket"].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });

    // Wait for lazy images and client-rendered content
    await page.waitForTimeout(2_500);

    // Remove overlay elements
    await page.evaluate((selectors: string[]) => {
      for (const sel of selectors) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).document.querySelectorAll(sel).forEach((el: any) => {
          el.style.display = "none";
        });
      }
    }, OVERLAY_SELECTORS);

    // ── Strategy 1: Find a large hero image element ─────────────────────
    const heroImg = await page.evaluate(() => {
      const doc = (globalThis as any).document;

      // Look for large images inside article-like containers first
      const containers = doc.querySelectorAll(
        "article, [role='main'], main, .content, .post-content, .entry-content"
      );
      const allImages: any[] = [];

      for (const c of containers) {
        allImages.push(...Array.from(c.querySelectorAll("img")));
      }
      // Also check top-level hero patterns
      const heroSelectors = [
        ".hero-image img",
        ".featured-image img",
        ".post-thumbnail img",
        "[class*='hero'] img",
        "figure img",
      ];
      for (const sel of heroSelectors) {
        allImages.push(...Array.from(doc.querySelectorAll(sel)));
      }

      // Find the first image that is visually large
      for (const img of allImages) {
        const rect = img.getBoundingClientRect();
        if (rect.width >= 400 && rect.height >= 200 && rect.top < 1200) {
          return {
            found: true,
            x: Math.max(0, rect.x),
            y: Math.max(0, rect.y),
            width: Math.min(rect.width, 1200),
            height: Math.min(rect.height, 800),
          };
        }
      }
      return { found: false, x: 0, y: 0, width: 0, height: 0 };
    });

    if (heroImg.found && heroImg.width > 0 && heroImg.height > 0) {
      const buffer = await page.screenshot({
        type: "png",
        timeout: 30_000,
        clip: {
          x: heroImg.x,
          y: heroImg.y,
          width: heroImg.width,
          height: heroImg.height,
        },
      });
      return {
        buffer: Buffer.from(buffer),
        width: Math.round(heroImg.width),
        height: Math.round(heroImg.height),
      };
    }

    // ── Strategy 2: Screenshot article container element ────────────────
    for (const sel of ARTICLE_CONTAINER_SELECTORS) {
      const el = await page.$(sel);
      if (!el) continue;

      const box = await el.boundingBox();
      if (!box || box.width < 300 || box.height < 200) continue;

      // Clip to reasonable max dimensions
      const clipW = Math.min(box.width, 1200);
      const clipH = Math.min(box.height, 630);
      const buffer = await page.screenshot({
        type: "png",
        timeout: 30_000,
        clip: {
          x: box.x,
          y: box.y,
          width: clipW,
          height: clipH,
        },
      });
      return {
        buffer: Buffer.from(buffer),
        width: Math.round(clipW),
        height: Math.round(clipH),
      };
    }

    // ── Strategy 3: Fallback to viewport crop ───────────────────────────
    const buffer = await page.screenshot({
      type: "png",
      timeout: 30_000,
      clip: { x: 0, y: 0, width: 1200, height: 630 },
    });
    return { buffer: Buffer.from(buffer), width: 1200, height: 630 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[renderer] screenshot failed for ${url}: ${msg}`);
    return null;
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
  }
}

/**
 * @deprecated Use screenshotArticleImage instead. Kept for backwards compat.
 */
export async function screenshotHeroImage(
  url: string,
): Promise<Buffer | null> {
  const result = await screenshotArticleImage(url);
  return result?.buffer ?? null;
}

// ── Legacy placeholders (kept for backwards compat) ───────────────────────

export async function renderCarousel(
  _contentVersion: ContentVersion,
): Promise<Omit<Asset, "id" | "createdAt">[]> {
  throw new Error("renderCarousel not yet implemented");
}

// Re-export the new story renderer for convenience
export { generateStoryAssets, buildStorySlideHTML } from "./ig-story.js";
