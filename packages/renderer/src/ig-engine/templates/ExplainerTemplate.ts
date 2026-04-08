/**
 * @edlight-news/renderer – Explainer Carousel template
 *
 * Multi-slide layout for policy, economics, technology, science, and
 * civic education content.
 * Canvas: 1080×1350 (4:5 portrait)
 *
 * Key design rule (IG_COPILOT.md §7):
 *   Each slide must simplify ONE concept only.
 *
 * Default slide sequence:
 *   1. Cover — topic + teaser question
 *   2–N. One concept per slide
 *   Last. Summary + CTA
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
 * Build HTML for a single Explainer Carousel slide.
 */
export function buildExplainerSlide(
  slide: SlideContent,
  contentType: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = getBrandAccent(contentType);
  const bg = getBrandBackground(contentType);
  const label = slide.label ?? getBrandLabel(contentType);

  if (slide.layoutVariant === "cta") return buildExpCtaSlide(slide, accent, bg, totalSlides);
  if (slideIndex === 0) return buildExpCoverSlide(slide, accent, bg, label, totalSlides);
  return buildExpConceptSlide(slide, accent, bg, label, slideIndex, totalSlides);
}

// ── Cover slide ───────────────────────────────────────────────────────────────

function buildExpCoverSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  totalSlides: number,
): string {
  const hlSize = expCoverSize(slide.headline);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:28px; }
.explainer-label { font-family:${fonts.headline};font-size:20px;font-weight:600;text-transform:uppercase;letter-spacing:4px;opacity:0.45; }
.headline { font-family:${fonts.headline};font-size:${hlSize}px;font-weight:900;line-height:1.08;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical; }
.deck { font-family:${fonts.body};font-size:30px;font-weight:400;line-height:1.5;opacity:0.7;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical; }
.slide-nav { font-family:${fonts.headline};font-size:18px;font-weight:600;opacity:0.35;letter-spacing:2px;text-transform:uppercase;margin-top:8px; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">1 / ${totalSlides}</span>
  </div>
  <div class="mid">
    <p class="explainer-label">Comprendre</p>
    <p class="headline">${escapeHtml(slide.headline)}</p>
    ${slide.supportLine ? `<p class="deck">${escapeHtml(slide.supportLine)}</p>` : ""}
    <p class="slide-nav">Glissez pour lire →</p>
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── Concept slide (one idea per slide) ───────────────────────────────────────

function buildExpConceptSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  slideIndex: number,
  totalSlides: number,
): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:32px; }
.concept-num { font-family:${fonts.headline};font-size:80px;font-weight:900;color:${accent};opacity:0.2;line-height:1;letter-spacing:-3px; }
.headline { font-family:${fonts.headline};font-size:52px;font-weight:800;line-height:1.1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical; }
.divider { width:60px;height:3px;background:${accent};border-radius:2px; }
.body { font-family:${fonts.body};font-size:32px;line-height:1.6;overflow:hidden;display:-webkit-box;-webkit-line-clamp:8;-webkit-box-orient:vertical; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">${slideIndex + 1} / ${totalSlides}</span>
  </div>
  <div class="mid">
    <p class="concept-num">0${slideIndex}</p>
    <p class="headline">${escapeHtml(slide.headline)}</p>
    <div class="divider"></div>
    ${slide.body ? `<p class="body">${escapeHtml(slide.body)}</p>` : ""}
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── CTA / summary slide ───────────────────────────────────────────────────────

function buildExpCtaSlide(
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
.summary { font-family:${fonts.body};font-size:34px;font-weight:500;line-height:1.5;opacity:0.75;max-width:860px; }
.handle { font-family:${fonts.headline};font-size:38px;font-weight:800;color:${accent}; }
.badge { position:absolute;top:92px;right:90px;font-family:${fonts.headline};font-size:17px;opacity:0.25;letter-spacing:1px; }
</style></head><body>
<div class="canvas">
  <div class="wordmark"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
  <div class="rule"></div>
  <p class="summary">${escapeHtml(slide.body ?? "Éducation, économie, politique — tout ce que vous devez comprendre.")}</p>
  <p class="handle">@edlight.news</p>
</div>
<span class="badge">${totalSlides} / ${totalSlides}</span>
</body></html>`;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function base(bg: string): string {
  return `* { margin:0;padding:0;box-sizing:border-box; }
body { width:1080px;height:1350px;font-family:${fonts.body};background:${bg};color:#fff;overflow:hidden;position:relative; }`;
}

function expCoverSize(headline: string): number {
  const words = headline.trim().split(/\s+/).length;
  if (words <= 5) return 80;
  if (words <= 8) return 70;
  return 58;
}
