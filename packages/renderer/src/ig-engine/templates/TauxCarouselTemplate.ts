/**
 * @edlight-news/renderer – Taux du Jour Carousel template
 *
 * Premium navy/gold financial card for the daily BRH exchange rate post.
 * Canvas: 1080×1350 (4:5 portrait carousel)
 *
 * Inspired by the ig-story.ts taux frame — same visual language (navy
 * background, gold accent, big rate number) but adapted for carousel.
 *
 * Slide types:
 *   - cover:  "TAUX DU JOUR" pill + large rate number + unit + date
 *   - detail: Market breakdown table (bancaire / informel / weekly variation)
 */

import type { SlideContent } from "../types/post.js";
import { getTemplateConfig } from "../config/templateLimits.js";
import { resolveZone } from "../types/post.js";
import { GOOGLE_FONTS_LINK, escapeHtml } from "../config/brand.js";
import { BRAND } from "../config/brand.js";

const { fonts } = BRAND;

// ── Brand colours for taux ────────────────────────────────────────────────────
const NAVY   = "#0a1628";
const GOLD   = "#eab308";
const NAVY2  = "#0d2137";

/**
 * Build HTML for a single Taux du Jour slide.
 *
 * @param slide      Validated slide content
 * @param slideIndex 0-based position in the carousel
 * @param totalSlides Total slides (for future use; not shown to viewer)
 */
export function buildTauxCarouselSlide(
  slide: SlideContent,
  _contentType: string,
  slideIndex: number,
  _totalSlides: number,
): string {
  if (slideIndex === 0) return buildTauxCoverSlide(slide);
  return buildTauxDetailSlide(slide);
}

// ── Cover slide ───────────────────────────────────────────────────────────────

function buildTauxCoverSlide(slide: SlideContent): string {
  const rate     = slide.headline;   // e.g. "133.1500"
  const dateNote = slide.supportLine ?? "";   // first bullet → date
  const footer   = slide.sourceLine ?? "Source: BRH (brh.ht)";
  const hasBg    = Boolean(slide.imageUrl);
  const bgCss    = hasBg
    ? `background:${NAVY} url('${escapeHtml(slide.imageUrl!)}') center/cover no-repeat;`
    : `background:linear-gradient(180deg,${NAVY} 0%,${NAVY2} 55%,${NAVY} 100%);`;

  const cfg      = getTemplateConfig("taux-card");
  const rateZone = resolveZone(cfg, "headline", "cover")!;
  const dateZone = resolveZone(cfg, "supportLine", "cover")!;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
* { margin:0;padding:0;box-sizing:border-box; }
body { width:1080px;height:1350px;font-family:${fonts.body};${bgCss}color:#fff;overflow:hidden;position:relative; }
.img-overlay { position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,10,24,0.55) 0%,rgba(5,10,24,0.38) 28%,rgba(5,10,24,0.72) 70%,rgba(5,10,24,0.90) 100%); }
.glow { position:absolute;top:35%;left:50%;transform:translate(-50%,-50%);width:800px;height:800px;background:radial-gradient(circle,rgba(234,179,8,0.12) 0%,transparent 68%);pointer-events:none; }
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:90px 80px 80px;text-align:center; }
.top { width:100%;display:flex;justify-content:center; }
.pill { display:inline-flex;align-items:center;background:${GOLD};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:12px 30px;border-radius:999px; }
.mid { display:flex;flex-direction:column;align-items:center;gap:18px; }
.rate-label { font-family:${fonts.headline};font-size:18px;font-weight:600;opacity:0.42;letter-spacing:4px;text-transform:uppercase; }
.rate { font-family:${fonts.headline};font-size:${rateZone.fontSize}px;font-weight:900;letter-spacing:-4px;color:${GOLD};line-height:${rateZone.lineHeight}; }
.unit { font-family:${fonts.headline};font-size:26px;font-weight:500;opacity:0.38;letter-spacing:2px; }
.divider { width:70px;height:3px;background:${GOLD};border-radius:2px;opacity:0.55; }
.date-note { font-family:${fonts.body};font-size:${dateZone.fontSize}px;font-weight:500;opacity:0.52;letter-spacing:1px; }
.bottom { width:100%;display:flex;flex-direction:column;align-items:center;gap:12px; }
.wordmark { font-family:${fonts.headline};font-size:22px;font-weight:800;letter-spacing:4px;display:flex;gap:8px; }
.wordmark .el { color:rgba(255,255,255,0.62); }
.wordmark .nw { color:${GOLD}; }
.source-note { font-family:${fonts.body};font-size:18px;opacity:0.32; }
</style></head><body>
${hasBg ? '<div class="img-overlay"></div>' : ""}
<div class="glow"></div>
<div class="canvas">
  <div class="top">
    <span class="pill">TAUX DU JOUR</span>
  </div>
  <div class="mid">
    <p class="rate-label">TAUX DE RÉFÉRENCE BRH</p>
    <p class="rate">${escapeHtml(rate)}</p>
    <p class="unit">HTG / 1 USD</p>
    <div class="divider"></div>
    ${dateNote ? `<p class="date-note">${escapeHtml(dateNote)}</p>` : ""}
  </div>
  <div class="bottom">
    <div class="wordmark"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
    <p class="source-note">${escapeHtml(footer)}</p>
  </div>
