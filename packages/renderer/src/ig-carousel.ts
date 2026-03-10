/**
 * @edlight-news/renderer – IG Carousel asset generation
 *
 * Professional media layout (Bloomberg / Axios inspired):
 *   • Safe margins: 120 top / 90 side / 100 bottom
 *   • 3-level type hierarchy: label → headline → body
 *   • 3 slide layouts: headline / explanation / data
 *   • Taux du jour: dedicated financial terminal template
 *   • Backward-compatible: slides without layout field auto-resolve
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IGSlide, IGSlideLayout, IGFormattedPayload, IGQueueItem } from "@edlight-news/types";
import { buildMemeSlideHTML } from "./ig-meme.js";
import {
  CANVAS, MARGIN, FONT_STACK, GOOGLE_FONTS_LINK, TYPE,
  ACCENT, DARK, LABEL, OVERLAY,
} from "./design-tokens.js";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Resolve the layout for a slide. New slides carry an explicit `layout` field;
 * legacy slides (pre-refactor) get auto-resolved for backward compat.
 */
function resolveLayout(slide: IGSlide, slideIndex: number): IGSlideLayout {
  if (slide.layout) return slide.layout;
  // Legacy heuristic: first slide → headline, rest → explanation
  return slideIndex === 0 ? "headline" : "explanation";
}

// ── Public entry point ─────────────────────────────────────────────────────

/**
 * Build HTML for a single IG carousel slide (1080×1350, 4:5 portrait).
 *
 * Layout-driven dispatch:
 *   - headline:    big bold title + optional sub-line (cover / beat slides)
 *   - explanation: medium headline + body bullets (detail slides)
 *   - data:        giant stat number + description (impact/coverage slides)
 *   - taux:        dedicated financial terminal template
 */
export function buildSlideHTML(
  slide: IGSlide,
  igType: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = ACCENT[igType] ?? "#60a5fa";
  const dark = DARK[igType] ?? "#060d1f";
  const label = LABEL[igType] ?? "";

  // Taux slides use dedicated financial-styled templates
  if (igType === "taux") {
    return slideIndex === 0
      ? buildTauxCoverHTML(slide, accent, totalSlides)
      : buildTauxDetailHTML(slide, accent, slideIndex, totalSlides);
  }

  const layout = resolveLayout(slide, slideIndex);
  const isFirst = slideIndex === 0;

  switch (layout) {
    case "data":
      return buildDataHTML(slide, label, accent, dark, isFirst);
    case "explanation":
      return buildExplanationHTML(slide, label, accent, dark, isFirst);
    case "headline":
    default:
      return buildHeadlineHTML(slide, label, accent, dark, isFirst);
  }
}

// ── Shared CSS helpers ─────────────────────────────────────────────────────

function resetCss(): string {
  return `* { margin:0; padding:0; box-sizing:border-box; }`;
}

function bodyCss(dark: string, bgImage?: string): string {
  const bg = bgImage
    ? `${dark} url('${bgImage}') center/cover no-repeat`
    : dark;
  return `body { width:${CANVAS.width}px; height:${CANVAS.height}px; font-family:${FONT_STACK}; background:${bg}; color:#fff; overflow:hidden; position:relative; }`;
}

function overlayCss(gradient: string): string {
  return `.overlay { position:absolute; inset:0; background:${gradient}; }`;
}

function glowCss(accent: string): string {
  return `.bg-glow { position:absolute; inset:0; background: radial-gradient(ellipse at 20% 80%, ${accent}08 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, ${accent}06 0%, transparent 50%); }
.accent-bar { position:absolute; left:0; top:0; bottom:0; width:5px; background:${accent}; }`;
}

function pillCss(accent: string): string {
  return `.pill { display:inline-flex; align-items:center; gap:8px; background:${accent}; color:#000; font-size:${TYPE.label}px; font-weight:800; text-transform:uppercase; letter-spacing:3px; padding:12px 28px; border-radius:4px; }`;
}

function brandHtml(accent: string, size = 18): string {
  return `<span style="font-size:${size}px;font-weight:800;letter-spacing:2.5px;display:flex;align-items:center;gap:6px"><span style="color:rgba(255,255,255,0.85)">EDLIGHT</span><span style="color:${accent}">NEWS</span></span>`;
}

function topBrandHtml(accent: string): string {
  return `<span class="top-brand"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></span>`;
}

function topBrandCss(accent: string): string {
  return `.top-brand { font-size:22px; font-weight:800; letter-spacing:3px; display:flex; align-items:center; gap:6px; }
.top-brand .el { color:#fff; opacity:0.9; }
.top-brand .nw { color:${accent}; }`;
}

