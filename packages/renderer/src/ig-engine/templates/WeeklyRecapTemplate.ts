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
import { getTemplateConfig } from "../config/templateLimits.js";
import { resolveZone, resolveEffectiveFontSize } from "../types/post.js";
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

  const cfg = getTemplateConfig("weekly-recap-carousel");
  const hlZone = resolveZone(cfg, "headline", "cover")!;
  const hlSize = resolveEffectiveFontSize(hlZone, slide.headline);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:24px; }
.week-label { font-family:${fonts.headline};font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:5px;opacity:0.45; }
.headline { font-family:${fonts.headline};font-size:${hlSize}px;font-weight:900;line-height:${hlZone.lineHeight};overflow:hidden;display:-webkit-box;-webkit-line-clamp:${hlZone.limits.maxLines ?? 4};-webkit-box-orient:vertical; }
.story-count { display:inline-flex;align-items:center;gap:14px;margin-top:12px; }
.count-badge { background:${accent};color:#000;font-family:${fonts.headline};font-size:32px;font-weight:900;padding:8px 20px;border-radius:4px; }
.count-text { font-family:${fonts.body};font-size:26px;opacity:0.65; }
.swipe { font-family:${fonts.headline};font-size:18px;font-weight:600;opacity:0.35;letter-spacing:2px;text-transform:uppercase;margin-top:8px; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
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

  const cfg = getTemplateConfig("weekly-recap-carousel");
  const hlZone = resolveZone(cfg, "headline", "detail")!;
  const bodyZone = resolveZone(cfg, "body", "detail")!;
  const hlSize = resolveEffectiveFontSize(hlZone, slide.headline);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:28px; }
.story-num { font-family:${fonts.headline};font-size:100px;font-weight:900;line-height:1;color:${accent};opacity:0.2;letter-spacing:-4px; }
.headline { font-family:${fonts.headline};font-size:${hlSize}px;font-weight:800;line-height:${hlZone.lineHeight};overflow:hidden;display:-webkit-box;-webkit-line-clamp:${hlZone.limits.maxLines ?? 3};-webkit-box-orient:vertical; }
.divider { width:60px;height:3px;background:${accent};border-radius:2px; }
.body { font-family:${fonts.body};font-size:${bodyZone.fontSize}px;line-height:${bodyZone.lineHeight};overflow:hidden;display:-webkit-box;-webkit-line-clamp:${bodyZone.limits.maxLines ?? 7};-webkit-box-orient:vertical; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
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
  const hasImage = Boolean(slide.imageUrl);
  const bodyBg = hasImage ? `${bg} url('${slide.imageUrl}') center/cover no-repeat` : bg;
  const overlay = hasImage
    ? `linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 40%, rgba(0,0,0,0.6) 70%, rgba(0,0,0,0.92) 100%)`
    : `radial-gradient(ellipse at 50% 110%, ${bg}cc 0%, transparent 65%)`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
* { margin:0;padding:0;box-sizing:border-box; }
body { width:1080px;height:1350px;font-family:${fonts.body};background:${bodyBg};color:#fff;overflow:hidden;position:relative; }
${hasImage ? `.img-overlay { position:absolute;inset:0;background:${overlay};pointer-events:none; }` : ""}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:80px 90px; }
.top-brand { display:flex;align-items:center;gap:10px;font-family:${fonts.headline};font-size:24px;font-weight:900;letter-spacing:4px; }
.top-brand .el { color:rgba(255,255,255,0.88); }
.top-brand .nw { color:${accent}; }
.top-rule { width:56px;height:3px;background:${accent};border-radius:2px;margin-top:14px; }
.center { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:32px; }
.display-h { font-family:${fonts.headline};font-size:80px;font-weight:900;line-height:1.02;letter-spacing:-2px;text-shadow:0 4px 48px rgba(0,0,0,0.9),0 2px 16px rgba(0,0,0,0.7); }
.rule { width:72px;height:4px;background:${accent};border-radius:2px; }
.tagline { font-family:${fonts.body};font-size:34px;font-weight:500;line-height:1.45;opacity:0.88;max-width:820px;text-shadow:0 2px 24px rgba(0,0,0,0.7); }
.handle { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:26px;font-weight:900;letter-spacing:3px;text-transform:uppercase;padding:18px 48px;border-radius:8px;box-shadow:0 8px 32px ${accent}55; }
</style></head><body>
${hasImage ? `<div class="img-overlay"></div>` : ""}
<div class="canvas">
  <div>
    <div class="top-brand"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
    <div class="top-rule"></div>
  </div>
  <div class="center">
    <p class="display-h">${escapeHtml(slide.headline ?? "Suivez EdLight News")}</p>
    <div class="rule"></div>
    <p class="tagline">${escapeHtml(slide.body ?? "Chaque semaine, les informations les plus importantes pour les étudiants haïtiens.")}</p>
    <div class="handle">@edlightnews</div>
  </div>
  <span></span>
</div>
</body></html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function base(bg: string): string {
  return `* { margin:0;padding:0;box-sizing:border-box; }
body { width:1080px;height:1350px;font-family:${fonts.body};background:${bg};color:#fff;overflow:hidden;position:relative; }`;
}
