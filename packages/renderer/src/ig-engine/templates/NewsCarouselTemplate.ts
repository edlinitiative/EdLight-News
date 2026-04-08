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

  const hlSize = coverHeadlineSize(slide.headline);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${baseReset(bg, bodyBg)}
.overlay { position:absolute;inset:0;background:${overlay};pointer-events:none; }
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:20px;padding-bottom:80px; }
.headline { font-family:${fonts.headline};font-size:${hlSize}px;font-weight:900;line-height:1.08;letter-spacing:-0.5px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical; }
.swipe { font-family:${fonts.headline};font-size:18px;font-weight:600;opacity:0.35;letter-spacing:2px;text-transform:uppercase;margin-top:12px; }
</style></head><body>
<div class="overlay"></div>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">1 / ${totalSlides}</span>
  </div>
  <div class="mid">
    <p class="headline">${escapeHtml(slide.headline)}</p>
    <p class="swipe">Glissez pour en savoir plus →</p>
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
.headline { font-family:${fonts.headline};font-size:52px;font-weight:800;line-height:1.1;letter-spacing:-0.3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical; }
.body { display:flex;flex-direction:column;gap:16px; }
.bullet { display:flex;gap:16px;align-items:flex-start;font-family:${fonts.body};font-size:32px;font-weight:400;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical; }
.bullet-dot { width:8px;height:8px;border-radius:50%;background:${accent};flex-shrink:0;margin-top:12px; }
.divider { width:60px;height:3px;background:${accent};border-radius:2px; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">${slideIndex + 1} / ${totalSlides}</span>
  </div>
  <div class="mid">
    <p class="headline">${escapeHtml(slide.headline)}</p>
    <div class="divider"></div>
    <div class="body">
      ${bullets.length
        ? bullets.map(b => `<div style="display:flex;gap:16px;align-items:flex-start"><div class="bullet-dot"></div><span style="font-family:${fonts.body};font-size:32px;font-weight:400;line-height:1.5;flex:1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical">${escapeHtml(b)}</span></div>`).join("")
        : slide.body ? `<p style="font-family:${fonts.body};font-size:32px;line-height:1.55;overflow:hidden;display:-webkit-box;-webkit-line-clamp:8;-webkit-box-orient:vertical">${escapeHtml(slide.body)}</p>` : ""}
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
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${baseReset(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:24px; }
.stat { font-family:${fonts.headline};font-size:140px;font-weight:900;line-height:1;letter-spacing:-4px;color:${accent};overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical; }
.desc { font-family:${fonts.body};font-size:36px;font-weight:500;line-height:1.4;opacity:0.85;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical; }
.rule { width:80px;height:4px;background:${accent};border-radius:2px; }
</style></head><body>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">${slideIndex + 1} / ${totalSlides}</span>
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
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${baseReset(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:90px;gap:40px;text-align:center; }
.wordmark { font-family:${fonts.headline};font-size:32px;font-weight:800;letter-spacing:4px;display:flex;gap:10px; }
.wordmark .el { color:#fff;opacity:0.9; }
.wordmark .nw { color:${accent}; }
.cta-line { font-family:${fonts.body};font-size:36px;font-weight:500;line-height:1.4;opacity:0.75;max-width:800px; }
.handle { font-family:${fonts.headline};font-size:40px;font-weight:800;color:${accent};letter-spacing:1px; }
.rule { width:80px;height:3px;background:${accent};border-radius:2px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.25;letter-spacing:1px;position:absolute;top:92px;right:90px; }
</style></head><body>
<div class="canvas">
  <div class="wordmark"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
  <div class="rule"></div>
  <p class="cta-line">${escapeHtml(slide.body ?? "Suivez-nous pour toutes les bourses et opportunités éducatives.")}</p>
  <p class="handle">@edlight.news</p>
</div>
<span class="counter">${totalSlides} / ${totalSlides}</span>
</body></html>`;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function baseReset(bg: string, bodyBg?: string): string {
  const b = bodyBg ?? bg;
  return `* { margin:0;padding:0;box-sizing:border-box; }
body { width:1080px;height:1350px;font-family:${fonts.body};background:${b};color:#fff;overflow:hidden;position:relative; }`;
}

function coverHeadlineSize(headline: string): number {
  const words = headline.trim().split(/\s+/).length;
  if (words <= 7) return 76;
  if (words <= 10) return 66;
  return 56;
}
