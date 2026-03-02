/**
 * @edlight-news/renderer – IG Carousel asset generation
 *
 * Generates carousel slide images or dry-run JSON+HTML exports.
 * Reuses the existing branded card pipeline when Chromium is available.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IGSlide, IGFormattedPayload, IGQueueItem } from "@edlight-news/types";

// ── IG-specific gradient mapping ──────────────────────────────────────────
const IG_TYPE_GRADIENTS: Record<string, string> = {
  scholarship: "linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%)",
  opportunity: "linear-gradient(135deg, #6d28d9 0%, #db2777 100%)",
  news:        "linear-gradient(135deg, #0f766e 0%, #1e40af 100%)",
  histoire:    "linear-gradient(135deg, #92400e 0%, #b91c1c 100%)",
  utility:     "linear-gradient(135deg, #15803d 0%, #0369a1 100%)",
};

const IG_TYPE_LABELS: Record<string, string> = {
  scholarship: "BOURSE",
  opportunity: "OPPORTUNITÉ",
  news:        "ACTUALITÉ",
  histoire:    "HISTOIRE",
  utility:     "INFO PRATIQUE",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build HTML for a single IG carousel slide (1080×1080).
 */
export function buildSlideHTML(slide: IGSlide, igType: string, slideIndex: number, totalSlides: number): string {
  const gradient = IG_TYPE_GRADIENTS[igType] ?? "linear-gradient(135deg, #1e3a5f 0%, #2c1654 100%)";
  const label = IG_TYPE_LABELS[igType] ?? "";
  const bulletsHtml = slide.bullets
    .map((b) => `<li>${escapeHtml(b)}</li>`)
    .join("\n          ");

  // Background: if an image URL is provided, use it with a dark overlay;
  // otherwise fall back to the type-specific gradient.
  const hasImage = !!slide.backgroundImage;
  const bodyBackground = hasImage
    ? `background: ${gradient}; background-image: url('${slide.backgroundImage}'); background-size: cover; background-position: center;`
    : `background: ${gradient};`;
  const overlayStyle = hasImage
    ? `position: absolute; inset: 0; background: rgba(0,0,0,0.55); z-index: 0;`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1080px; height: 1080px;
    font-family: -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    ${bodyBackground}
    display: flex; flex-direction: column;
    justify-content: space-between;
    padding: 80px;
    color: white;
    overflow: hidden;
    position: relative;
  }
  ${hasImage ? `.overlay { ${overlayStyle} }` : ""}
  .content { position: relative; z-index: 1; display: flex; flex-direction: column; justify-content: space-between; flex: 1; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; }
  .category {
    display: inline-block;
    background: rgba(255,255,255,0.2);
    backdrop-filter: blur(8px);
    border-radius: 24px;
    padding: 10px 24px;
    font-size: 20px; font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
  .page { font-size: 20px; opacity: 0.7; }
  .heading {
    font-size: 48px; font-weight: 800;
    line-height: 1.15; letter-spacing: -0.5px;
    text-shadow: 0 2px 12px rgba(0,0,0,0.5);
    margin-bottom: 32px;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
  }
  .bullets { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .bullets ul { list-style: none; }
  .bullets li {
    font-size: 28px; line-height: 1.5;
    margin-bottom: 16px;
    opacity: 0.95;
    text-shadow: 0 1px 6px rgba(0,0,0,0.4);
  }
  .footer {
    font-size: 18px; opacity: 0.6;
    border-top: 1px solid rgba(255,255,255,0.2);
    padding-top: 16px;
    display: flex; justify-content: space-between; align-items: flex-end;
  }
  .brand { font-size: 28px; font-weight: 800; opacity: 0.9; }
  .brand span { color: #facc15; }
</style>
</head>
<body>
  ${hasImage ? `<div class="overlay"></div>` : ""}
  <div class="content">
  <div class="top">
    ${label ? `<span class="category">${escapeHtml(label)}</span>` : ""}
    <span class="page">${slideIndex + 1}/${totalSlides}</span>
  </div>
  <div>
    <div class="heading">${escapeHtml(slide.heading)}</div>
    <div class="bullets">
      <ul>
          ${bulletsHtml}
      </ul>
    </div>
  </div>
  <div class="footer">
    <span>${slide.footer ? escapeHtml(slide.footer) : ""}</span>
    <span class="brand">Ed<span>Light</span> News</span>
  </div>
  </div>
</body>
</html>`;
}

export interface CarouselAssetResult {
  mode: "rendered" | "dry-run";
  /** Paths to PNG files (rendered) or HTML files (dry-run) */
  slidePaths: string[];
  /** Path to the JSON payload file */
  payloadPath: string;
  /** Base directory for all assets */
  exportDir: string;
}

/**
 * Generate carousel assets for an IG queue item.
 *
 * If Chromium (via the existing renderer) is available, renders PNGs.
 * Otherwise, falls back to "dry-run" mode: saves HTML templates + JSON payload.
 */
export async function generateCarouselAssets(
  queueItem: IGQueueItem,
  payload: IGFormattedPayload,
): Promise<CarouselAssetResult> {
  const exportDir = `/tmp/ig_exports/${queueItem.id}`;
  mkdirSync(exportDir, { recursive: true });

  // Save JSON payload
  const payloadPath = join(exportDir, "payload.json");
  writeFileSync(payloadPath, JSON.stringify({ queueItem, payload }, null, 2), "utf-8");

  const slidePaths: string[] = [];
  let mode: "rendered" | "dry-run" = "dry-run";

  // Try to render PNGs using the existing branded card pipeline
  try {
    // Dynamic import to avoid hard dependency on playwright
    const { renderBrandedCardPNG } = await import("./index.js");

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      // Use existing branded card renderer for a styled 1080×1080 image
      const buffer = await renderBrandedCardPNG({
        title: slide.heading,
        category: queueItem.igType as any,
        sourceName: slide.footer,
        size: "square",
      });
      const pngPath = join(exportDir, `slide_${i + 1}.png`);
      writeFileSync(pngPath, buffer);
      slidePaths.push(pngPath);
    }
    mode = "rendered";
  } catch {
    // Chromium not available — fall back to dry-run HTML exports
    console.warn("[ig-renderer] Chromium unavailable, using dry-run HTML mode");

    for (let i = 0; i < payload.slides.length; i++) {
      const slide = payload.slides[i]!;
      const html = buildSlideHTML(slide, queueItem.igType, i, payload.slides.length);
      const htmlPath = join(exportDir, `slide_${i + 1}.html`);
      writeFileSync(htmlPath, html, "utf-8");
      slidePaths.push(htmlPath);
    }
  }

  return { mode, slidePaths, payloadPath, exportDir };
}