function bottomBarHtml(footer: string | undefined, accent: string, showBrand: boolean): string {
  return `<div class="bottom">
    <span class="src">${footer ? escapeHtml(footer) : ""}</span>
    ${showBrand ? brandHtml(accent) : ""}
  </div>`;
}

function bottomCss(): string {
  return `.bottom { display:flex; justify-content:space-between; align-items:flex-end; padding-top:16px; border-top:1px solid rgba(255,255,255,0.10); }
.src { font-size:${TYPE.source}px; opacity:0.3; max-width:60%; line-height:1.4; font-weight:400; }`;
}

// ── HEADLINE layout ────────────────────────────────────────────────────────
// Big bold title + optional one-liner. Used for covers and story beats.

function buildHeadlineHTML(
  slide: IGSlide, label: string, accent: string, dark: string, isFirst: boolean,
): string {
  const bodyText = slide.bullets
    .map((b) => `<div class="bt">${escapeHtml(b)}</div>`)
    .join("\n    ");
  const hasImage = !!slide.backgroundImage;
  // Responsive headline: scale down for longer text so it never clips
  const hSize = isFirst
    ? slide.heading.length > 60 ? 64
    : slide.heading.length > 40 ? 72
    : TYPE.headlineHero
    : slide.heading.length > 120 ? 48
    : slide.heading.length > 80 ? 56
    : TYPE.headlineInner;
  const hClamp = isFirst ? (slide.heading.length > 60 ? 6 : 5) : slide.heading.length > 120 ? 8 : 6;
  const pad = `${MARGIN.top}px ${MARGIN.side}px ${MARGIN.bottom}px${!hasImage ? ` ${MARGIN.side + 10}px` : ""}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
${resetCss()}
${bodyCss(dark, slide.backgroundImage)}
${hasImage ? overlayCss(isFirst ? OVERLAY.hero : OVERLAY.inner) : glowCss(accent)}
${pillCss(accent)}
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:${pad}; }
.top { display:flex; justify-content:space-between; align-items:center; }
${isFirst ? topBrandCss(accent) : ""}
.main { margin-top:auto; }
${isFirst ? `.accent-rule { width:64px; height:4px; background:${accent}; border-radius:2px; margin-bottom:20px; }` : ""}
.h { font-size:${hSize}px; font-weight:900; line-height:1.05; letter-spacing:-1.5px; text-shadow:0 2px 40px rgba(0,0,0,0.8), 0 1px 6px rgba(0,0,0,0.5); margin-bottom:${isFirst ? "24" : "28"}px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:${isFirst ? 4 : hClamp}; -webkit-box-orient:vertical; }
.bt { font-size:${TYPE.body}px; font-weight:${isFirst ? 400 : 500}; line-height:1.45; opacity:${isFirst ? 0.80 : 0.90}; text-shadow:0 1px 16px rgba(0,0,0,0.7); margin-bottom:8px; max-height:${isFirst ? 180 : 320}px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:${isFirst ? 4 : 6}; -webkit-box-orient:vertical; }
${bottomCss()}
</style></head>
<body>
${hasImage ? '<div class="overlay"></div>' : '<div class="bg-glow"></div><div class="accent-bar"></div>'}
<div class="c">
  <div class="top">
    ${label ? `<span class="pill">${escapeHtml(label)}</span>` : "<span></span>"}
    ${isFirst ? topBrandHtml(accent) : ""}
  </div>
  <div class="main">
    ${isFirst ? '<div class="accent-rule"></div>' : ""}
    <div class="h">${escapeHtml(slide.heading)}</div>
    ${bodyText}
    ${bottomBarHtml(slide.footer, accent, !isFirst)}
  </div>
</div>
</body></html>`;
}

// ── EXPLANATION layout ─────────────────────────────────────────────────────
// Medium headline + body bullets. Used for detail / eligibility / how-to slides.

