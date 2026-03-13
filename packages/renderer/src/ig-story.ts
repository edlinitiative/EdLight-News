/**
 * @edlight-news/renderer – IG Story asset generation
 *
 * Renders 1080×1920 (9:16) story frames for the daily morning briefing.
 * Each frame becomes a single image posted as an IG Story.
 *
 * Frame types (v2 — Morning Briefing):
 *  - taux:     Premium navy/gold financial rate card
 *  - facts:    Green-accented "Le saviez-vous ?" card with all daily facts
 *  - headline: Dark bg + accent bar + number badge (article summaries)
 *  - cta:      Branded close with follow prompt (@edlight.news)
 *
 * Design system:
 *  - IG safe zones respected: 270 px top, 230 px bottom
 *  - Google Fonts Inter for consistent premium typography
 *  - Progress dots on every frame for visual cohesion
 *  - Branding: "EDLIGHT NEWS" on every frame
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IGStorySlide, IGStoryPayload, IGStoryQueueItem } from "@edlight-news/types";
import {
  FONT_HEADLINE, FONT_BODY, GOOGLE_FONTS_LINK,
} from "./design-tokens.js";

// ── Design tokens ─────────────────────────────────────────────────────────

const DEFAULT_ACCENT = "#14b8a6";
const DEFAULT_DARK = "#060f0b";

// IG safe zones (pixels on 1080×1920)
const SAFE_TOP = 270;     // profile bar + story header
const SAFE_BOTTOM = 230;  // reply field + navigation

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build small progress dots indicating current frame position. */
function buildProgressDots(current: number, total: number, accent: string): string {
  const dots: string[] = [];
  for (let i = 0; i < total; i++) {
    const active = i === current;
    dots.push(
      `<span style="display:inline-block;width:${active ? 28 : 10}px;height:4px;` +
      `border-radius:2px;background:${active ? accent : "rgba(255,255,255,0.25)"};` +
      `transition:width 0.2s;"></span>`,
    );
  }
  return `<div style="display:flex;gap:5px;align-items:center;justify-content:center;` +
    `position:absolute;top:${SAFE_TOP - 40}px;left:72px;right:72px;">${dots.join("")}</div>`;
}

// ── Cover frame ───────────────────────────────────────────────────────────

