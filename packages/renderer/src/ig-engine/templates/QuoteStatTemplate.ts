/**
 * @edlight-news/renderer – Quote / Stat Card template
 *
 * Single- or double-slide layout for one memorable data point or statement.
 * Canvas: 1080×1350 (4:5 portrait)
 *
 * Key design rule (IG_COPILOT.md §7):
 *   Typography must do the heavy lifting.
 *
 * Variants:
 *   - stat:  Giant number (e.g. "94 %") + description line
 *   - quote: Pull-quote text, large, with attribution
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
 * Build HTML for a Quote / Stat Card slide.
 */
export function buildQuoteStatSlide(
  slide: SlideContent,
  contentType: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = getBrandAccent(contentType);
  const bg = getBrandBackground(contentType);
  const label = slide.label ?? getBrandLabel(contentType);

  // Stat variant: statValue is present
  if (slide.statValue) {
    return buildStatSlide(slide, accent, bg, label, slideIndex, totalSlides);
  }

  // Quote variant: large headline text
  return buildQuoteSlide(slide, accent, bg, label, slideIndex, totalSlides);
}

// ── Stat slide ────────────────────────────────────────────────────────────────

function buildStatSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const cfg = getTemplateConfig("quote-stat-card");
  const statZone = resolveZone(cfg, "statValue", "stat")!;
  const descZone = resolveZone(cfg, "statDescription", "stat")!;
  const ctxZone = resolveZone(cfg, "body", "stat");
  const statSize = resolveEffectiveFontSize(statZone, slide.statValue ?? "");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:20px; }
.stat { font-family:${fonts.headline};font-size:${statSize}px;font-weight:900;line-height:${statZone.lineHeight};letter-spacing:-4px;color:${accent};overflow:hidden;display:-webkit-box;-webkit-line-clamp:${statZone.limits.maxLines ?? 2};-webkit-box-orient:vertical; }
.rule { width:80px;height:5px;background:${accent};border-radius:2px; }
.desc { font-family:${fonts.body};font-size:${descZone.fontSize}px;font-weight:500;line-height:${descZone.lineHeight};overflow:hidden;display:-webkit-box;-webkit-line-clamp:${descZone.limits.maxLines ?? 3};-webkit-box-orient:vertical; }
.context { font-family:${fonts.body};font-size:${ctxZone?.fontSize ?? 26}px;line-height:${ctxZone?.lineHeight ?? 1.4};opacity:0.55;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${ctxZone?.limits.maxLines ?? 2};-webkit-box-orient:vertical;margin-top:8px; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">EDLIGHT NEWS</span>
  </div>
  <div class="mid">
    <p class="stat">${escapeHtml(slide.statValue ?? "")}</p>
    <div class="rule"></div>
    <p class="desc">${escapeHtml(slide.statDescription ?? slide.headline)}</p>
    ${slide.body ? `<p class="context">${escapeHtml(slide.body)}</p>` : ""}
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── Quote slide ───────────────────────────────────────────────────────────────

function buildQuoteSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const cfg = getTemplateConfig("quote-stat-card");
  const hlZone = resolveZone(cfg, "headline", "quote")!;
  const quoteSize = resolveEffectiveFontSize(hlZone, slide.headline);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:28px; }
.open-quote { font-family:${fonts.headline};font-size:120px;font-weight:900;color:${accent};line-height:0.8;opacity:0.5; }
.quote-text { font-family:${fonts.headline};font-size:${quoteSize}px;font-weight:700;line-height:${hlZone.lineHeight};overflow:hidden;display:-webkit-box;-webkit-line-clamp:${hlZone.limits.maxLines ?? 7};-webkit-box-orient:vertical; }
.attribution { font-family:${fonts.body};font-size:26px;opacity:0.6;margin-top:8px; }
.rule { width:60px;height:3px;background:${accent};border-radius:2px; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">EDLIGHT NEWS</span>
  </div>
  <div class="mid">
    <span class="open-quote">"</span>
    <p class="quote-text">${escapeHtml(slide.headline)}</p>
    <div class="rule"></div>
    ${slide.supportLine ? `<p class="attribution">— ${escapeHtml(slide.supportLine)}</p>` : ""}
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function base(bg: string): string {
  return `* { margin:0;padding:0;box-sizing:border-box; }
body { width:1080px;height:1350px;font-family:${fonts.body};background:${bg};color:#fff;overflow:hidden;position:relative; }`;
}

