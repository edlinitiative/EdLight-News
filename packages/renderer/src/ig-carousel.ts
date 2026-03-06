/**
 * @edlight-news/renderer – IG Carousel asset generation
 *
 * Bloomberg Business / Litquidity-inspired design:
 *   • Every slide has a full-bleed background image + heavy overlay
 *   • One key point per slide — large bold text that tells the story
 *   • Category pill badge top-left, page counter top-right
 *   • Self-contained storytelling: swipe through = read the whole story
 *   • Taux du jour uses a dedicated financial terminal template
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IGSlide, IGFormattedPayload, IGQueueItem, IGMemeSlide } from "@edlight-news/types";
import { buildMemeSlideHTML } from "./ig-meme.js";

// ── Design tokens ──────────────────────────────────────────────────────────

const IG_TYPE_ACCENTS: Record<string, string> = {
  scholarship: "#60a5fa",
  opportunity: "#fbbf24",
  news:        "#2dd4bf",
  histoire:    "#f59e0b",
  utility:     "#34d399",
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

// ── Public entry point ─────────────────────────────────────────────────────

/**
 * Build HTML for a single IG carousel slide (1080×1080).
 *
 * Bloomberg/Litquidity style:
 * - Every slide: full-bleed image + heavy overlay + one bold point
 * - Taux slides: dedicated financial terminal template
 */
export function buildSlideHTML(
  slide: IGSlide,
  igType: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = IG_TYPE_ACCENTS[igType] ?? "#60a5fa";
  const dark = IG_TYPE_DARKS[igType] ?? "#060d1f";
  const label = IG_TYPE_LABELS[igType] ?? "";

  // Taux slides use dedicated financial-styled templates
  if (igType === "taux") {
    return slideIndex === 0
      ? buildTauxCoverHTML(slide, accent, totalSlides)
      : buildTauxDetailHTML(slide, accent, slideIndex, totalSlides);
  }

  // Bloomberg style: every slide is a story beat with image + overlay
  if (slide.backgroundImage) {
    return buildStoryBeatHTML(slide, label, accent, dark, slideIndex, totalSlides);
  }

  // Fallback for slides without an image: dark editorial card
  return buildDarkBeatHTML(slide, label, accent, dark, slideIndex, totalSlides);
}

// ── Story-beat slide: full-bleed image + overlay + one bold point ──────────