function buildCoverFrameHTML(
  slide: IGStorySlide,
  dateLabel: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = slide.accent ?? DEFAULT_ACCENT;
  const bulletsHtml = slide.bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_BODY};
  background: ${DEFAULT_DARK} ${slide.backgroundImage ? `url('${slide.backgroundImage}') center/cover no-repeat` : ""};
  color:#fff; overflow:hidden; position:relative;
}
/* Aggressive multi-stop overlay — readable on any image brightness */
.overlay {
  position:absolute; inset:0;
  background: linear-gradient(180deg,
    rgba(0,0,0,0.50) 0%,
    rgba(0,0,0,0.20) 20%,
    rgba(0,0,0,0.10) 40%,
    rgba(0,0,0,0.45) 60%,
    rgba(0,0,0,0.85) 85%,
    rgba(0,0,0,0.92) 100%);
}
.c {
  position:relative; z-index:1; height:100%;
  display:flex; flex-direction:column; justify-content:flex-end;
  padding:${SAFE_TOP + 20}px 72px ${SAFE_BOTTOM + 20}px;
}
.date {
  font-family:${FONT_HEADLINE}; font-size:16px; font-weight:700; text-transform:uppercase;
  letter-spacing:5px; opacity:0.7; margin-bottom:24px;
}
.dot {
  display:inline-block; width:10px; height:10px;
  background:${accent}; border-radius:50%; margin-right:12px; vertical-align:middle;
}
.h {
  font-family:${FONT_HEADLINE}; font-size:68px; font-weight:900; line-height:1.05; letter-spacing:-1.5px;
  text-shadow:0 4px 50px rgba(0,0,0,0.9), 0 2px 8px rgba(0,0,0,0.6);
  margin-bottom:28px;
}
.sub ul { list-style:none; }
.sub li {
  font-size:22px; font-weight:500; line-height:1.55; opacity:0.9;
  text-shadow:0 2px 16px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.4);
  margin-bottom:8px;
}
.bm {
  margin-top:40px; font-family:${FONT_HEADLINE}; font-size:18px; font-weight:700;
  letter-spacing:3px; display:flex; align-items:center; gap:6px;
}
.bm .el { color:#fff; opacity:0.85; }
.bm .nw { color:${accent}; opacity:0.85; }
</style></head>
<body>
<div class="overlay"></div>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="date"><span class="dot"></span>${escapeHtml(dateLabel)}</div>
  <div class="h">${escapeHtml(slide.heading)}</div>
  <div class="sub"><ul>${bulletsHtml}</ul></div>
  <div class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
</div>
</body></html>`;
}

// ── Taux frame (premium navy/gold financial card) ─────────────────────────

function buildTauxFrameHTML(
  slide: IGStorySlide,
  dateLabel: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = "#eab308"; // gold
  const rate = slide.heading; // e.g. "131.2589"
  // bullets[0] = rate date label, rest are optional market bullets
  const rateDate = slide.bullets[0] ?? dateLabel;
  const marketBullets = slide.bullets.slice(1);
  const marketHtml = marketBullets
    .map((b) => `<div class="mk">${escapeHtml(b)}</div>`)
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_BODY};
  background: linear-gradient(180deg, #0a1628 0%, #0d2137 40%, #0a1628 100%);
  color:#fff; overflow:hidden; position:relative;
}
.glow { position:absolute; top:30%; left:50%; transform:translate(-50%,-50%); width:700px; height:700px; background:radial-gradient(circle, rgba(234,179,8,0.06) 0%, transparent 70%); }
.c {
  position:relative; z-index:1; height:100%;
  display:flex; flex-direction:column; justify-content:center; align-items:center;
  padding:${SAFE_TOP + 40}px 72px ${SAFE_BOTTOM + 40}px;
  text-align:center;
}
.pill { font-family:${FONT_HEADLINE}; display:inline-flex; align-items:center; gap:8px; background:${accent}; color:#000; font-size:18px; font-weight:800; text-transform:uppercase; letter-spacing:3px; padding:10px 24px; border-radius:4px; margin-bottom:32px; }
.rate-label { font-family:${FONT_HEADLINE}; font-size:18px; font-weight:600; opacity:0.40; letter-spacing:3px; text-transform:uppercase; margin-bottom:12px; }
.rate { font-family:${FONT_HEADLINE}; font-size:120px; font-weight:900; letter-spacing:-3px; color:${accent}; line-height:1; margin-bottom:8px; }
.unit { font-size:24px; font-weight:500; opacity:0.35; letter-spacing:1.5px; margin-bottom:32px; }
.date-line { font-size:16px; font-weight:600; opacity:0.50; letter-spacing:1px; margin-bottom:40px; }
.mk { font-size:20px; font-weight:500; opacity:0.55; margin-bottom:12px; line-height:1.4; }
.bm { position:absolute; bottom:${SAFE_BOTTOM + 10}px; right:72px; font-size:16px; font-weight:700; letter-spacing:2.5px; display:flex; align-items:center; gap:5px; }
.bm .el { color:rgba(255,255,255,0.45); }
.bm .nw { color:${accent}; opacity:0.6; }
</style></head>
<body>
<div class="glow"></div>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <span class="pill">TAUX DU JOUR</span>
  <div class="rate-label">TAUX DE RÉFÉRENCE BRH</div>
  <div class="rate">${escapeHtml(rate)}</div>
  <div class="unit">HTG / 1 USD</div>
  <div class="date-line">${escapeHtml(rateDate)}</div>
  ${marketHtml}
</div>
<span class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></span>
</body></html>`;
}

// ── Facts frame (green-accented "Le saviez-vous ?" card) ──────────────────

