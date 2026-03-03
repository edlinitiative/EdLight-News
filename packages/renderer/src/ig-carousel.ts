/**
 * @edlight-news/renderer – IG Carousel asset generation
 *
 * Generates carousel slide images or dry-run JSON+HTML exports.
 * Reuses the existing branded card pipeline when Chromium is available.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IGSlide, IGFormattedPayload, IGQueueItem, IGMemeSlide } from "@edlight-news/types";
import { buildMemeSlideHTML } from "./ig-meme.js";

// ── Premium design system ─────────────────────────────────────────────────

const IG_TYPE_ACCENTS: Record<string, string> = {
  scholarship: "#3b82f6",
  opportunity: "#8b5cf6",
  news:        "#14b8a6",
  histoire:    "#d97706",
  utility:     "#10b981",
};

const IG_TYPE_DARKS: Record<string, string> = {
  scholarship: "#060d1f",
  opportunity: "#0b0814",
  news:        "#061014",
  histoire:    "#120b06",
  utility:     "#060f0b",
};

const IG_TYPE_LABELS: Record<string, string> = {
  scholarship: "BOURSE",
  opportunity: "OPPORTUNITÉ",
  news:        "ACTUALITÉ",
  histoire:    "HISTOIRE",
  utility:     "GUIDE",
};

const FONT_STACK = "'Inter', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build HTML for a single IG carousel slide (1080×1080).
 *
 * - Cover slides (with backgroundImage): full-bleed editorial photo layout
 * - Content slides: dark background with accent bar
 */
export function buildSlideHTML(
  slide: IGSlide,
  igType: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = IG_TYPE_ACCENTS[igType] ?? "#3b82f6";
  const dark = IG_TYPE_DARKS[igType] ?? "#060d1f";
  const label = IG_TYPE_LABELS[igType] ?? "";
  const hasImage = !!slide.backgroundImage;
  const bulletsHtml = slide.bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join("\n");

  if (hasImage) return buildCoverSlideHTML(slide, label, accent, dark, bulletsHtml, slideIndex, totalSlides);
  return buildContentSlideHTML(slide, label, accent, dark, bulletsHtml, slideIndex, totalSlides);
}

/* ── Cover slide: full-bleed image, bottom-weighted text ───────────────── */

function buildCoverSlideHTML(
  slide: IGSlide, label: string, accent: string, dark: string,
  bulletsHtml: string, slideIndex: number, totalSlides: number,
): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1080px;
  font-family: ${FONT_STACK};
  background: ${dark} url('${slide.backgroundImage}') center/cover no-repeat;
  color:#fff; overflow:hidden; position:relative;
}
.overlay {
  position:absolute; inset:0;
  background: linear-gradient(180deg,
    rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.30) 35%, rgba(0,0,0,0.78) 100%);
}
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:72px 80px; }
.top { display:flex; justify-content:space-between; align-items:center; }
.lbl { font-size:15px; font-weight:600; text-transform:uppercase; letter-spacing:3.5px; opacity:0.85; }
.lbl::before { content:''; display:inline-block; width:8px; height:8px; background:${accent}; border-radius:50%; margin-right:10px; vertical-align:middle; }
.pg { font-size:14px; font-weight:500; opacity:0.4; letter-spacing:1px; }
.h { font-size:54px; font-weight:700; line-height:1.1; letter-spacing:-0.5px; text-shadow:0 2px 24px rgba(0,0,0,0.5); margin-bottom:20px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; }
.m ul { list-style:none; }
.m li { font-size:21px; font-weight:400; line-height:1.55; opacity:0.7; margin-bottom:4px; text-shadow:0 1px 10px rgba(0,0,0,0.4); }
.bm { margin-top:32px; font-size:16px; font-weight:700; opacity:0.35; letter-spacing:2px; }
.bm b { color:${accent}; font-weight:700; }
</style></head>
<body>
<div class="overlay"></div>
<div class="c">
  <div class="top">
    ${label ? `<span class="lbl">${escapeHtml(label)}</span>` : "<span></span>"}
    <span class="pg">${slideIndex + 1} / ${totalSlides}</span>
  </div>
  <div>
    <div class="h">${escapeHtml(slide.heading)}</div>
    <div class="m"><ul>${bulletsHtml}</ul></div>
    <div class="bm">ED<b>LIGHT</b></div>
  </div>