function buildStoryBeatHTML(
  slide: IGSlide, label: string, accent: string, dark: string,
  slideIndex: number, totalSlides: number,
): string {
  const isFirstSlide = slideIndex === 0;
  const bodyText = slide.bullets
    .map((b) => `<div class="bt">${escapeHtml(b)}</div>`)
    .join("\n    ");

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
    rgba(0,0,0,0.50) 0%,
    rgba(0,0,0,0.40) 25%,
    rgba(0,0,0,0.55) 60%,
    rgba(0,0,0,0.92) 100%);
}
.c {
  position:relative; z-index:1;
  height:100%; display:flex; flex-direction:column;
  justify-content:space-between;
  padding:${isFirstSlide ? "64px 72px 60px" : "64px 72px 56px"};
}
.top { display:flex; justify-content:space-between; align-items:center; }
.pill {
  display:inline-flex; align-items:center; gap:8px;
  background:${accent}; color:#000;
  font-size:14px; font-weight:800; text-transform:uppercase;
  letter-spacing:2.5px; padding:8px 20px; border-radius:4px;
}
.pg { font-size:15px; font-weight:600; opacity:0.5; letter-spacing:1px; }
.main { margin-top:auto; }
.h {
  font-size:${isFirstSlide ? "56px" : "48px"};
  font-weight:800; line-height:1.08; letter-spacing:-0.8px;
  text-shadow:0 2px 40px rgba(0,0,0,0.8), 0 1px 6px rgba(0,0,0,0.5);
  margin-bottom:${isFirstSlide ? "20px" : "24px"};
  overflow:hidden; display:-webkit-box;
  -webkit-line-clamp:${isFirstSlide ? "4" : "3"};
  -webkit-box-orient:vertical;
}
.bt {
  font-size:${isFirstSlide ? "26px" : "32px"};
  font-weight:${isFirstSlide ? "400" : "500"};
  line-height:1.45;
  opacity:${isFirstSlide ? "0.80" : "0.90"};
  text-shadow:0 1px 16px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.4);
  margin-bottom:8px;
  max-height:${isFirstSlide ? "180px" : "260px"};
  overflow:hidden;
  display:-webkit-box;
  -webkit-line-clamp:${isFirstSlide ? "4" : "5"};
  -webkit-box-orient:vertical;
}
.bottom {
  display:flex; justify-content:space-between; align-items:flex-end;
  margin-top:28px; padding-top:16px;
  border-top:1px solid rgba(255,255,255,0.10);
}
.src { font-size:14px; opacity:0.3; max-width:60%; line-height:1.4; font-weight:400; }
.bm { font-size:18px; font-weight:800; letter-spacing:2.5px; display:flex; align-items:center; gap:6px; }
.bm .el { color:#fff; opacity:0.85; }
.bm .nw { color:${accent}; }
</style></head>
<body>
<div class="overlay"></div>
<div class="c">
  <div class="top">
    ${label ? `<span class="pill">${escapeHtml(label)}</span>` : "<span></span>"}
    <span class="pg">${slideIndex + 1} / ${totalSlides}</span>
  </div>
  <div class="main">
    <div class="h">${escapeHtml(slide.heading)}</div>
    ${bodyText}
    <div class="bottom">
      <span class="src">${slide.footer ? escapeHtml(slide.footer) : ""}</span>
      <span class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></span>
    </div>
  </div>
</div>
</body></html>`;
}

// ── Dark editorial slide (no image fallback) ──────────────────────────────

function buildDarkBeatHTML(
  slide: IGSlide, label: string, accent: string, dark: string,
  slideIndex: number, totalSlides: number,
): string {
  const bodyText = slide.bullets
    .map((b) => `<div class="bt">${escapeHtml(b)}</div>`)
    .join("\n    ");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1080px;
  font-family: ${FONT_STACK};
  background: ${dark};
  color:#fff; overflow:hidden; position:relative;
}
.bg {
  position:absolute; inset:0;
  background:
    radial-gradient(ellipse at 20% 80%, ${accent}08 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, ${accent}06 0%, transparent 50%);
}
.bar { position:absolute; left:0; top:0; bottom:0; width:5px; background:${accent}; }
.c {
  position:relative; z-index:1;
  height:100%; display:flex; flex-direction:column;
  justify-content:space-between;
  padding:64px 72px 56px 80px;
}
.top { display:flex; justify-content:space-between; align-items:center; }
.pill {
  display:inline-flex; align-items:center; gap:8px;
  background:${accent}; color:#000;
  font-size:14px; font-weight:800; text-transform:uppercase;
  letter-spacing:2.5px; padding:8px 20px; border-radius:4px;
}
.pg { font-size:15px; font-weight:600; opacity:0.35; letter-spacing:1px; }
.main {
  flex:1; display:flex; flex-direction:column;
  justify-content:center; padding:20px 0;
}
.h {
  font-size:46px; font-weight:800; line-height:1.10; letter-spacing:-0.5px;
  margin-bottom:28px;
  overflow:hidden; display:-webkit-box;
  -webkit-line-clamp:3; -webkit-box-orient:vertical;
}
.bt {
  font-size:32px; font-weight:400; line-height:1.45; opacity:0.85;
  margin-bottom:12px;
  max-height:250px; overflow:hidden;
  display:-webkit-box; -webkit-line-clamp:5; -webkit-box-orient:vertical;
}
.bottom {
  display:flex; justify-content:space-between; align-items:flex-end;
  padding-top:16px; border-top:1px solid rgba(255,255,255,0.08);
}
.src { font-size:14px; opacity:0.25; max-width:60%; line-height:1.4; }
.bm { font-size:18px; font-weight:800; letter-spacing:2.5px; display:flex; align-items:center; gap:6px; }
.bm .el { color:rgba(255,255,255,0.55); }
.bm .nw { color:${accent}; opacity:0.8; }
</style></head>
<body>
<div class="bg"></div>
<div class="bar"></div>
<div class="c">
  <div class="top">
    ${label ? `<span class="pill">${escapeHtml(label)}</span>` : "<span></span>"}
    <span class="pg">${slideIndex + 1} / ${totalSlides}</span>
  </div>
  <div class="main">
    <div class="h">${escapeHtml(slide.heading)}</div>
    ${bodyText}
  </div>
  <div class="bottom">
    <span class="src">${slide.footer ? escapeHtml(slide.footer) : ""}</span>
    <span class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></span>
  </div>
</div>
</body></html>`;
}

