/**
 * @edlight-news/renderer – Text Measurement Engine
 *
 * Determines whether text will actually fit inside a fixed layout box
 * before the slide is handed to the renderer.
 *
 * Approach (IG_COPILOT.md §5.5):
 *   Word count alone is not enough. Different words, languages, and fonts
 *   render differently. This module estimates pixel-level fit using
 *   per-character average widths derived from font metrics.
 *
 * Implementation strategy:
 *   We use an approximation model based on known average character widths
 *   for DM Sans and Inter at reference font sizes, scaled proportionally.
 *   For 100 % accuracy, renderSlides.ts uses a headless browser — but
 *   this engine runs without a browser so it catches obvious violations fast.
 *
 * Non-negotiable rules (IG_COPILOT.md §8):
 *   - If text does not fit, this function returns fits:false.
 *   - Never return fits:true for clearly overflowing text.
 *   - The renderer must never export a slide that failed measurement.
 */

import type { MeasureTextInput, MeasureTextResult, FitResult, SlideContent, TemplateConfig } from "../types/post.js";

// ── Character width tables (em-relative) ──────────────────────────────────────
//
// Empirically derived average advance widths at 1 em for common Latin/French
// character sets.  Used as: estimatedWidth = charWidth * fontSize.
//
// These are calibrated for:
//   DM Sans 900 (headlines) — slightly narrower than a typical sans at weight 900
//   Inter 400/500/700 (body) — standard proportional sans

/** Average char width coefficient for DM Sans (weight 800–900) */
const DM_SANS_AVG = 0.57;

/** Average char width coefficient for Inter (weight 400–600) */
const INTER_AVG = 0.53;

/** Space width coefficient (slightly narrower than average char) */
const SPACE_W = 0.26;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Estimate whether `text` fits inside a layout box.
 *
 * Returns the number of lines used, the max allowed, and whether it fits.
 */
export function measureText(input: MeasureTextInput): MeasureTextResult {
  const {
    text,
    fontSize,
    fontFamily,
    boxWidth,
    boxHeight,
    lineHeight,
    lineClamp,
  } = input;

  const avgCoeff = fontFamily.toLowerCase().includes("dm")
    ? DM_SANS_AVG
    : INTER_AVG;

  const avgCharWidth = fontSize * avgCoeff;
  const spaceWidth = fontSize * SPACE_W;
  const lineHeightPx = fontSize * lineHeight;
  const maxLinesByHeight = Math.floor(boxHeight / lineHeightPx);
  const maxLines = lineClamp ?? maxLinesByHeight;

  // Estimate number of lines required (word-wrap simulation)
  const linesUsed = estimateLines(text, fontSize, avgCharWidth, spaceWidth, boxWidth);
  const overflowLines = Math.max(0, linesUsed - maxLines);
  const overflowPx = overflowLines * lineHeightPx;

  return {
    fits: linesUsed <= maxLines,
    linesUsed,
    maxLines,
    overflowPx,
  };
}

/**
 * Run measurement across all text fields in a slide and return FitResult[].
 */
export function measureSlide(slide: SlideContent, config: TemplateConfig): FitResult[] {
  const results: FitResult[] = [];

  const fields: Array<{ name: string; text: string | undefined; zone: keyof typeof config.zones }> = [
    { name: "headline", text: slide.headline, zone: "headline" },
    { name: "body", text: slide.body, zone: "body" },
    { name: "supportLine", text: slide.supportLine, zone: "supportLine" },
    { name: "sourceLine", text: slide.sourceLine, zone: "sourceLine" },
    { name: "deadline", text: slide.deadline, zone: "deadline" },
    { name: "statValue", text: slide.statValue, zone: "statValue" },
    { name: "statDescription", text: slide.statDescription, zone: "statDescription" },
  ];

  for (const { name, text, zone } of fields) {
    if (!text) continue;
    const zoneConfig = config.zones[zone];
    if (!zoneConfig) continue;

    const result = measureText({
      text,
      fontSize: zoneConfig.fontSize,
      fontFamily: zoneConfig.fontFamily,
      boxWidth: zoneConfig.box.width,
      boxHeight: zoneConfig.box.height,
      lineHeight: zoneConfig.lineHeight,
      lineClamp: zoneConfig.limits.maxLines,
    });

    results.push({
      field: name,
      fits: result.fits,
      linesUsed: result.linesUsed,
      maxLines: result.maxLines,
      overflowPx: result.overflowPx,
      recommendedAdjustment: result.fits
        ? undefined
        : buildAdjustmentHint(name, text, zoneConfig.limits.maxLines ?? result.maxLines, result.linesUsed),
    });
  }

  return results;
}

// ── Word-wrap line estimator ──────────────────────────────────────────────────

function estimateLines(
  text: string,
  _fontSize: number,
  avgCharWidth: number,
  spaceWidth: number,
  boxWidth: number,
): number {
  // Handle newlines in body text
  const paragraphs = text.split(/\n/);
  let totalLines = 0;

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      totalLines += 1; // blank line
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let lineWidth = 0;
    let lines = 1;

    for (const word of words) {
      const wordWidth = estimateWordWidth(word, avgCharWidth);
      if (lineWidth === 0) {
        lineWidth = wordWidth;
      } else if (lineWidth + spaceWidth + wordWidth <= boxWidth) {
        lineWidth += spaceWidth + wordWidth;
      } else {
        lines++;
        lineWidth = wordWidth;
      }
    }

    totalLines += lines;
  }

  return totalLines;
}

/** Estimate the pixel width of a single word using average char widths. */
function estimateWordWidth(word: string, avgCharWidth: number): number {
  // Narrow characters (i, l, 1, :, ;, !, .) get 60% of average
  const narrowRe = /[il1:;!.,'|]/g;
  const narrowCount = (word.match(narrowRe) ?? []).length;
  // Wide characters (m, w, M, W) get 150% of average
  const wideRe = /[mwMW]/g;
  const wideCount = (word.match(wideRe) ?? []).length;
  const normalCount = word.length - narrowCount - wideCount;

  return normalCount * avgCharWidth + narrowCount * avgCharWidth * 0.6 + wideCount * avgCharWidth * 1.5;
}

function buildAdjustmentHint(field: string, text: string, maxLines: number, linesUsed: number): string {
  const excess = linesUsed - maxLines;
  const words = text.trim().split(/\s+/).length;
  const wordsToRemove = Math.ceil(words * (excess / linesUsed));
  return `"${field}" overflows by ~${excess} line(s). Remove ~${wordsToRemove} words.`;
}
