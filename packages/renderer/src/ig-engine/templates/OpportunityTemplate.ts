/**
 * @edlight-news/renderer – Opportunity Carousel template
 *
 * Multi-slide layout for scholarships, internships, grants, and fellowships.
 * Canvas: 1080×1350 (4:5 portrait)
 *
 * Key design rule (IG_COPILOT.md §7):
 *   Deadline and eligibility must be highly scannable.
 *
 * Default slide sequence:
 *   1. Cover — org + program name
 *   2. Eligibility summary
 *   3. What's covered / benefits
 *   4. How to apply
 *   5. Deadline (prominent)
 *   6. CTA
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
} from "../config/brand.js";

const { fonts } = BRAND;

/**
 * Build HTML for a single Opportunity Carousel slide.
 */
export function buildOpportunitySlide(
  slide: SlideContent,
  contentType: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const accent = getBrandAccent(contentType);
  const bg = getBrandBackground(contentType);
  const label = slide.label ?? getBrandLabel(contentType);
  const variant = slide.layoutVariant;

  if (variant === "cta") return buildOppCtaSlide(slide, accent, bg, totalSlides);
  if (variant === "data" || slide.deadline) return buildDeadlineSlide(slide, accent, bg, label, slideIndex, totalSlides);
  if (slideIndex === 0) return buildOppCoverSlide(slide, accent, bg, label, totalSlides);
  return buildOppDetailSlide(slide, accent, bg, label, slideIndex, totalSlides);
}

// ── Cover ─────────────────────────────────────────────────────────────────────

function buildOppCoverSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  totalSlides: number,
): string {
  const hasImage = Boolean(slide.imageUrl);
  const bodyBg = hasImage ? `${bg} url('${slide.imageUrl}') center/cover no-repeat` : bg;
  const overlay = hasImage
    ? `linear-gradient(to bottom, ${bg}dd 0%, ${bg}44 35%, ${bg}aa 70%, ${bg}f8 100%)`
    : `radial-gradient(ellipse at 15% 85%, ${accent}18 0%, transparent 55%)`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg, bodyBg)}
.overlay { position:absolute;inset:0;background:${overlay};pointer-events:none; }
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:24px;padding-bottom:36px; }
.headline { font-family:${fonts.headline};font-size:${oppCoverSize(slide.headline)}px;font-weight:900;line-height:1.08;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical; }
.swipe { font-family:${fonts.headline};font-size:18px;font-weight:600;opacity:0.35;letter-spacing:2px;text-transform:uppercase;margin-top:8px; }
.accent-line { position:absolute;left:0;top:0;bottom:0;width:5px;background:${accent}; }
</style></head><body>
<div class="overlay"></div>
<div class="accent-line"></div>
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">1 / ${totalSlides}</span>
  </div>
  <div class="mid">
    <p class="headline">${escapeHtml(slide.headline)}</p>
    ${slide.supportLine ? `<p style="font-family:${fonts.body};font-size:28px;opacity:0.7;line-height:1.4">${escapeHtml(slide.supportLine)}</p>` : ""}
    <p class="swipe">Glissez pour les détails →</p>
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── Detail (eligibility / benefits / how-to) ─────────────────────────────────

function buildOppDetailSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const bullets = parseBullets(slide.body ?? "");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:28px; }
.headline { font-family:${fonts.headline};font-size:50px;font-weight:800;line-height:1.1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical; }
.divider { width:60px;height:3px;background:${accent};border-radius:2px; }
.bullets { display:flex;flex-direction:column;gap:18px; }
.accent-line { position:absolute;left:0;top:0;bottom:0;width:5px;background:${accent}; }
</style></head><body>
<div class="accent-line"></div>
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">${slideIndex + 1} / ${totalSlides}</span>
  </div>
  <div class="mid">
    <p class="headline">${escapeHtml(slide.headline)}</p>
    <div class="divider"></div>
    <div class="bullets">
      ${bullets.length
        ? bullets.map(b => `
        <div style="display:flex;gap:18px;align-items:flex-start">
          <div style="width:10px;height:10px;border-radius:50%;background:${accent};flex-shrink:0;margin-top:11px"></div>
          <span style="font-family:${fonts.body};font-size:30px;line-height:1.55;flex:1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical">${escapeHtml(b)}</span>
        </div>`).join("")
        : slide.body ? `<p style="font-family:${fonts.body};font-size:30px;line-height:1.55;overflow:hidden;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical">${escapeHtml(slide.body)}</p>` : ""}
    </div>
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── Deadline slide ────────────────────────────────────────────────────────────

function buildDeadlineSlide(
  slide: SlideContent,
  accent: string,
  bg: string,
  label: string,
  slideIndex: number,
  totalSlides: number,
): string {
  const deadline = slide.deadline ?? slide.headline;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
${base(bg)}
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:92px 90px 100px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px; }
.counter { font-family:${fonts.headline};font-size:17px;font-weight:600;opacity:0.3;letter-spacing:1px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:24px; }
.label { font-family:${fonts.headline};font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:4px;opacity:0.5; }
.deadline-val { font-family:${fonts.headline};font-size:72px;font-weight:900;line-height:1.05;color:${accent};overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical; }
.note { font-family:${fonts.body};font-size:28px;opacity:0.65;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical; }
.rule { width:80px;height:4px;background:${accent};border-radius:2px; }
.accent-line { position:absolute;left:0;top:0;bottom:0;width:5px;background:${accent}; }
</style></head><body>
<div class="accent-line"></div>
<div class="canvas">
  <div class="top">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="counter">${slideIndex + 1} / ${totalSlides}</span>
  </div>
  <div class="mid">
    <p class="label">Date limite</p>
    <p class="deadline-val">${escapeHtml(deadline)}</p>
    <div class="rule"></div>
    ${slide.body ? `<p class="note">${escapeHtml(slide.body)}</p>` : ""}
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}

// ── CTA ───────────────────────────────────────────────────────────────────────

function buildOppCtaSlide(
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
.cta { font-family:${fonts.body};font-size:34px;font-weight:500;line-height:1.45;opacity:0.75;max-width:800px; }
.handle { font-family:${fonts.headline};font-size:38px;font-weight:800;color:${accent}; }
.badge { position:absolute;top:92px;right:90px;font-family:${fonts.headline};font-size:17px;opacity:0.25;letter-spacing:1px; }
</style></head><body>
<div class="canvas">
  <div class="wordmark"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
  <div class="rule"></div>
  <p class="cta">${escapeHtml(slide.body ?? "Toutes les bourses et opportunités pour étudiants haïtiens.")}</p>
  <p class="handle">@edlight.news</p>
</div>
<span class="badge">${totalSlides} / ${totalSlides}</span>
</body></html>`;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function base(bg: string, bodyBg?: string): string {
  const b = bodyBg ?? bg;
  return `* { margin:0;padding:0;box-sizing:border-box; }
body { width:1080px;height:1350px;font-family:${fonts.body};background:${b};color:#fff;overflow:hidden;position:relative; }`;
}

function parseBullets(body: string): string[] {
  // Only split into bullets when the body contains explicit separators.
  // Plain paragraphs must fall through to the <p> path to avoid 3-line clamp.
  if (!/\n|•/.test(body)) return [];
  return body.split(/\n|•/).map(s => s.trim()).filter(Boolean);
}

function oppCoverSize(headline: string): number {
  const words = headline.trim().split(/\s+/).length;
  if (words <= 6) return 80;
  if (words <= 9) return 70;
  return 58;
}
