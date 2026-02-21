/**
 * @edlight-news/renderer
 *
 * Generates branded card images for articles using Playwright.
 * Falls back gracefully if Chromium is unavailable.
 */

import type { ContentVersion, Asset, ItemCategory } from "@edlight-news/types";
import { chromium, type Browser } from "playwright-core";

// ── Category → gradient mapping ───────────────────────────────────────────
const CATEGORY_GRADIENTS: Record<string, string> = {
  scholarship: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
  opportunity: "linear-gradient(135deg, #6d28d9 0%, #db2777 100%)",
  news:        "linear-gradient(135deg, #0f766e 0%, #1e40af 100%)",
  event:       "linear-gradient(135deg, #c2410c 0%, #b91c1c 100%)",
  resource:    "linear-gradient(135deg, #15803d 0%, #0369a1 100%)",
  local_news:  "linear-gradient(135deg, #b91c1c 0%, #1e3a8a 100%)",
};
const DEFAULT_GRADIENT = "linear-gradient(135deg, #1e3a5f 0%, #2c1654 100%)";

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

async function getBrowser(): Promise<Browser> {
  if (_browser?.isConnected()) return _browser;

  // Try common Chromium paths — Cloud Run, Debian, Alpine, macOS
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

  // Last resort: let playwright-core try to find a browser
  _browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
  return _browser;
}

/**
 * Build the branded card HTML string.
 * 1080×1080 card with gradient, category pill, title, source, and EdLight branding.
 */
function buildBrandedCardHTML(opts: {
  title: string;
  category?: string;
  sourceName?: string;
  date?: string;
}): string {
  const gradient = CATEGORY_GRADIENTS[opts.category ?? ""] ?? DEFAULT_GRADIENT;
  const catLabel = CATEGORY_LABELS[opts.category ?? ""] ?? "";
  const source = opts.sourceName ?? "";
  const date = opts.date ?? "";
  const metaParts = [source, date].filter(Boolean).join(" · ");

  // Truncate title to ~160 chars to prevent overflow
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
    width: 1080px;
    height: 1080px;
    font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: ${gradient};
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 80px;
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
    font-size: 22px;
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
    font-size: 54px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.5px;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
    max-height: 520px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 7;
    -webkit-box-orient: vertical;
  }
  .bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .meta {
    font-size: 22px;
    opacity: 0.75;
    max-width: 650px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .brand {
    font-size: 30px;
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
}

/**
 * Render a 1080×1080 branded card PNG for an article.
 * Returns a Buffer containing the PNG image data.
 *
 * @throws if Chromium cannot be launched.
 */
export async function renderBrandedCardPNG(
  opts: BrandedCardOptions,
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage({
    viewport: { width: 1080, height: 1080 },
  });

  try {
    const html = buildBrandedCardHTML(opts);
    await page.setContent(html, { waitUntil: "load" });
    const buffer = await page.screenshot({ type: "png" });
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

// ── Legacy placeholders (kept for backwards compat) ───────────────────────

export async function renderCarousel(
  _contentVersion: ContentVersion,
): Promise<Omit<Asset, "id" | "createdAt">[]> {
  throw new Error("renderCarousel not yet implemented");
}

export async function renderStory(
  _contentVersion: ContentVersion,
): Promise<Omit<Asset, "id" | "createdAt"> | null> {
  throw new Error("renderStory not yet implemented");
}
