/**
 * @edlight-news/renderer – QA Preview Layer: Contact Sheet Generator
 *
 * Generates a 1920×1080 QA preview sheet showing all slides in a carousel
 * as thumbnails with fit-status badges.  Makes it easy for editors to review
 * a full carousel at a glance before publishing.
 *
 * (IG_COPILOT.md §5.9):
 *   - Generate preview contact sheet of all slides
 *   - Show fit-check status per slide
 *   - Show whether any text is near limits
 *   - Show which fields were rewritten automatically
 */

import type { IGEnginePost } from "../types/post.js";
import type { RenderedSlide } from "../engine/renderSlides.js";
import { getBrowserInstance } from "../../index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Preview sheet canvas dimensions (landscape). */
const SHEET_W = 1920;
const SHEET_H = 1080;

/** Slide thumbnail height. Width is computed from the 1080:1350 aspect ratio. */
const THUMB_H = 360;
const THUMB_W = Math.round(THUMB_H * (1080 / 1350)); // ≈ 288 px

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render a QA contact sheet as a PNG buffer.
 *
 * The sheet shows all slide thumbnails in a horizontal row with colour-coded
 * status badges:
 *   ✓ green  — passed all fit checks
 *   ⚠ amber  — passed but near overflow limit
 *   ✗ red    — failed one or more fit checks
 *   ✏ purple — field(s) were auto-rewritten
 *
 * @param post   The validated post (for metadata and fit status).
 * @param slides The already-rendered slide PNGs (from renderPost()).
 */
export async function generatePreviewSheet(
  post: IGEnginePost,
  slides: RenderedSlide[],
): Promise<Buffer> {
  const slideData: SlidePreviewData[] = slides.map((s, i) => {
    const meta = post.slides[i]?.validation;
    return {
      slideNumber: s.slideNumber,
      /** Embed as data-URI so the headless page can load without a file server. */
      dataUrl: `data:image/png;base64,${s.png.toString("base64")}`,
      fitPassed: meta?.fitPassed ?? true,
      overflowRisk: meta?.overflowRisk ?? false,
      rewriteCount: meta?.rewriteCount ?? 0,
    };
  });

  const html = buildSheetHtml(post, slideData);

  const browser = await getBrowserInstance();
  const context = await browser.newContext({
    viewport: { width: SHEET_W, height: SHEET_H },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();
  try {
    // Use "load" instead of "networkidle" — all images are data URIs so there
    // are no network requests to wait for.
    await page.setContent(html, { waitUntil: "load" });

    const png = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: SHEET_W, height: SHEET_H },
    });

    return Buffer.from(png);
  } finally {
    await page.close();
    await context.close();
  }
}

// ── Internal types ────────────────────────────────────────────────────────────

interface SlidePreviewData {
  slideNumber: number;
  dataUrl: string;
  fitPassed: boolean;
  overflowRisk: boolean;
  rewriteCount: number;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildSheetHtml(post: IGEnginePost, slides: SlidePreviewData[]): string {
  const allPassed = slides.every(s => s.fitPassed);
  const statusColor = allPassed ? "#34d399" : "#f43f5e";
  const statusText = allPassed ? "✓  ALL CLEAR" : "✗  OVERFLOW DETECTED";

  const thumbsHtml = slides
    .map(s => {
      const borderColor = !s.fitPassed
        ? "#f43f5e"
        : s.overflowRisk
          ? "#fbbf24"
          : "transparent";

      const badges: string[] = [];
      badges.push(`<span class="badge-num">${s.slideNumber}</span>`);
      if (s.fitPassed && !s.overflowRisk) {
        badges.push(`<span class="badge-ok">✓</span>`);
      }
      if (!s.fitPassed) {
        badges.push(`<span class="badge-err">✗ OVERFLOW</span>`);
      }
      if (s.overflowRisk && s.fitPassed) {
        badges.push(`<span class="badge-warn">⚠ RISK</span>`);
      }
      if (s.rewriteCount > 0) {
        badges.push(`<span class="badge-rw">✏ ×${s.rewriteCount}</span>`);
      }

      return `
        <div class="thumb-col">
          <img
            class="thumb"
            src="${s.dataUrl}"
            width="${THUMB_W}"
            height="${THUMB_H}"
            style="outline:3px solid ${borderColor};outline-offset:-3px"
          />
          <div class="badges">${badges.join("")}</div>
        </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body {
  width:${SHEET_W}px; height:${SHEET_H}px;
  background:#070c18; color:#f8fafc;
  font-family:system-ui, -apple-system, sans-serif;
  overflow:hidden; display:flex; flex-direction:column;
}
/* ── Header ── */
.header {
  display:flex; justify-content:space-between; align-items:center;
  padding:18px 32px 14px; border-bottom:1px solid rgba(255,255,255,0.07);
  flex-shrink:0;
}
.header-left .title { font-size:20px; font-weight:700; letter-spacing:0.5px; }
.header-left .meta  { font-size:13px; color:rgba(255,255,255,0.4); margin-top:4px; }
.status { font-size:17px; font-weight:800; letter-spacing:2px; color:${statusColor}; }
/* ── Thumbnails ── */
.thumbs {
  flex:1; display:flex; align-items:center;
  gap:18px; padding:22px 32px; overflow-x:auto;
}
.thumb-col { display:flex; flex-direction:column; gap:10px; flex-shrink:0; }
.thumb { border-radius:6px; display:block; }
/* ── Badges ── */
.badges { display:flex; flex-wrap:wrap; gap:5px; }
.badge-num  { background:#1e293b; color:#94a3b8; font-size:12px; font-weight:600; padding:2px 8px; border-radius:4px; }
.badge-ok   { color:#34d399; font-size:13px; font-weight:700; }
.badge-err  { color:#f43f5e; font-size:12px; font-weight:700; }
.badge-warn { color:#fbbf24; font-size:12px; font-weight:700; }
.badge-rw   { color:#a78bfa; font-size:12px; font-weight:600; }
/* ── Footer ── */
.footer {
  padding:12px 32px; border-top:1px solid rgba(255,255,255,0.07);
  display:flex; justify-content:space-between;
  font-size:12px; color:rgba(255,255,255,0.3);
  flex-shrink:0;
}
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <p class="title">EdLight News — QA Preview Sheet</p>
      <p class="meta">${post.templateId} · ${post.language.toUpperCase()} · ${post.slides.length} slides · ${post.topic}</p>
    </div>
    <p class="status">${statusText}</p>
  </div>

  <div class="thumbs">
    ${thumbsHtml}
  </div>

  <div class="footer">
    <span>Post ID: ${post.id}</span>
    <span>Generated: ${new Date().toISOString()}</span>
    <span>EDLIGHT NEWS · QA</span>
  </div>
</body>
</html>`;
}
