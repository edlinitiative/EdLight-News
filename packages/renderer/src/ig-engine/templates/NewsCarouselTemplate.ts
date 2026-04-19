/**
 * @edlight-news/renderer – News Carousel template
 *
 * Multi-slide layout for news stories that require context.
 * Canvas: 1080×1350 (4:5 portrait)
 *
 * Default slide sequence (per IG_COPILOT.md §7):
 *   1. Headline (cover)
 *   2. What happened
 *   3. Why it matters
 *   4. Key number / quote
 *   5. What comes next
 *
 * Slide variants:
 *   - cover:  Big headline, category pill, optional image
 *   - detail: Medium headline + body bullets
 *   - data:   Giant stat number + description
 *   - cta:    Follow prompt / swipe CTA
 */

import type { SlideContent } from "../types/post.js";
import { resolveZone, resolveEffectiveFontSize } from "../types/post.js";
import { getTemplateConfig } from "../config/templateLimits.js";
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
 * Build HTML for a single News Carousel slide.
 *
 * @param slide       Validated slide content
 * @param contentType Content type key (e.g. "news")
 * @param slideIndex  0-based slide index
 * @param totalSlides Total slides in the carousel
 */
export function buildNewsCarouselSlide(
  slide: SlideContent,
  contentType: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = getBrandAccent(contentType);
  const bg = getBrandBackground(contentType);
  const label = slide.label ?? getBrandLabel(contentType);
  const variant = slide.layoutVariant ?? (slideIndex === 0 ? "cover" : "detail");

  if (variant === "data") return buildDataSlide(slide, accent, bg, label, slideIndex, totalSlides);
  if (variant === "cta") return buildCtaSlide(slide, accent, bg, totalSlides);
  if (slideIndex === 0) return buildCoverSlide(slide, accent, bg, label, totalSlides);
  return buildDetailSlide(slide, accent, bg, label, slideIndex, totalSlides);
}

// ── Cover slide ───────────────────────────────────────────────────────────────

function buildCoverSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  totalSlides: number,
): string {
  const hasImage = Boolean(slide.imageUrl);
  const bodyBg = hasImage ? `${bg} url('${slide.imageUrl}') center/cover no-repeat` : bg;
  const overlay = hasImage
    ? `linear-gradient(to bottom, ${bg}dd 0%, ${bg}55 35%, ${bg}99 65%, ${bg}f5 100%)`
    : `radial-gradient(ellipse at 50% 110%, ${bg}cc 0%, transparent 65%)`;

  const cfg = getTemplateConfig("news-carousel");
  const hlZone = resolveZone(cfg, "headline", "cover")!;
  const hasDeck = Boolean(slide.supportLine);
  const hlSize = resolveEffectiveFontSize(hlZone, slide.headline);
  const hlClamp = hasDeck ? Math.min(hlZone.limits.maxLines ?? 3, 3) : (hlZone.limits.maxLines ?? 6);
  const deckZone = resolveZone(cfg, "supportLine", "cover")!;
  const factZone = resolveZone(cfg, "body", "cover")!;
  const coverFacts = slide.body ? slide.body.split(/\n|•/).map(s => s.trim()).filter(Boolean) : [];

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${baseReset(bg, bodyBg)}
.overlay { position:absolute;inset:0;background:${overlay};pointer-events:none; }
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:20px;padding-bottom:${hasDeck ? '40' : '80'}px; }
.headline { font-family:${fonts.headline};font-size:${hlSize}px;font-weight:900;line-height:${hlZone.lineHeight};letter-spacing:-0.5px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${hlClamp};-webkit-box-orient:vertical; }
.deck-rule { width:72px;height:3px;background:${accent};border-radius:2px;margin:4px 0; }
.deck { font-family:${fonts.body};font-size:${deckZone.fontSize}px;font-weight:500;line-height:${deckZone.lineHeight};opacity:0.88;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${deckZone.limits.maxLines ?? 3};-webkit-box-orient:vertical; }
.cover-facts { display:flex;flex-direction:column;gap:12px;margin-top:4px; }
.cover-fact { display:flex;gap:14px;align-items:flex-start;font-family:${fonts.body};font-size:${factZone.fontSize}px;font-weight:400;line-height:${factZone.lineHeight};opacity:0.78;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${factZone.limits.perBulletMaxLines ?? 2};-webkit-box-orient:vertical; }
.fact-dot { width:7px;height:7px;border-radius:50%;background:${accent};flex-shrink:0;margin-top:11px; }
</style></head><body>
<div class="overlay"></div>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
  </div>
  <div class="mid">
    <p class="headline">${escapeHtml(slide.headline)}</p>
    ${hasDeck ? `<div class="deck-rule"></div>
    <p class="deck">${escapeHtml(slide.supportLine!)}</p>` : ''}
    ${coverFacts.length > 0 ? `<div class="cover-facts">${coverFacts.map(f => `<div class="cover-fact"><div class="fact-dot"></div><span style="flex:1">${escapeHtml(f)}</span></div>`).join('')}</div>` : ''}
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── Detail slide ──────────────────────────────────────────────────────────────

function buildDetailSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const cfg = getTemplateConfig("news-carousel");
  const hlZone = resolveZone(cfg, "headline", "detail")!;
  const bodyZone = resolveZone(cfg, "body", "detail")!;
  // Only treat as a bulleted list when the original body actually contains
  // explicit separators (newline or bullet character). A single paragraph
  // must fall through to the <p> path (clamp:8) to avoid 3-line truncation.
  const hasBullets = slide.body ? /\n|•/.test(slide.body) : false;
  const bullets = hasBullets
    ? slide.body!.split(/\n|•/).map(s => s.trim()).filter(Boolean)
    : [];

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${baseReset(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:28px; }
.headline { font-family:${fonts.headline};font-size:${hlZone.fontSize}px;font-weight:800;line-height:${hlZone.lineHeight};letter-spacing:-0.3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${hlZone.limits.maxLines ?? 3};-webkit-box-orient:vertical; }
.body { display:flex;flex-direction:column;gap:16px; }
.bullet { display:flex;gap:16px;align-items:flex-start;font-family:${fonts.body};font-size:${bodyZone.fontSize}px;font-weight:400;line-height:${bodyZone.lineHeight};overflow:hidden;display:-webkit-box;-webkit-line-clamp:${bodyZone.limits.perBulletMaxLines ?? 3};-webkit-box-orient:vertical; }
.bullet-dot { width:8px;height:8px;border-radius:50%;background:${accent};flex-shrink:0;margin-top:12px; }
.divider { width:60px;height:3px;background:${accent};border-radius:2px; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
  </div>
  <div class="mid">
    <p class="headline">${escapeHtml(slide.headline)}</p>
    <div class="divider"></div>
    <div class="body">
      ${bullets.length
        ? bullets.map(b => `<div style="display:flex;gap:16px;align-items:flex-start"><div class="bullet-dot"></div><span style="font-family:${fonts.body};font-size:${bodyZone.fontSize}px;font-weight:400;line-height:${bodyZone.lineHeight};flex:1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${bodyZone.limits.perBulletMaxLines ?? 3};-webkit-box-orient:vertical">${escapeHtml(b)}</span></div>`).join("")
        : slide.body ? `<p style="font-family:${fonts.body};font-size:${bodyZone.fontSize}px;line-height:${bodyZone.lineHeight};overflow:hidden;display:-webkit-box;-webkit-line-clamp:${bodyZone.limits.maxLines ?? 8};-webkit-box-orient:vertical">${escapeHtml(slide.body)}</p>` : ""}
    </div>
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── Data slide ────────────────────────────────────────────────────────────────

function buildDataSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const cfg = getTemplateConfig("news-carousel");
  const statZone = resolveZone(cfg, "statValue", "data")!;
  const statSize = resolveEffectiveFontSize(statZone, slide.statValue ?? "");
  const descZone = resolveZone(cfg, "statDescription", "data")!;
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${baseReset(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:24px; }
.stat { font-family:${fonts.headline};font-size:${statSize}px;font-weight:900;line-height:${statZone.lineHeight};letter-spacing:-4px;color:${accent};overflow:hidden;display:-webkit-box;-webkit-line-clamp:${statZone.limits.maxLines ?? 2};-webkit-box-orient:vertical; }
.desc { font-family:${fonts.body};font-size:${descZone.fontSize}px;font-weight:500;line-height:${descZone.lineHeight};opacity:0.85;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${descZone.limits.maxLines ?? 3};-webkit-box-orient:vertical; }
.rule { width:80px;height:4px;background:${accent};border-radius:2px; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
  </div>
  <div class="mid">
    <p class="stat">${escapeHtml(slide.statValue ?? "—")}</p>
    <div class="rule"></div>
    <p class="desc">${escapeHtml(slide.statDescription ?? slide.headline)}</p>
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── CTA slide ─────────────────────────────────────────────────────────────────

function buildCtaSlide(
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
${baseReset(bg, bodyBg)}
${hasImage ? `.img-overlay { position:absolute;inset:0;background:${overlay};pointer-events:none; }` : ""}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:80px 90px; }
.top-brand { display:flex;align-items:center;gap:10px;font-family:${fonts.headline};font-size:24px;font-weight:900;letter-spacing:4px; }
.top-brand .el { color:rgba(255,255,255,0.88); }
.top-brand .nw { color:${accent}; }
.top-rule { width:56px;height:3px;background:${accent};border-radius:2px;margin-top:14px; }
.center { flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:32px; }
.display-h { font-family:${fonts.headline};font-size:80px;font-weight:900;line-height:1.02;letter-spacing:-2px;text-shadow:0 4px 48px rgba(0,0,0,0.9),0 2px 16px rgba(0,0,0,0.7); }
.rule { width:72px;height:4px;background:${accent};border-radius:2px; }
.tagline { font-family:${fonts.body};font-size:34px;font-weight:500;line-height:1.45;opacity:0.88;max-width:800px;text-shadow:0 2px 24px rgba(0,0,0,0.7); }
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
    <p class="tagline">${escapeHtml(slide.body ?? "L'actu haïtienne, chaque jour.")}</p>
    <div class="handle">@edlightnews</div>
  </div>
  <span></span>
</div>
</body></html>`;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function baseReset(bg: string, bodyBg?: string): string {
  const b = bodyBg ?? bg;
  return `* { margin:0;padding:0;box-sizing:border-box; }
body { width:1080px;height:1350px;font-family:${fonts.body};background:${b};color:#fff;overflow:hidden;position:relative; }`;
}