function buildExplanationHTML(
  slide: IGSlide, label: string, accent: string, dark: string, isFirst: boolean,
): string {
  const bulletsHtml = slide.bullets
    .map((b) => `<div class="bt">${escapeHtml(b)}</div>`)
    .join("\n    ");
  const hasImage = !!slide.backgroundImage;
  const pad = `${MARGIN.top}px ${MARGIN.side}px 140px${!hasImage ? ` ${MARGIN.side + 10}px` : ""}`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
${resetCss()}
${bodyCss(dark, slide.backgroundImage)}
${hasImage ? overlayCss(OVERLAY.inner) : glowCss(accent)}
${pillCss(accent)}
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:${pad}; }
.top { display:flex; justify-content:space-between; align-items:center; }
.main { flex:1; display:flex; flex-direction:column; justify-content:center; padding:40px 0; }
.h { font-size:${TYPE.headlineInner}px; font-weight:800; line-height:1.10; letter-spacing:-0.5px; margin-bottom:36px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; }
.bt { font-size:${TYPE.body}px; font-weight:400; line-height:1.50; opacity:0.92; margin-bottom:20px; padding-left:18px; border-left:6px solid ${accent}88; max-height:420px; overflow:hidden; display:-webkit-box; -webkit-line-clamp:8; -webkit-box-orient:vertical; text-shadow:0 1px 8px rgba(0,0,0,0.6); }
${bottomCss()}
</style></head>
<body>
${hasImage ? '<div class="overlay"></div>' : '<div class="bg-glow"></div><div class="accent-bar"></div>'}
<div class="c">
  <div class="top">
    ${label ? `<span class="pill">${escapeHtml(label)}</span>` : "<span></span>"}
  </div>
  <div class="main">
    <div class="h">${escapeHtml(slide.heading)}</div>
    ${bulletsHtml}
  </div>
  ${bottomBarHtml(slide.footer, accent, !isFirst)}
</div>
</body></html>`;
}

// ── DATA layout ────────────────────────────────────────────────────────────
// Giant stat number + description. Used for coverage amounts, percentages, etc.

function buildDataHTML(
  slide: IGSlide, label: string, accent: string, dark: string, isFirst: boolean,
): string {
  const stat = slide.statValue ?? slide.heading;
  const desc = slide.statDescription ?? (slide.bullets[0] || "");
  const hasImage = !!slide.backgroundImage;
  const pad = `${MARGIN.top}px ${MARGIN.side}px ${MARGIN.bottom}px`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
${resetCss()}
${bodyCss(dark, slide.backgroundImage)}
${hasImage ? overlayCss(OVERLAY.inner) : glowCss(accent)}
${pillCss(accent)}
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:${pad}; }
.top { display:flex; justify-content:space-between; align-items:center; }
.center { flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; gap:16px; }
.stat { font-size:${TYPE.stat}px; font-weight:900; line-height:1; letter-spacing:-3px; color:${accent}; text-shadow:0 4px 60px rgba(0,0,0,0.5); }
.stat-desc { font-size:${TYPE.body}px; font-weight:500; opacity:0.7; max-width:80%; line-height:1.35; }
.stat-heading { font-size:20px; font-weight:600; opacity:0.45; letter-spacing:3px; text-transform:uppercase; }
${bottomCss()}
</style></head>
<body>
${hasImage ? '<div class="overlay"></div>' : '<div class="bg-glow"></div><div class="accent-bar"></div>'}
<div class="c">
  <div class="top">
    ${label ? `<span class="pill">${escapeHtml(label)}</span>` : "<span></span>"}
  </div>
  <div class="center">
    <div class="stat-heading">${escapeHtml(slide.heading)}</div>
    <div class="stat">${escapeHtml(stat)}</div>
    ${desc ? `<div class="stat-desc">${escapeHtml(desc)}</div>` : ""}
  </div>
  ${bottomBarHtml(slide.footer, accent, !isFirst)}
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
${resetCss()}
body { width:${CANVAS.width}px; height:${CANVAS.height}px; font-family:${FONT_STACK}; ${bgCss} color:#fff; overflow:hidden; position:relative; }
${slide.backgroundImage ? `.img-overlay { position:absolute; inset:0; background:rgba(10,22,40,0.55); }` : ""}
.glow { position:absolute; top:-200px; right:-100px; width:600px; height:600px; background:radial-gradient(circle, rgba(234,179,8,0.08) 0%, transparent 70%); }
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:${MARGIN.top}px ${MARGIN.side}px ${MARGIN.bottom}px; }
.top { display:flex; justify-content:space-between; align-items:center; }
${pillCss(accent)}
${topBrandCss(accent)}
.rate { text-align:center; flex:1; display:flex; flex-direction:column; justify-content:center; gap:10px; }
.rate-label { font-size:20px; font-weight:600; opacity:0.45; letter-spacing:3px; text-transform:uppercase; }
.rate-value { font-size:140px; font-weight:900; letter-spacing:-4px; color:${accent}; line-height:1; }
.rate-unit { font-size:30px; font-weight:500; opacity:0.40; margin-top:12px; letter-spacing:1.5px; }
.meta { display:flex; justify-content:center; gap:40px; margin-top:36px; }
.meta span { font-size:22px; opacity:0.55; font-weight:500; }
${bottomCss()}
</style></head>
<body>
${slide.backgroundImage ? '<div class="img-overlay"></div>' : ""}
<div class="glow"></div>
<div class="c">
  <div class="top">
    <span class="pill">TAUX DU JOUR</span>
    ${topBrandHtml(accent)}
  </div>
  <div class="rate">
    <div class="rate-label">TAUX DE RÉFÉRENCE BRH</div>
    <div class="rate-value">${escapeHtml(slide.heading)}</div>
    <div class="rate-unit">HTG / 1 USD</div>
    <div class="meta">${metaHtml}</div>
  </div>
  <div class="bottom">
    <span class="src">${slide.footer ? escapeHtml(slide.footer) : "Source: Banque de la République d\u2019Haïti (BRH)"}</span>
    ${brandHtml(accent)}
  </div>
</div>
</body></html>`;
}