function buildFactsFrameHTML(
  slide: IGStorySlide,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = slide.accent ?? "#34d399";
  const factsHtml = slide.bullets
    .map((f, i) => `<div class="fact"><span class="fn">${i + 1}</span><span class="ft">${escapeHtml(f)}</span></div>`)
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_BODY};
  background: radial-gradient(ellipse at 30% 20%, ${accent}0A 0%, transparent 60%), #060f0b;
  color:#fff; overflow:hidden; position:relative;
}
.bar { position:absolute; left:0; top:0; bottom:0; width:5px; background:${accent}; }
.c {
  position:relative; z-index:1; height:100%;
  display:flex; flex-direction:column; justify-content:center;
  padding:${SAFE_TOP + 40}px 80px ${SAFE_BOTTOM + 40}px 100px;
}
.pill { font-family:${FONT_HEADLINE}; display:inline-flex; align-items:center; gap:8px; background:${accent}; color:#000; font-size:18px; font-weight:800; text-transform:uppercase; letter-spacing:3px; padding:10px 24px; border-radius:4px; margin-bottom:36px; align-self:flex-start; }
.h { font-family:${FONT_HEADLINE}; font-size:48px; font-weight:900; line-height:1.10; letter-spacing:-0.5px; margin-bottom:40px; }
.fact { display:flex; gap:20px; align-items:flex-start; margin-bottom:28px; }
.fn { font-family:${FONT_HEADLINE}; flex-shrink:0; width:36px; height:36px; background:${accent}22; color:${accent}; font-size:18px; font-weight:800; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-top:2px; }
.ft { font-size:22px; line-height:1.50; opacity:0.88; font-weight:400; }
.bm { position:absolute; bottom:${SAFE_BOTTOM + 10}px; right:72px; font-size:16px; font-weight:700; letter-spacing:2.5px; display:flex; align-items:center; gap:5px; }
.bm .el { color:rgba(255,255,255,0.45); }
.bm .nw { color:${accent}; opacity:0.6; }
</style></head>
<body>
<div class="bar"></div>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <span class="pill">LE SAVIEZ-VOUS ?</span>
  <div class="h">${escapeHtml(slide.heading)}</div>
  ${factsHtml}
</div>
<span class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></span>
</body></html>`;
}

// ── Headline frame ────────────────────────────────────────────────────────

function buildHeadlineFrameHTML(
  slide: IGStorySlide,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = slide.accent ?? DEFAULT_ACCENT;
  const dark = DEFAULT_DARK;

  // Split bullets into main content and source attribution
  const mainBullets: string[] = [];
  let sourceText = "";
  for (const b of slide.bullets) {
    if (b.startsWith("Source:")) {
      sourceText = b;
    } else {
      mainBullets.push(b);
    }
  }

  const bulletsHtml = mainBullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_BODY};
  /* Subtle radial gradient for depth instead of flat dark */
  background: radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.03) 0%, transparent 60%),
              radial-gradient(ellipse at 80% 80%, ${accent}08 0%, transparent 50%),
              ${dark};
  color:#fff; overflow:hidden; position:relative;
}
.bar { position:absolute; left:0; top:0; bottom:0; width:5px; background:${accent}; }
.c {
  height:100%; display:flex; flex-direction:column; justify-content:center;
  padding:${SAFE_TOP + 40}px 80px ${SAFE_BOTTOM + 40}px 100px;
}
.num {
  font-family:${FONT_HEADLINE}; font-size:120px; font-weight:900; color:${accent}; opacity:0.08;
  line-height:0.85; margin-bottom:4px; letter-spacing:-4px;
}
.h {
  font-family:${FONT_HEADLINE}; font-size:46px; font-weight:800; line-height:1.15; letter-spacing:-0.5px;
  margin-bottom:32px;
  overflow:hidden; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical;
}
.bd ul { list-style:none; }
.bd li {
  font-size:24px; line-height:1.6; margin-bottom:18px; opacity:0.82;
  padding-left:32px; position:relative;
}
.bd li::before {
  content:''; position:absolute; left:0; top:12px;
  width:16px; height:2px; background:${accent}; opacity:0.5;
}
.src {
  margin-top:24px; font-size:14px; font-weight:500;
  opacity:0.3; letter-spacing:0.5px;
}
.bm {
  position:absolute; bottom:${SAFE_BOTTOM + 10}px; right:72px;
  font-size:16px; font-weight:700; letter-spacing:2.5px;
  display:flex; align-items:center; gap:5px;
}
.bm .el { color:rgba(255,255,255,0.45); }
.bm .nw { color:${accent}; opacity:0.6; }
</style></head>
<body>
<div class="bar"></div>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="num">${slideIndex}</div>
  <div class="h">${escapeHtml(slide.heading)}</div>
  <div class="bd"><ul>${bulletsHtml}</ul></div>
  ${sourceText ? `<div class="src">${escapeHtml(sourceText)}</div>` : ""}
</div>
<span class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></span>
</body></html>`;
}

