/**
 * @edlight-news/renderer – IG Story asset generation
 *
 * Renders 1080×1920 (9:16) story frames for the daily summary story.
 * Each frame becomes a single image posted as an IG Story.
 *
 * Design language:
 *  - Cover frame: bold headline with background image + heavy overlay
 *  - Headline frames: dark card with accent bar + swipe-up indicator
 *  - Branding: "EDLIGHT NEWS" bottom-right on every frame
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IGStorySlide, IGStoryPayload, IGStoryQueueItem } from "@edlight-news/types";

// ── Design tokens ─────────────────────────────────────────────────────────

const FONT_STACK =
  "'Inter', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const DEFAULT_ACCENT = "#14b8a6"; // teal — matches "news" type
const DEFAULT_DARK = "#060f0b";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── HTML builders ─────────────────────────────────────────────────────────

/**
 * Build HTML for the cover frame (first story image).
 * Full-bleed background image with a strong bottom overlay.
 */
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
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_STACK};
  background: ${DEFAULT_DARK} ${slide.backgroundImage ? `url('${slide.backgroundImage}') center/cover no-repeat` : ""};
  color:#fff; overflow:hidden; position:relative;
}
.overlay {
  position:absolute; inset:0;
  background: linear-gradient(180deg,
    rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.15) 25%,
    rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.88) 100%);
}
.c { position:relative; z-index:1; height:100%; display:flex; flex-direction:column; justify-content:flex-end; padding:80px 72px 120px; }
.date { font-size:18px; font-weight:600; text-transform:uppercase; letter-spacing:4px; opacity:0.6; margin-bottom:20px; }
.dot { display:inline-block; width:8px; height:8px; background:${accent}; border-radius:50%; margin-right:10px; vertical-align:middle; }
.h { font-size:62px; font-weight:800; line-height:1.08; letter-spacing:-1px;
  text-shadow:0 3px 40px rgba(0,0,0,0.8), 0 1px 6px rgba(0,0,0,0.5);
  margin-bottom:32px; }
.sub ul { list-style:none; }
.sub li { font-size:24px; font-weight:400; line-height:1.5; opacity:0.85;
  text-shadow:0 1px 12px rgba(0,0,0,0.6); margin-bottom:6px; }
.bm { margin-top:48px; font-size:20px; font-weight:700; letter-spacing:3px; display:flex; align-items:center; gap:6px; }
.bm .el { color:#fff; opacity:0.9; }
.bm .nw { color:${accent}; opacity:0.9; }
.pg { position:absolute; top:72px; right:72px; font-size:15px; opacity:0.3; letter-spacing:1px; }
.swipe { position:absolute; bottom:40px; left:50%; transform:translateX(-50%); font-size:14px; text-transform:uppercase; letter-spacing:3px; opacity:0.35; }
</style></head>
<body>
<div class="overlay"></div>
<span class="pg">${slideIndex + 1} / ${totalSlides}</span>
<div class="c">
  <div class="date"><span class="dot"></span>${escapeHtml(dateLabel)}</div>
  <div class="h">${escapeHtml(slide.heading)}</div>
  <div class="sub"><ul>${bulletsHtml}</ul></div>
  <div class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
</div>
<div class="swipe">▲ SWIPE</div>
</body></html>`;
}

/**
 * Build HTML for a headline frame (subsequent story images).
 * Dark background with accent bar on the left, number badge.
 */
function buildHeadlineFrameHTML(
  slide: IGStorySlide,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = slide.accent ?? DEFAULT_ACCENT;
  const dark = DEFAULT_DARK;
  const bulletsHtml = slide.bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1920px;
  font-family: ${FONT_STACK};
  background:${dark}; color:#fff; overflow:hidden; position:relative;
}
.bar { position:absolute; left:0; top:0; bottom:0; width:6px; background:${accent}; }
.c { height:100%; display:flex; flex-direction:column; justify-content:center; padding:120px 80px 140px 100px; }
.num { font-size:100px; font-weight:800; color:${accent}; opacity:0.15; line-height:1; margin-bottom:8px; }
.h { font-size:50px; font-weight:700; line-height:1.15; letter-spacing:-0.3px; margin-bottom:36px;
  overflow:hidden; display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; }
.bd ul { list-style:none; }
.bd li { font-size:26px; line-height:1.6; margin-bottom:20px; opacity:0.8; padding-left:36px; position:relative; }
.bd li::before { content:'\\2014'; position:absolute; left:0; color:${accent}; opacity:0.5; }
.bm { position:absolute; bottom:80px; right:72px; font-size:18px; font-weight:700; letter-spacing:2.5px; display:flex; align-items:center; gap:5px; }
.bm .el { color:rgba(255,255,255,0.5); }
.bm .nw { color:${accent}; opacity:0.7; }
.pg { position:absolute; top:72px; right:72px; font-size:15px; opacity:0.3; letter-spacing:1px; }
.swipe { position:absolute; bottom:40px; left:50%; transform:translateX(-50%); font-size:14px; text-transform:uppercase; letter-spacing:3px; opacity:0.3; }
</style></head>
<body>
<div class="bar"></div>
<span class="pg">${slideIndex + 1} / ${totalSlides}</span>
<div class="c">
  <div class="num">${slideIndex}</div>
  <div class="h">${escapeHtml(slide.heading)}</div>
  <div class="bd"><ul>${bulletsHtml}</ul></div>
</div>
<span class="bm"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></span>
<div class="swipe">▲ SWIPE</div>
</body></html>`;
}

/**
 * Pick the right HTML builder per slide position.
 */
export function buildStorySlideHTML(
  slide: IGStorySlide,
  dateLabel: string,
  slideIndex: number,
  totalSlides: number,
): string {
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
 * When Chromium is available, renders 1080×1920 PNGs.
 * Otherwise falls back to dry-run HTML exports.
 */
export async function generateStoryAssets(
  queueItem: IGStoryQueueItem,
  payload: IGStoryPayload,
): Promise<StoryAssetResult> {
  const exportDir = `/tmp/ig_stories/${queueItem.id}`;
  mkdirSync(exportDir, { recursive: true });

  const slidePaths: string[] = [];
  let mode: "rendered" | "dry-run" = "dry-run";
  const totalSlides = payload.slides.length;

  try {
    // Dynamic import so we don't hard-depend on playwright
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
      for (let i = 0; i < payload.slides.length; i++) {
        const slide = payload.slides[i]!;
        const html = buildStorySlideHTML(slide, payload.dateLabel, i, totalSlides);
        const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
        try {
          await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
          const buffer = await page.screenshot({ type: "png", timeout: 60_000 });
          const pngPath = join(exportDir, `story_${i + 1}.png`);
          writeFileSync(pngPath, Buffer.from(buffer));
          slidePaths.push(pngPath);
        } finally {
          await page.close();
        }
      }
      mode = "rendered";
    } finally {
      await browser.close();
    }
  } catch {
    // Chromium not available — dry-run HTML export
    console.warn("[ig-story] Chromium unavailable, using dry-run HTML mode");

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      const html = buildStorySlideHTML(slide, payload.dateLabel, i, totalSlides);
      const htmlPath = join(exportDir, `story_${i + 1}.html`);
      writeFileSync(htmlPath, html, "utf-8");
      slidePaths.push(htmlPath);
    }
  }

  return { mode, slidePaths, exportDir };
}
