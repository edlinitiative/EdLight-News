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
import { getFontCoefficients } from "../config/fonts.js";
import type { FontCoefficients } from "../config/fonts.js";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Estimate whether `text` fits inside a layout box.
 *
 * Returns the number of lines used, the max allowed, and whether it fits.
 */
export function measureText(input: MeasureTextInput, language?: string): MeasureTextResult {
  const {
    text,
    fontSize,
    fontFamily,
    boxWidth,
    boxHeight,
    lineHeight,
    lineClamp,
  } = input;

  const coeffs = getFontCoefficients(fontFamily);
  const langScale = getLanguageScale(language);
  const avgCharWidth = fontSize * coeffs.avg * langScale;
  const spaceWidth = fontSize * coeffs.space;
  const lineHeightPx = fontSize * lineHeight;
  const maxLinesByHeight = Math.floor(boxHeight / lineHeightPx);
  const maxLines = lineClamp ?? maxLinesByHeight;

  // Estimate number of lines required (word-wrap simulation)
  const linesUsed = estimateLines(text, coeffs, fontSize, langScale, boxWidth);
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
export function measureSlide(slide: SlideContent, config: TemplateConfig, language?: string): FitResult[] {
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
    }, language);

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

    // Per-bullet measurement: CSS templates clamp each bullet individually
    // (e.g. -webkit-line-clamp:3 per bullet, clamp:2 for cover facts).
    // Measure each bullet separately so the rewrite engine can fix them.
    if (name === "body" && zoneConfig.limits.perBulletMaxLines && text && /[•\n]/.test(text)) {
      // Cover facts render at smaller font with tighter clamp (2 lines at 28px)
      const bulletClamp = slide.layoutVariant === "cover"
        ? Math.min(zoneConfig.limits.perBulletMaxLines, 2)
        : zoneConfig.limits.perBulletMaxLines;
      const bulletTexts = text.split(/\n|•/).map(s => s.trim()).filter(Boolean);
      for (let bi = 0; bi < bulletTexts.length; bi++) {
        const bulletResult = measureText({
          text: bulletTexts[bi]!,
          fontSize: zoneConfig.fontSize,
          fontFamily: zoneConfig.fontFamily,
          boxWidth: zoneConfig.box.width,
          boxHeight: zoneConfig.box.height,
          lineHeight: zoneConfig.lineHeight,
          lineClamp: bulletClamp,
        }, language);
        results.push({
          field: `body.bullet[${bi}]`,
          fits: bulletResult.fits,
          linesUsed: bulletResult.linesUsed,
          maxLines: bulletResult.maxLines,
          overflowPx: bulletResult.overflowPx,
          recommendedAdjustment: bulletResult.fits
            ? undefined
            : buildAdjustmentHint(`body.bullet[${bi}]`, bulletTexts[bi]!, bulletClamp, bulletResult.linesUsed),
        });
      }
    }
  }

  return results;
}

// ── Word-wrap line estimator ──────────────────────────────────────────────────

function estimateLines(
  text: string,
  coeffs: FontCoefficients,
  fontSize: number,
  langScale: number,
  boxWidth: number,
): number {
  const spaceWidth = fontSize * coeffs.space;

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
      const wordWidth = estimateWordWidth(word, coeffs, fontSize) * langScale;
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

/** Estimate the pixel width of a single word using calibrated font coefficients. */
function estimateWordWidth(word: string, coeffs: FontCoefficients, fontSize: number): number {
  const narrowRe = /[il1:;!.,'|]/g;
  const narrowCount = (word.match(narrowRe) ?? []).length;
  const wideRe = /[mwMW]/g;
  const wideCount = (word.match(wideRe) ?? []).length;
  const normalCount = word.length - narrowCount - wideCount;

  return normalCount * fontSize * coeffs.avg
       + narrowCount * fontSize * coeffs.narrow
       + wideCount   * fontSize * coeffs.wide;
}

/**
 * Language-aware scaling factor for text measurement.
 * French and Creole text averages ~3–5 % wider due to accented characters
 * and longer average word length.
 */
function getLanguageScale(language?: string): number {
  switch (language) {
    case "fr": return 1.04;
    case "ht": return 1.05;  // Creole uses even more accented chars
    default:   return 1.0;   // English baseline
  }
}

function buildAdjustmentHint(field: string, text: string, maxLines: number, linesUsed: number): string {
  const excess = linesUsed - maxLines;
  const words = text.trim().split(/\s+/).length;
  const wordsToRemove = Math.ceil(words * (excess / linesUsed));
  return `"${field}" overflows by ~${excess} line(s). Remove ~${wordsToRemove} words.`;
}