// ── Taux du Jour: financial terminal detail (market rows) ─────────────────

function buildTauxDetailHTML(
  slide: IGSlide, accent: string, slideIndex: number, totalSlides: number,
): string {
  // Parse structured data from bullets for table display
  // Expected format: "Bancaire — Achat: 130.5000  |  Vente: 131.2000"
  const rows: { label: string; buy?: string; sell?: string; plain?: string }[] = [];
  for (const b of slide.bullets) {
    const m = b.match(/^(.+?)\s*[—–-]\s*Achat\s*:\s*([\d.,]+)\s*\|\s*Vente\s*:\s*([\d.,]+)/);
    if (m) {
      rows.push({ label: m[1]!.trim(), buy: m[2]!.trim(), sell: m[3]!.trim() });
    } else {
      rows.push({ label: b, plain: b });
    }
  }

  const tableRows = rows.map((r) => {
    if (r.buy && r.sell) {
      return `<div class="row">
        <div class="row-label">${escapeHtml(r.label)}</div>
        <div class="row-pair">
          <div class="pair-col"><span class="pair-head">ACHAT</span><span class="pair-val">${escapeHtml(r.buy)}</span></div>
          <div class="pair-col"><span class="pair-head">VENTE</span><span class="pair-val">${escapeHtml(r.sell)}</span></div>
        </div>
      </div>`;
    }
    return `<div class="row"><div class="row-label">${escapeHtml(r.label)}</div></div>`;
  }).join("\n    ");

  const bgCss = slide.backgroundImage
    ? `background: #0a1628 url('${slide.backgroundImage}') center/cover no-repeat;`
    : `background: linear-gradient(180deg, #0a1628 0%, #0d1b2a 100%);`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
${resetCss()}
body { width:${CANVAS.width}px; height:${CANVAS.height}px; font-family:${FONT_STACK}; ${bgCss} color:#fff; overflow:hidden; position:relative; }
${slide.backgroundImage ? `.img-overlay { position:absolute; inset:0; background:rgba(10,22,40,0.60); }` : ""}
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:space-between; padding:${MARGIN.top}px ${MARGIN.side}px ${MARGIN.bottom}px; }
.top { display:flex; justify-content:space-between; align-items:center; margin-bottom:36px; }
${pillCss(accent)}
.h { font-size:${TYPE.headlineInner}px; font-weight:800; line-height:1.12; margin-bottom:48px; letter-spacing:-0.5px; }
.rows { flex:1; display:flex; flex-direction:column; justify-content:center; gap:0; }
.row { padding:34px 0; border-bottom:1px solid rgba(255,255,255,0.08); }
.row:last-child { border-bottom:none; }
.row-label { font-size:26px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:${accent}; margin-bottom:16px; }
.row-pair { display:flex; gap:60px; }
.pair-col { display:flex; flex-direction:column; gap:6px; }
.pair-head { font-size:20px; font-weight:600; letter-spacing:2px; opacity:0.50; text-transform:uppercase; }
.pair-val { font-size:56px; font-weight:800; letter-spacing:-1px; line-height:1; }
${bottomCss()}
</style></head>
<body>
${slide.backgroundImage ? '<div class="img-overlay"></div>' : ""}
<div class="c">
  <div class="top">
    <span class="pill">TAUX DU JOUR</span>
  </div>
  <div class="h">${escapeHtml(slide.heading)}</div>
  <div class="rows">
    ${tableRows}
  </div>
  <div class="bottom">
    <span class="src">${slide.footer ? escapeHtml(slide.footer) : ""}</span>
    ${brandHtml(accent)}
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
      const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
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

  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  try {
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    const buffer = await page.screenshot({ type: "png", timeout: 60_000 });
    return Buffer.from(buffer);
  } finally {
    await page.close();
    await browser.close();
  }
}