// ── Taux du Jour: financial terminal cover (big rate number) ──────────────

function buildTauxCoverHTML(
  slide: IGSlide, accent: string, totalSlides: number,
): string {
  const metaHtml = slide.bullets
    .map((b) => `<span>${escapeHtml(b)}</span>`)
    .join("");

  const bgCss = slide.backgroundImage
    ? `background: #0a1628 url('${slide.backgroundImage}') center/cover no-repeat;`
    : `background: linear-gradient(135deg, #0a1628 0%, #0d2137 50%, #0a1628 100%);`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1080px;
  font-family:${FONT_STACK};
  ${bgCss}
  color:#fff; overflow:hidden; position:relative;
}
${slide.backgroundImage ? `.img-overlay { position:absolute; inset:0; background:rgba(10,22,40,0.82); }` : ""}
.grid {
  position:absolute; inset:0;
  background-image:
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size:40px 40px;
}
.glow {
  position:absolute; top:-200px; right:-100px; width:600px; height:600px;
  background:radial-gradient(circle, rgba(234,179,8,0.08) 0%, transparent 70%);
}
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:64px 72px; }
.top { display:flex; justify-content:space-between; align-items:center; }
.pill {
  display:inline-flex; align-items:center; gap:8px;
  background:${accent}; color:#000;
  font-size:14px; font-weight:800; text-transform:uppercase;
  letter-spacing:2.5px; padding:8px 20px; border-radius:4px;
}
.pg { font-size:15px; font-weight:600; opacity:0.35; letter-spacing:1px; }
.rate { text-align:center; flex:1; display:flex; flex-direction:column; justify-content:center; gap:10px; }
.rate-label { font-size:20px; font-weight:600; opacity:0.45; letter-spacing:3px; text-transform:uppercase; }
.rate-value { font-size:120px; font-weight:900; letter-spacing:-4px; color:${accent}; line-height:1; }
.rate-unit { font-size:26px; font-weight:500; opacity:0.40; margin-top:8px; letter-spacing:1.5px; }
.meta { display:flex; justify-content:center; gap:40px; margin-top:28px; }
.meta span { font-size:20px; opacity:0.55; font-weight:500; }
.ft { display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid rgba(255,255,255,0.08); padding-top:18px; }
.src { font-size:14px; opacity:0.25; max-width:60%; line-height:1.4; }
.bm { font-size:18px; font-weight:800; letter-spacing:2.5px; display:flex; align-items:center; gap:6px; }
.bm .el { color:rgba(255,255,255,0.55); }
.bm .nw { color:${accent}; }
</style></head>
<body>
${slide.backgroundImage ? '<div class="img-overlay"></div>' : ""}
<div class="grid"></div>
<div class="glow"></div>
<div class="c">
  <div class="top">
    <span class="pill">TAUX DU JOUR</span>
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

