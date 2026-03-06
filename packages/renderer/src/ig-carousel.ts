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
  opportunity: "#f59e0b",
  news:        "#14b8a6",
  histoire:    "#d97706",
  utility:     "#10b981",
  taux:        "#eab308",
};

const IG_TYPE_DARKS: Record<string, string> = {
  scholarship: "#060d1f",
  opportunity: "#0f0d08",
  news:        "#061014",
  histoire:    "#120b06",
  utility:     "#060f0b",
  taux:        "#0a1628",
};

const IG_TYPE_LABELS: Record<string, string> = {
  scholarship: "BOURSE",
  opportunity: "OPPORTUNITÉ",
  news:        "ACTUALITÉ",
  histoire:    "HISTOIRE",
  utility:     "GUIDE",
  taux:        "TAUX DU JOUR",
};

const FONT_STACK = "'Inter', 'Noto Color Emoji', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const GOOGLE_FONTS_LINK = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Color+Emoji&display=swap" rel="stylesheet">`;

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

  // Taux slides use dedicated financial-styled templates
  if (igType === "taux") {
    return slideIndex === 0
      ? buildTauxCoverHTML(slide, accent, totalSlides)
      : buildTauxDetailHTML(slide, accent, slideIndex, totalSlides);
  }

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
${GOOGLE_FONTS_LINK}
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
    rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.60) 30%, rgba(0,0,0,0.88) 100%);
}
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:72px 80px; }
.top { display:flex; justify-content:space-between; align-items:center; }
.lbl { font-size:15px; font-weight:600; text-transform:uppercase; letter-spacing:3.5px; opacity:0.85; }
.lbl::before { content:''; display:inline-block; width:8px; height:8px; background:${accent}; border-radius:50%; margin-right:10px; vertical-align:middle; }
.pg { font-size:14px; font-weight:500; opacity:0.4; letter-spacing:1px; }
.h { font-size:54px; font-weight:700; line-height:1.1; letter-spacing:-0.5px; text-shadow:0 2px 30px rgba(0,0,0,0.7), 0 1px 6px rgba(0,0,0,0.5); margin-bottom:20px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; }
.m ul { list-style:none; }
.m li { font-size:24px; font-weight:400; line-height:1.55; opacity:0.85; margin-bottom:4px; text-shadow:0 1px 12px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.4); }
.bm { margin-top:32px; font-size:18px; font-weight:700; letter-spacing:2.5px; display:flex; align-items:center; gap:6px; }
.bm .el { color:#fff; opacity:0.9; }
.bm .nw { color:${accent}; opacity:0.9; }
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
    <div class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
  </div>
</div>
</body></html>`;
}

/* ── Content slide: dark background with accent bar ────────────────────── */

function buildContentSlideHTML(
  slide: IGSlide, label: string, accent: string, dark: string,
  _bulletsHtml: string, slideIndex: number, totalSlides: number,
): string {
  /* Editorial row layout: each bullet becomes a full-width row separated by
     fine rules — Bloomberg / Reuters IG style, no bullet markers. */
  const rowsHtml = slide.bullets
    .map((b) => `<div class="row"><div class="row-txt">${escapeHtml(b)}</div></div>`)
    .join("\n      ");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1080px;
  font-family: ${FONT_STACK};
  background:${dark}; color:#fff; overflow:hidden; position:relative;
}
.bar { position:absolute; left:0; top:0; bottom:0; width:5px; background:${accent}; }
.c { height:100%; display:flex; flex-direction:column; padding:56px 72px 48px 80px; }
.top { display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; }
.lbl { font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:3.5px; color:${accent}; opacity:0.6; }
.pg { font-size:14px; font-weight:500; opacity:0.3; letter-spacing:1px; }
.h { font-size:44px; font-weight:700; line-height:1.15; letter-spacing:-0.3px; margin-bottom:28px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; }
.rows { flex:1; display:flex; flex-direction:column; justify-content:center; }
.row { padding:22px 0; border-bottom:1px solid rgba(255,255,255,0.07); }
.row:first-child { border-top:1px solid rgba(255,255,255,0.07); }
.row-txt { font-size:30px; line-height:1.50; font-weight:400; opacity:0.88; }
.ft { display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid rgba(255,255,255,0.06); padding-top:18px; margin-top:auto; }
.src { font-size:14px; opacity:0.25; max-width:65%; line-height:1.4; }
.bm { font-size:16px; font-weight:700; letter-spacing:2px; display:flex; align-items:center; gap:5px; }
.bm .el { color:rgba(255,255,255,0.5); }
.bm .nw { color:${accent}; opacity:0.7; }
</style></head>
<body>
<div class="bar"></div>
<div class="c">
  <div class="top">
    ${label ? `<span class="lbl">${escapeHtml(label)}</span>` : "<span></span>"}
    <span class="pg">${slideIndex + 1} / ${totalSlides}</span>
  </div>
  <div class="h">${escapeHtml(slide.heading)}</div>
  <div class="rows">
      ${rowsHtml}
  </div>
  <div class="ft">
    <span class="src">${slide.footer ? escapeHtml(slide.footer) : ""}</span>
    <span class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></span>
  </div>