</div>
</body></html>`;
}

// ── Detail / breakdown slide ──────────────────────────────────────────────────

function buildTauxDetailSlide(slide: SlideContent): string {
  const title    = slide.headline;
  const hasBg    = Boolean(slide.imageUrl);
  const bgCss    = hasBg
    ? `background:${NAVY} url('${escapeHtml(slide.imageUrl!)}') center/cover no-repeat;`
    : `background:linear-gradient(180deg,${NAVY} 0%,${NAVY2} 55%,${NAVY} 100%);`;

  // Parse body bullets (joined as "• a\n• b\n• c") back into array
  const lines = (slide.body ?? "")
    .split(/\n/)
    .map(l => l.replace(/^[•\-]\s*/, "").trim())
    .filter(Boolean);

  const rowsHtml = lines
    .map(line => `<div class="row">${escapeHtml(line)}</div>`)
    .join("\n");

  const cfg       = getTemplateConfig("taux-card");
  const titleZone = resolveZone(cfg, "headline", "detail")!;
  const rowZone   = resolveZone(cfg, "body", "detail")!;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
* { margin:0;padding:0;box-sizing:border-box; }
body { width:1080px;height:1350px;font-family:${fonts.body};${bgCss}color:#fff;overflow:hidden;position:relative; }
.img-overlay { position:absolute;inset:0;background:linear-gradient(180deg,rgba(5,10,24,0.55) 0%,rgba(5,10,24,0.72) 100%); }
.glow { position:absolute;top:20%;left:50%;transform:translate(-50%,-50%);width:700px;height:700px;background:radial-gradient(circle,rgba(234,179,8,0.09) 0%,transparent 68%);pointer-events:none; }
.canvas { position:absolute;inset:0;display:flex;flex-direction:column;padding:80px 90px 80px;justify-content:space-between; }
.top { display:flex;justify-content:space-between;align-items:flex-start; }
.pill { display:inline-flex;align-items:center;background:${GOLD};color:#000;font-family:${fonts.headline};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:12px 28px;border-radius:999px; }
.mid { flex:1;display:flex;flex-direction:column;justify-content:center;gap:32px; }
.title { font-family:${fonts.headline};font-size:${titleZone.fontSize}px;font-weight:800;line-height:${titleZone.lineHeight};letter-spacing:-0.5px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${titleZone.limits.maxLines ?? 2};-webkit-box-orient:vertical; }
.rule { width:70px;height:3px;background:${GOLD};border-radius:2px; }
.rows { display:flex;flex-direction:column;gap:24px; }
.row { font-family:${fonts.body};font-size:${rowZone.fontSize}px;font-weight:400;line-height:${rowZone.lineHeight};opacity:0.82;border-left:4px solid ${GOLD};padding-left:22px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:${rowZone.limits.perBulletMaxLines ?? rowZone.limits.maxLines ?? 2};-webkit-box-orient:vertical; }
.bottom { display:flex;justify-content:space-between;align-items:flex-end; }
.wordmark { font-family:${fonts.headline};font-size:20px;font-weight:800;letter-spacing:4px;display:flex;gap:8px; }
.wordmark .el { color:rgba(255,255,255,0.55); }
.wordmark .nw { color:${GOLD}; }
.src { font-family:${fonts.body};font-size:18px;opacity:0.30; }
</style></head><body>
${hasBg ? '<div class="img-overlay"></div>' : ""}
<div class="glow"></div>
<div class="canvas">
  <div class="top">
    <span class="pill">TAUX DU JOUR</span>
  </div>
  <div class="mid">
    <p class="title">${escapeHtml(title)}</p>
    <div class="rule"></div>
    <div class="rows">${rowsHtml}</div>
  </div>
  <div class="bottom">
    <div class="wordmark"><span class="el">EDLIGHT</span><span class="nw">NEWS</span></div>
    ${slide.sourceLine ? `<p class="src">${escapeHtml(slide.sourceLine)}</p>` : ""}
  </div>
</div>
</body></html>`;
}
