/**
 * @edlight-news/renderer – Weekly Recap Carousel template
 *
 * Multi-slide layout for weekly roundups and top-story collections.
 * Canvas: 1080×1350 (4:5 portrait)
 *
 * Key design rule (IG_COPILOT.md §7):
 *   Each story card inside the recap must be visually parallel.
 *
 * Default slide sequence:
 *   1. Cover — week identifier + count of stories
 *   2–N. One story per slide (numbered, visually parallel)
 *   Last. CTA + follow prompt
 */

import type { SlideContent } from "../types/post.js";
import {
  BRAND,
  GOOGLE_FONTS_LINK,
  escapeHtml,
  getBrandAccent,
  getBrandBackground,
  getBrandLabel,
  footerBarHtml,
  premiumAtmosphereHtml,
} from "../config/brand.js";

const { fonts } = BRAND;

/**
 * Build HTML for a single Weekly Recap Carousel slide.
 */
export function buildWeeklyRecapSlide(
  slide: SlideContent,
  contentType: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = getBrandAccent(contentType);
  const bg = getBrandBackground(contentType);
  const label = slide.label ?? getBrandLabel(contentType);

  if (slide.layoutVariant === "cta") return buildRecapCtaSlide(slide, accent, bg, totalSlides);
  if (slideIndex === 0) return buildRecapCoverSlide(slide, accent, bg, label, totalSlides);
  return buildRecapStorySlide(slide, accent, bg, label, slideIndex, totalSlides);
}

// ── Cover slide ───────────────────────────────────────────────────────────────

function buildRecapCoverSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  totalSlides: number,
): string {
  // Number of story slides (total minus cover and CTA)
  const storyCount = totalSlides - 2;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px; }
.week-label { font-family:${fonts.headline};font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:5px;opacity:0.45; }
.headline { font-family:${fonts.headline};font-size:${recapCoverSize(slide.headline)}px;font-weight:900;line-height:1.08;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical; }
.story-count { display:inline-flex;align-items:center;gap:14px;margin-top:12px; }
.count-badge { background:${accent};color:#000;font-family:${fonts.headline};font-size:32px;font-weight:900;padding:8px 20px;border-radius:4px; }
.count-text { font-family:${fonts.body};font-size:26px;opacity:0.65; }
.swipe { font-family:${fonts.headline};font-size:18px;font-weight:600;opacity:0.35;letter-spacing:2px;text-transform:uppercase;margin-top:8px; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">1 / ${totalSlides}</span>
  </div>
  <div class="mid">
    <p class="week-label">Résumé de la semaine</p>
    <p class="headline">${escapeHtml(slide.headline)}</p>
    ${storyCount > 0 ? `<div class="story-count"><span class="count-badge">${storyCount}</span><span class="count-text">histoires à retenir</span></div>` : ""}
    <p class="swipe">Glissez pour lire →</p>
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── Story card (visually parallel) ───────────────────────────────────────────

function buildRecapStorySlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const storyNum = slideIndex; // 1-based story number within the recap

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:28px; }
.story-num { font-family:${fonts.headline};font-size:100px;font-weight:900;line-height:1;color:${accent};opacity:0.2;letter-spacing:-4px; }
.headline { font-family:${fonts.headline};font-size:${recapStorySize(slide.headline)}px;font-weight:800;line-height:1.1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical; }
.divider { width:60px;height:3px;background:${accent};border-radius:2px; }
.body { font-family:${fonts.body};font-size:30px;line-height:1.55;overflow:hidden;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">${slideIndex + 1} / ${totalSlides}</span>
  </div>
  <div class="mid">
    <p class="story-num">${String(storyNum).padStart(2, "0")}</p>
    <p class="headline">${escapeHtml(slide.headline)}</p>
    <div class="divider"></div>
    ${slide.body ? `<p class="body">${escapeHtml(slide.body)}</p>` : ""}
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── CTA slide ─────────────────────────────────────────────────────────────────

function buildRecapCtaSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  totalSlides: number,
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:90px;gap:36px;text-align:center; }
.wordmark { font-family:${fonts.headline};font-size:30px;font-weight:800;letter-spacing:4px;display:flex;gap:10px; }
.wordmark .el { color:rgba(255,255,255,0.9); }
.wordmark .nw { color:${accent}; }
.rule { width:80px;height:3px;background:${accent};border-radius:2px; }
.cta { font-family:${fonts.body};font-size:34px;font-weight:500;line-height:1.45;opacity:0.75;max-width:820px; }
.handle { font-family:${fonts.headline};font-size:38px;font-weight:800;color:${accent}; }
.badge { position:absolute;top:92px;right:90px;font-family:${fonts.headline};font-size:17px;opacity:0.25;letter-spacing:1px; }
</style></head><body>
<div class="canvas">
  <div class="wordmark"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
  <div class="rule"></div>
  <p class="cta">${escapeHtml(slide.body ?? "Chaque semaine, les informations les plus importantes pour les étudiants haïtiens.")}</p>
  <p class="handle">@edlight.news</p>
</div>
<span class="badge">${totalSlides} / ${totalSlides}</span>
</body></html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function base(bg: string): string {
  return `* { margin:0;padding:0;box-sizing:border-box; }
body { width:1080px;height:1350px;font-family:${fonts.body};background:${bg};color:#fff;overflow:hidden;position:relative; }`;
}

function recapCoverSize(headline: string): number {
  const words = headline.trim().split(/\s+/).length;
  if (words <= 5) return 80;
  if (words <= 8) return 70;
  return 60;
}

function recapStorySize(headline: string): number {
  const words = headline.trim().split(/\s+/).length;
  if (words <= 6) return 64;
  if (words <= 9) return 56;
  return 48;
}