// ── CTA closing frame ─────────────────────────────────────────────────────

function buildCtaFrameHTML(
  accent: string,
  slideIndex: number,
  totalSlides: number,
): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_BODY};
  background: radial-gradient(ellipse at 50% 50%, ${accent}15 0%, transparent 70%),
              ${DEFAULT_DARK};
  color:#fff; overflow:hidden; position:relative;
  display:flex; align-items:center; justify-content:center;
}
.c { text-align:center; padding:0 100px; }
.logo {
  font-family:${FONT_HEADLINE}; font-size:42px; font-weight:900; letter-spacing:4px; margin-bottom:48px;
  display:flex; align-items:center; justify-content:center; gap:10px;
}
.logo .el { color:#fff; }
.logo .nw { color:${accent}; }
.line {
  width:60px; height:3px; background:${accent}; opacity:0.4;
  margin:0 auto 48px; border-radius:2px;
}
.msg {
  font-size:28px; font-weight:500; line-height:1.6; opacity:0.7;
  margin-bottom:16px;
}
.msg2 {
  font-size:24px; font-weight:400; line-height:1.6; opacity:0.45;
}
.handle {
  margin-top:48px; font-size:20px; font-weight:700;
  color:${accent}; opacity:0.8; letter-spacing:1px;
}
</style></head>
<body>
${buildProgressDots(slideIndex, totalSlides, accent)}
<div class="c">
  <div class="logo"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
  <div class="line"></div>
  <div class="msg">Suivez-nous pour les dernières<br>actualités éducation & bourses</div>
  <div class="msg2">🇭🇹 Swiv nou pou tout dènye nouvèl<br>sou edikasyon ak bous</div>
  <div class="handle">@edlight.news</div>
</div>
</body></html>`;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Build HTML for a single story frame.
 *
 * Dispatch by `slide.frameType` (v2) with backward-compatible fallback:
 *   "taux"     → financial rate card
 *   "facts"    → daily facts card
 *   "headline" → article summary card (dark bg + accent bar)
 *   "cover"    → full-bleed image cover (legacy default for frame 0)
 *   "cta"      → follow/close frame (auto-appended by asset generator)
 *
 * Legacy slides without `frameType` fall back to positional logic:
 *   Frame 0 → cover, Frame N-1 → CTA, others → headline
 */
export function buildStorySlideHTML(
  slide: IGStorySlide,
  dateLabel: string,
  slideIndex: number,
  totalSlides: number,
  isCta = false,
): string {
  // Explicit CTA flag (from asset generator) takes priority
  if (isCta || slide.frameType === "cta") {
    return buildCtaFrameHTML(slide.accent ?? DEFAULT_ACCENT, slideIndex, totalSlides);
  }

  // v2 frame types
  if (slide.frameType === "taux") {
    return buildTauxFrameHTML(slide, dateLabel, slideIndex, totalSlides);
  }
  if (slide.frameType === "facts") {
    return buildFactsFrameHTML(slide, slideIndex, totalSlides);
  }
  if (slide.frameType === "headline") {
    return buildHeadlineFrameHTML(slide, slideIndex, totalSlides);
  }

  // Legacy fallback: frame 0 = cover, rest = headline
  if (slideIndex === 0) {
    return buildCoverFrameHTML(slide, dateLabel, slideIndex, totalSlides);
  }
  return buildHeadlineFrameHTML(slide, slideIndex, totalSlides);
}

// ── Asset generation ──────────────────────────────────────────────────────

export interface StoryAssetResult {
  mode: "rendered" | "dry-run";
  /** Paths to PNG files (rendered) or HTML files (dry-run) */
  slidePaths: string[];
  /** Base directory for all assets */
  exportDir: string;
}

/**
 * Generate story assets for an IG story queue item.
 *
 * Renders: content slides from payload + auto-appended CTA closing frame.
 * Total frames = payload.slides.length + 1 (CTA).
 *
 * Uses `waitUntil: "networkidle"` so Google Fonts finish loading before
 * the screenshot is taken, ensuring premium Inter typography.
 */
export async function generateStoryAssets(
  queueItem: IGStoryQueueItem,
  payload: IGStoryPayload,
): Promise<StoryAssetResult> {
  const exportDir = `/tmp/ig_stories/${queueItem.id}`;
  mkdirSync(exportDir, { recursive: true });

  const slidePaths: string[] = [];
  let mode: "rendered" | "dry-run" = "dry-run";

  // +1 for the auto-appended CTA frame
  const totalSlides = payload.slides.length + 1;

  // Determine dominant accent (from the first content slide, fallback to default)
  const dominantAccent = payload.slides[1]?.accent ?? payload.slides[0]?.accent ?? DEFAULT_ACCENT;

  try {
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
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
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

    try {
      // Render content slides
      for (let i = 0; i < payload.slides.length; i++) {
        const slide = payload.slides[i]!;
        const html = buildStorySlideHTML(slide, payload.dateLabel, i, totalSlides);
        const pngPath = join(exportDir, `story_${i + 1}.png`);
        await renderFrameToFile(browser, html, pngPath);
        slidePaths.push(pngPath);
      }

      // Render CTA closing frame
      const ctaSlide: IGStorySlide = { heading: "", bullets: [], accent: dominantAccent };
      const ctaHtml = buildStorySlideHTML(ctaSlide, payload.dateLabel, totalSlides - 1, totalSlides, true);
      const ctaPath = join(exportDir, `story_cta.png`);
      await renderFrameToFile(browser, ctaHtml, ctaPath);
      slidePaths.push(ctaPath);

      mode = "rendered";
    } finally {
      await browser.close();
    }
  } catch {
    console.warn("[ig-story] Chromium unavailable, using dry-run HTML mode");

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      const html = buildStorySlideHTML(slide, payload.dateLabel, i, totalSlides);
      const htmlPath = join(exportDir, `story_${i + 1}.html`);
      writeFileSync(htmlPath, html, "utf-8");
      slidePaths.push(htmlPath);
    }

    // CTA dry-run
    const ctaSlide: IGStorySlide = { heading: "", bullets: [], accent: dominantAccent };
    const ctaHtml = buildStorySlideHTML(ctaSlide, payload.dateLabel, totalSlides - 1, totalSlides, true);
    const ctaPath = join(exportDir, `story_cta.html`);
    writeFileSync(ctaPath, ctaHtml, "utf-8");
    slidePaths.push(ctaPath);
  }

  return { mode, slidePaths, exportDir };
}

/**
 * Render a single HTML frame to a PNG file using Playwright.
 * Waits for network idle to ensure Google Fonts are fully loaded.
 */
async function renderFrameToFile(
  browser: import("playwright-core").Browser,
  html: string,
  outPath: string,
): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 2 });
  try {
    await page.setContent(html, { waitUntil: "networkidle", timeout: 60_000 });
    // Extra font-loading safety: wait for document.fonts.ready
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    await page.evaluate("document.fonts.ready");
    const buffer = await page.screenshot({ type: "png", timeout: 60_000 });
    writeFileSync(outPath, Buffer.from(buffer));
  } finally {
    await page.close();
  }
}