</div>
</body></html>`;
}

/* ── Taux du Jour: financial terminal cover (big rate number) ──────────── */

function buildTauxCoverHTML(
  slide: IGSlide, accent: string, totalSlides: number,
): string {
  const metaHtml = slide.bullets
    .map((b) => `<span>${escapeHtml(b)}</span>`)
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1080px;
  font-family:${FONT_STACK};
  background:linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%);
  color:#fff; overflow:hidden; position:relative;
}
.grid {
  position:absolute; inset:0;
  background-image:
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size:40px 40px;
}
.glow {
  position:absolute; top:-200px; right:-100px; width:600px; height:600px;
  background:radial-gradient(circle, rgba(234,179,8,0.06) 0%, transparent 70%);
}
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:72px 80px; }
.top { display:flex; justify-content:space-between; align-items:center; }
.lbl { font-size:14px; font-weight:600; text-transform:uppercase; letter-spacing:4px; color:${accent}; opacity:0.7; }
.pg { font-size:14px; font-weight:500; opacity:0.3; letter-spacing:1px; }
.rate { text-align:center; flex:1; display:flex; flex-direction:column; justify-content:center; gap:8px; }
.rate-label { font-size:17px; font-weight:500; opacity:0.4; letter-spacing:3px; text-transform:uppercase; }
.rate-value { font-size:104px; font-weight:800; letter-spacing:-3px; color:${accent}; line-height:1; }
.rate-unit { font-size:22px; font-weight:500; opacity:0.35; margin-top:6px; letter-spacing:1px; }
.meta { display:flex; justify-content:center; gap:40px; margin-top:24px; }
.meta span { font-size:18px; opacity:0.5; font-weight:500; }
.ft { display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid rgba(255,255,255,0.06); padding-top:20px; }
.src { font-size:13px; opacity:0.2; max-width:60%; line-height:1.4; }
.bm { font-size:16px; font-weight:700; letter-spacing:2px; display:flex; align-items:center; gap:5px; }
.bm .el { color:rgba(255,255,255,0.5); }
.bm .nw { color:${accent}; opacity:0.7; }
</style></head>
<body>
<div class="grid"></div>
<div class="glow"></div>
<div class="c">
  <div class="top">
    <span class="lbl">TAUX DU JOUR</span>
    <span class="pg">1 / ${totalSlides}</span>
  </div>
  <div class="rate">
    <div class="rate-label">TAUX DE R\u00c9F\u00c9RENCE BRH</div>
    <div class="rate-value">${escapeHtml(slide.heading)}</div>
    <div class="rate-unit">HTG / 1 USD</div>
    <div class="meta">${metaHtml}</div>
  </div>
  <div class="ft">
    <span class="src">${slide.footer ? escapeHtml(slide.footer) : "Source: Banque de la R\u00e9publique d\u2019Ha\u00efti (BRH)"}</span>
    <span class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></span>
  </div>
</div>
</body></html>`;
}

/* ── Taux du Jour: financial terminal detail (market rows) ─────────────── */

function buildTauxDetailHTML(
  slide: IGSlide, accent: string, slideIndex: number, totalSlides: number,
): string {
  const rowsHtml = slide.bullets
    .map((b) => `<div class="row"><div class="row-text">${escapeHtml(b)}</div></div>`)
    .join("\n    ");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1080px;
  font-family:${FONT_STACK};
  background:linear-gradient(180deg, #0a1628 0%, #0d1b2a 100%);
  color:#fff; overflow:hidden; position:relative;
}
.grid {
  position:absolute; inset:0;
  background-image:
    linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
  background-size:40px 40px;
}
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:72px 80px; }
.top { display:flex; justify-content:space-between; align-items:center; margin-bottom:40px; }
.lbl { font-size:14px; font-weight:600; text-transform:uppercase; letter-spacing:4px; color:${accent}; opacity:0.5; }
.pg { font-size:14px; font-weight:500; opacity:0.3; letter-spacing:1px; }
.h { font-size:46px; font-weight:700; line-height:1.15; margin-bottom:36px; letter-spacing:-0.3px; }
.rows { flex:1; display:flex; flex-direction:column; justify-content:center; gap:0; }
.row { padding:26px 0; border-bottom:1px solid rgba(255,255,255,0.06); }
.row:last-child { border-bottom:none; }
.row-text { font-size:28px; line-height:1.5; opacity:0.85; font-weight:500; }
.ft { display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid rgba(255,255,255,0.06); padding-top:20px; }
.src { font-size:13px; opacity:0.2; max-width:60%; line-height:1.4; }
.bm { font-size:16px; font-weight:700; letter-spacing:2px; display:flex; align-items:center; gap:5px; }
.bm .el { color:rgba(255,255,255,0.5); }
.bm .nw { color:${accent}; opacity:0.7; }
</style></head>
<body>
<div class="grid"></div>
<div class="c">
  <div class="top">
    <span class="lbl">TAUX DU JOUR</span>
    <span class="pg">${slideIndex + 1} / ${totalSlides}</span>
  </div>
  <div class="h">${escapeHtml(slide.heading)}</div>
  <div class="rows">
    ${rowsHtml}
  </div>
  <div class="ft">
    <span class="src">${slide.footer ? escapeHtml(slide.footer) : ""}</span>
    <span class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></span>
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

  // Try to render PNGs using Chromium + our custom slide HTML templates
  try {
    const { getBrowserInstance } = await import("./index.js");
    // Use our editorial slide templates (cover images, bullets, layout)
    const browser = await getBrowserInstance();

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      const html = buildSlideHTML(slide, queueItem.igType, i, totalSlides);
      const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
      try {
        await page.setContent(html, { waitUntil: "networkidle", timeout: 60_000 });
        // Wait for cover image to load (if present)
        await page.evaluate("document.fonts.ready");
        const buffer = await page.screenshot({ type: "png", timeout: 60_000 });
        const pngPath = join(exportDir, `slide_${i + 1}.png`);
        writeFileSync(pngPath, Buffer.from(buffer));
        slidePaths.push(pngPath);
      } finally {
        await page.close();
      }
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