// ── Taux du Jour: financial terminal detail (market rows) ─────────────────

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
    linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size:40px 40px;
}
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:64px 72px; }
.top { display:flex; justify-content:space-between; align-items:center; margin-bottom:36px; }
.pill {
  display:inline-flex; align-items:center; gap:8px;
  background:${accent}; color:#000;
  font-size:14px; font-weight:800; text-transform:uppercase;
  letter-spacing:2.5px; padding:8px 20px; border-radius:4px;
}
.pg { font-size:15px; font-weight:600; opacity:0.35; letter-spacing:1px; }
.h { font-size:48px; font-weight:800; line-height:1.12; margin-bottom:40px; letter-spacing:-0.5px; }
.rows { flex:1; display:flex; flex-direction:column; justify-content:center; gap:0; }
.row { padding:28px 0; border-bottom:1px solid rgba(255,255,255,0.07); }
.row:last-child { border-bottom:none; }
.row-text { font-size:32px; line-height:1.45; opacity:0.88; font-weight:500; }
.ft { display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid rgba(255,255,255,0.08); padding-top:18px; }
.src { font-size:14px; opacity:0.25; max-width:60%; line-height:1.4; }
.bm { font-size:18px; font-weight:800; letter-spacing:2.5px; display:flex; align-items:center; gap:6px; }
.bm .el { color:rgba(255,255,255,0.55); }
.bm .nw { color:${accent}; }
</style></head>
<body>
<div class="grid"></div>
<div class="c">
  <div class="top">
    <span class="pill">TAUX DU JOUR</span>
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

// ── Asset generation pipeline ──────────────────────────────────────────────

export interface CarouselAssetResult {
  mode: "rendered" | "dry-run";
  slidePaths: string[];
  payloadPath: string;
  exportDir: string;
}

export async function generateCarouselAssets(
  queueItem: IGQueueItem,
  payload: IGFormattedPayload,
): Promise<CarouselAssetResult> {
  const exportDir = `/tmp/ig_exports/${queueItem.id}`;
  mkdirSync(exportDir, { recursive: true });

  const payloadPath = join(exportDir, "payload.json");
  writeFileSync(payloadPath, JSON.stringify({ queueItem, payload }, null, 2), "utf-8");

  const slidePaths: string[] = [];
  let mode: "rendered" | "dry-run" = "dry-run";

  const totalSlides = payload.slides.length + (payload.memeSlide ? 1 : 0);

  try {
    const { getBrowserInstance } = await import("./index.js");
    const browser = await getBrowserInstance();

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      const html = buildSlideHTML(slide, queueItem.igType, i, totalSlides);
      const page = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
      try {
        await page.setContent(html, { waitUntil: "networkidle", timeout: 60_000 });
        await page.evaluate("document.fonts.ready");
        const buffer = await page.screenshot({ type: "png", timeout: 60_000 });
        const pngPath = join(exportDir, `slide_${i + 1}.png`);
        writeFileSync(pngPath, Buffer.from(buffer));
        slidePaths.push(pngPath);
      } finally {
        await page.close();
      }
    }

    if (payload.memeSlide) {
      const memeHtml = buildMemeSlideHTML(payload.memeSlide);
      const memeBuffer = await renderMemeSlideWithChromium(memeHtml);
      const memePath = join(exportDir, `slide_meme.png`);
      writeFileSync(memePath, memeBuffer);
      slidePaths.push(memePath);
    }

    mode = "rendered";
  } catch {
    console.warn("[ig-renderer] Chromium unavailable, using dry-run HTML mode");

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      const html = buildSlideHTML(slide, queueItem.igType, i, totalSlides);
      const htmlPath = join(exportDir, `slide_${i + 1}.html`);
      writeFileSync(htmlPath, html, "utf-8");
      slidePaths.push(htmlPath);
    }

    if (payload.memeSlide) {
      const memeHtml = buildMemeSlideHTML(payload.memeSlide);
      const memeHtmlPath = join(exportDir, `slide_meme.html`);
      writeFileSync(memeHtmlPath, memeHtml, "utf-8");
      slidePaths.push(memeHtmlPath);
    }
  }

  return { mode, slidePaths, payloadPath, exportDir };
}

async function renderMemeSlideWithChromium(html: string): Promise<Buffer> {
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
