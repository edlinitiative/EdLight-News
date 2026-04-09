/**
 * @edlight-news/renderer – Breaking News Single template
 *
 * Single-slide layout for urgent news flash posts.
 * Canvas: 1080×1350 (4:5 portrait)
 *
 * Layout zones:
 *   - Category pill (top-left)
 *   - Hero headline (centre, large)
 *   - Support line (below headline, optional)
 *   - Source / footer bar (bottom)
 *
 * Design principle: text must never occupy more than ~75 % of the frame;
 * the remaining space carries visual weight through background imagery or
 * the brand gradient.
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
 * Build HTML for a Breaking News Single slide.
 *
 * @param slide       Validated slide content
 * @param contentType Content type key (e.g. "breaking", "news")
 */
export function buildBreakingNewsSlide(
  slide: SlideContent,
  contentType: string,
): string {
  const accent = getBrandAccent(contentType);
  const bg = getBrandBackground(contentType);
  const label = slide.label ?? getBrandLabel(contentType);
  const hasImage = Boolean(slide.imageUrl);

  const bodyBg = hasImage
    ? `${bg} url('${slide.imageUrl}') center/cover no-repeat`
    : bg;

  const overlayGradient = hasImage
    ? `linear-gradient(to bottom, ${bg}cc 0%, ${bg}44 30%, ${bg}88 70%, ${bg}ee 100%)`
    : `radial-gradient(ellipse at 50% 110%, ${bg}cc 0%, transparent 65%)`;

  const cfg = getTemplateConfig("breaking-news-single");
  const hlZone = resolveZone(cfg, "headline", "cover")!;
  const suppZone = resolveZone(cfg, "supportLine", "cover")!;
  const headlineSize = resolveEffectiveFontSize(hlZone, slide.headline);

  return `<!DOCTYPE html><html><head><meta charset="utf-8">${GOOGLE_FONTS_LINK}
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:1080px; height:1350px;
  font-family:${fonts.body};
  background:${bodyBg};
  color:#fff;
  overflow:hidden;
  position:relative;
}
.overlay {
  position:absolute; inset:0;
  background:${overlayGradient};
  pointer-events:none;
}
.canvas {
  position:absolute; inset:0;
  display:flex; flex-direction:column;
  padding:92px 90px 100px;
  justify-content:space-between;
}
.top-row { display:flex; justify-content:space-between; align-items:flex-start; }
.pill {
  display:inline-flex; align-items:center;
  background:${accent}; color:#000;
  font-family:${fonts.headline}; font-size:20px; font-weight:800;
  text-transform:uppercase; letter-spacing:3px;
  padding:10px 24px; border-radius:4px;
}
.slide-count {
  font-family:${fonts.headline}; font-size:17px; font-weight:600;
  opacity:0.35; letter-spacing:1px;
}
.mid {
  flex:1;
  display:flex; flex-direction:column; justify-content:center;
  gap:32px;
  padding-top:32px; padding-bottom:32px;
}
.headline {
  font-family:${fonts.headline};
  font-size:${headlineSize}px;
  font-weight:900;
  line-height:${hlZone.lineHeight};
  letter-spacing:-1px;
  color:#fff;
  overflow:hidden;
  display:-webkit-box;
  -webkit-line-clamp:${hlZone.limits.maxLines ?? 6};
  -webkit-box-orient:vertical;
}
.support {
  font-family:${fonts.body};
  font-size:${suppZone.fontSize}px;
  font-weight:500;
  line-height:${suppZone.lineHeight};
  opacity:0.75;
  overflow:hidden;
  display:-webkit-box;
  -webkit-line-clamp:${suppZone.limits.maxLines ?? 2};
  -webkit-box-orient:vertical;
}
</style>
</head><body>
<div class="overlay"></div>
${premiumAtmosphereHtml(accent)}
<div class="canvas">
  <div class="top-row">
    <span class="pill">${escapeHtml(label)}</span>
    <span class="slide-count">EDLIGHT NEWS</span>
  </div>
  <div class="mid">
    <p class="headline">${escapeHtml(slide.headline)}</p>
    ${slide.supportLine ? `<p class="support">${escapeHtml(slide.supportLine)}</p>` : ""}
  </div>
  ${footerBarHtml(slide.sourceLine, accent, fonts.body)}
</div>
</body></html>`;
}