</div>
</body></html>`;
}

/* ── Content slide: dark background with accent bar ────────────────────── */

function buildContentSlideHTML(
  slide: IGSlide, label: string, accent: string, dark: string,
  bulletsHtml: string, slideIndex: number, totalSlides: number,
): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1080px;
  font-family: ${FONT_STACK};
  background:${dark}; color:#fff; overflow:hidden; position:relative;
}
.bar { position:absolute; left:0; top:0; bottom:0; width:5px; background:${accent}; }
.c { height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:72px 80px 64px 92px; }
.hd { margin-bottom:16px; }
.top { display:flex; justify-content:space-between; align-items:center; margin-bottom:48px; }
.lbl { font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:3.5px; color:${accent}; opacity:0.6; }
.pg { font-size:14px; font-weight:500; opacity:0.3; letter-spacing:1px; }
.h { font-size:42px; font-weight:700; line-height:1.15; letter-spacing:-0.3px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; }
.bd { flex:1; display:flex; flex-direction:column; justify-content:center; }
.bd ul { list-style:none; }
.bd li { font-size:25px; line-height:1.55; margin-bottom:28px; opacity:0.82; padding-left:32px; position:relative; }
.bd li::before { content:'\u2014'; position:absolute; left:0; color:${accent}; opacity:0.5; }
.ft { display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid rgba(255,255,255,0.06); padding-top:20px; }
.src { font-size:14px; opacity:0.25; max-width:65%; line-height:1.4; }
.bm { font-size:16px; font-weight:700; opacity:0.3; letter-spacing:2px; }
.bm b { color:${accent}; font-weight:700; }
</style></head>
<body>
<div class="bar"></div>
<div class="c">
  <div class="hd">
    <div class="top">
      ${label ? `<span class="lbl">${escapeHtml(label)}</span>` : "<span></span>"}
      <span class="pg">${slideIndex + 1} / ${totalSlides}</span>
    </div>
    <div class="h">${escapeHtml(slide.heading)}</div>
  </div>
  <div class="bd"><ul>${bulletsHtml}</ul></div>
  <div class="ft">
    <span class="src">${slide.footer ? escapeHtml(slide.footer) : ""}</span>
    <span class="bm">ED<b>LIGHT</b></span>
  </div>
</div>
</body></html>`;
}

export interface CarouselAssetResult {
  mode: "rendered" | "dry-run";
  /** Paths to PNG files (rendered) or HTML files (dry-run) */
  slidePaths: string[];
  /** Path to the JSON payload file */
  payloadPath: string;
  /** Base directory for all assets */
  exportDir: string;
}

/**
 * Generate carousel assets for an IG queue item.
 *
 * If Chromium (via the existing renderer) is available, renders PNGs.
 * Otherwise, falls back to "dry-run" mode: saves HTML templates + JSON payload.
 *
 * When payload.memeSlide is present, it is appended as the final carousel image.
 */
export async function generateCarouselAssets(
  queueItem: IGQueueItem,
  payload: IGFormattedPayload,
): Promise<CarouselAssetResult> {
  const exportDir = `/tmp/ig_exports/${queueItem.id}`;
  mkdirSync(exportDir, { recursive: true });

  // Save JSON payload
  const payloadPath = join(exportDir, "payload.json");
  writeFileSync(payloadPath, JSON.stringify({ queueItem, payload }, null, 2), "utf-8");

  const slidePaths: string[] = [];
  let mode: "rendered" | "dry-run" = "dry-run";

  // Total slides: content slides + optional meme slide
  const totalSlides = payload.slides.length + (payload.memeSlide ? 1 : 0);

  // Try to render PNGs using the existing branded card pipeline
  try {
    // Dynamic import to avoid hard dependency on playwright
    const { renderBrandedCardPNG } = await import("./index.js");

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      // Use existing branded card renderer for a styled 1080×1080 image
      const buffer = await renderBrandedCardPNG({
        title: slide.heading,
        category: queueItem.igType as any,
        sourceName: slide.footer,
        size: "square",
      });
      const pngPath = join(exportDir, `slide_${i + 1}.png`);
      writeFileSync(pngPath, buffer);
      slidePaths.push(pngPath);
    }

    // Render meme slide as final carousel image (if present)
    if (payload.memeSlide) {
      const memeHtml = buildMemeSlideHTML(payload.memeSlide);
      const memeBuffer = await renderMemeSlideWithChromium(memeHtml);
      const memePath = join(exportDir, `slide_meme.png`);
      writeFileSync(memePath, memeBuffer);
      slidePaths.push(memePath);
    }

    mode = "rendered";
  } catch {
    // Chromium not available — fall back to dry-run HTML exports
    console.warn("[ig-renderer] Chromium unavailable, using dry-run HTML mode");

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      const html = buildSlideHTML(slide, queueItem.igType, i, totalSlides);
      const htmlPath = join(exportDir, `slide_${i + 1}.html`);
      writeFileSync(htmlPath, html, "utf-8");
      slidePaths.push(htmlPath);
    }

    // Meme slide dry-run HTML export
    if (payload.memeSlide) {
      const memeHtml = buildMemeSlideHTML(payload.memeSlide);
      const memeHtmlPath = join(exportDir, `slide_meme.html`);
      writeFileSync(memeHtmlPath, memeHtml, "utf-8");
      slidePaths.push(memeHtmlPath);
    }
  }

  return { mode, slidePaths, payloadPath, exportDir };
}

/**
 * Render a meme slide HTML string to PNG using the shared Chromium instance.
 */
async function renderMemeSlideWithChromium(html: string): Promise<Buffer> {
  const { renderBrandedCardPNG: _unused, ...rest } = await import("./index.js");
  // We need the browser — reuse the same approach as renderBrandedCardPNG
  // but set content directly from the meme HTML
  const pw = await import("playwright-core");
  const chromiumModule = pw.chromium;

  const executablePaths = [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ].filter(Boolean) as string[];

  let browser;
  for (const executablePath of executablePaths) {
    try {
      browser = await chromiumModule.launch({
        executablePath,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
      });
      break;
    } catch {
      // Try next
    }
  }
  if (!browser) {
    browser = await chromiumModule.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }

  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    const buffer = await page.screenshot({ type: "png", timeout: 60_000 });
    return Buffer.from(buffer);
  } finally {
    await page.close();
    await browser.close();
  }
}
