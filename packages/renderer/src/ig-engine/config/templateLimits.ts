/**
 * @edlight-news/renderer – IG Engine template zone configurations
 *
 * Defines all layout zones (text boxes, font sizes, copy limits) for the
 * 6 core IG templates. Canvas is always 1080×1350 (4:5 portrait).
 *
 * These are the source of truth for:
 *   - validateCopyLimits.ts  (word/char counts)
 *   - measureText.ts         (pixel-level fit checks)
 *   - renderSlides.ts        (absolute positioning)
 *
 * Rules:
 *   - All values are immutable at runtime.
 *   - Safe margins: 120 top / 90 side / 100 bottom.
 *   - Inner width: 1080 - 90*2 = 900 px.
 *   - Overflow always triggers rewrite, never font shrinking below minFontSize.
 */

import type { TemplateConfig } from "../types/post.js";

const W = 1080;
const H = 1350;
const SIDE = 90;
const INNER_W = W - SIDE * 2; // 900 px usable width

// ── Template registry ─────────────────────────────────────────────────────────

export const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {

  // ── 1. Breaking News Single ──────────────────────────────────────────────
  "breaking-news-single": {
    id: "breaking-news-single",
    name: "Breaking News Single",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 1,
    zones: {
      categoryLabel: {
        box: { x: SIDE, y: 92, width: 360, height: 48 },
        fontSize: 20, minFontSize: 18, fontFamily: "DM Sans", lineHeight: 1.2,
        limits: { maxWords: 3, maxChars: 18 },
      },
      headline: {
        box: { x: SIDE, y: 260, width: INNER_W, height: 580 },
        fontSize: 80, minFontSize: 52, fontFamily: "DM Sans", lineHeight: 1.05,
        limits: { maxWords: 16, minWords: 6, maxLines: 5 },
      },
      supportLine: {
        box: { x: SIDE, y: 880, width: INNER_W, height: 110 },
        fontSize: 32, minFontSize: 26, fontFamily: "Inter", lineHeight: 1.4,
        limits: { maxWords: 10, maxLines: 2, maxChars: 80 },
      },
      sourceLine: {
        box: { x: SIDE, y: H - 100 - 40, width: 660, height: 40 },
        fontSize: 18, minFontSize: 16, fontFamily: "Inter", lineHeight: 1.2,
        limits: { maxWords: 8, maxChars: 55 },
      },
    },
  },

  // ── 2. News Carousel ─────────────────────────────────────────────────────
  "news-carousel": {
    id: "news-carousel",
    name: "News Carousel",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 7,
    zones: {
      categoryLabel: {
        box: { x: SIDE, y: 92, width: 360, height: 48 },
        fontSize: 20, minFontSize: 18, fontFamily: "DM Sans", lineHeight: 1.2,
        limits: { maxWords: 3, maxChars: 18 },
      },
      headline: {
        box: { x: SIDE, y: 260, width: INNER_W, height: 380 },
        fontSize: 56, minFontSize: 38, fontFamily: "DM Sans", lineHeight: 1.1,
        limits: { maxWords: 14, maxLines: 5 },
      },
      body: {
        box: { x: SIDE, y: 600, width: INNER_W, height: 510 },
        fontSize: 34, minFontSize: 26, fontFamily: "Inter", lineHeight: 1.55,
        limits: { maxWords: 40, maxLines: 8, perBulletMaxLines: 3 },
      },
      supportLine: {
        box: { x: SIDE, y: 520, width: INNER_W, height: 150 },
        fontSize: 34, minFontSize: 28, fontFamily: "Inter", lineHeight: 1.4,
        limits: { maxWords: 24, maxLines: 3 },
      },
      sourceLine: {
        box: { x: SIDE, y: H - 100 - 40, width: 660, height: 40 },
        fontSize: 18, minFontSize: 16, fontFamily: "Inter", lineHeight: 1.2,
        limits: { maxWords: 8, maxChars: 55 },
      },
    },
  },

  // ── 3. Opportunity Carousel ──────────────────────────────────────────────
  "opportunity-carousel": {
    id: "opportunity-carousel",
    name: "Opportunity Carousel",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 6,
    zones: {
      categoryLabel: {
        box: { x: SIDE, y: 92, width: 360, height: 48 },
        fontSize: 20, minFontSize: 18, fontFamily: "DM Sans", lineHeight: 1.2,
        limits: { maxWords: 3, maxChars: 18 },
      },
      headline: {
        box: { x: SIDE, y: 240, width: INNER_W, height: 380 },
        fontSize: 56, minFontSize: 38, fontFamily: "DM Sans", lineHeight: 1.1,
        limits: { maxWords: 14, maxLines: 5 },
      },
      body: {
        box: { x: SIDE, y: 578, width: INNER_W, height: 370 },
        fontSize: 34, minFontSize: 26, fontFamily: "Inter", lineHeight: 1.55,
        limits: { maxWords: 30, maxLines: 7, perBulletMaxLines: 3 },
      },
      deadline: {
        box: { x: SIDE, y: 988, width: INNER_W, height: 100 },
        fontSize: 40, minFontSize: 30, fontFamily: "DM Sans", lineHeight: 1.2,
        limits: { maxWords: 8, maxLines: 2 },
      },
      sourceLine: {
        box: { x: SIDE, y: H - 100 - 40, width: 660, height: 40 },
        fontSize: 18, minFontSize: 16, fontFamily: "Inter", lineHeight: 1.2,
        limits: { maxWords: 8, maxChars: 55 },
      },
    },
  },

  // ── 4. Explainer Carousel ────────────────────────────────────────────────
  "explainer-carousel": {
    id: "explainer-carousel",
    name: "Explainer Carousel",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 8,
    zones: {
      categoryLabel: {
        box: { x: SIDE, y: 92, width: 360, height: 48 },
        fontSize: 20, minFontSize: 18, fontFamily: "DM Sans", lineHeight: 1.2,
        limits: { maxWords: 3, maxChars: 18 },
      },
      headline: {
        box: { x: SIDE, y: 240, width: INNER_W, height: 280 },
        fontSize: 56, minFontSize: 36, fontFamily: "DM Sans", lineHeight: 1.15,
        limits: { maxWords: 10, maxLines: 4 },
      },
      body: {
        box: { x: SIDE, y: 558, width: INNER_W, height: 560 },
        fontSize: 34, minFontSize: 26, fontFamily: "Inter", lineHeight: 1.6,
        limits: { maxWords: 45, maxLines: 10 },
      },
      sourceLine: {
        box: { x: SIDE, y: H - 100 - 40, width: 660, height: 40 },
        fontSize: 18, minFontSize: 16, fontFamily: "Inter", lineHeight: 1.2,
        limits: { maxWords: 8, maxChars: 55 },
      },
    },
  },

  // ── 5. Quote / Stat Card ─────────────────────────────────────────────────
  "quote-stat-card": {
    id: "quote-stat-card",
    name: "Quote / Stat Card",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 2,
    zones: {
      categoryLabel: {
        box: { x: SIDE, y: 92, width: 360, height: 48 },
        fontSize: 20, minFontSize: 18, fontFamily: "DM Sans", lineHeight: 1.2,
        limits: { maxWords: 3, maxChars: 18 },
      },
      headline: {
        // Used for pull-quote text variant
        box: { x: SIDE, y: 320, width: INNER_W, height: 620 },
        fontSize: 68, minFontSize: 40, fontFamily: "DM Sans", lineHeight: 1.1,
        limits: { maxWords: 20, maxLines: 7 },
      },
      statValue: {
        box: { x: SIDE, y: 280, width: INNER_W, height: 320 },
        fontSize: 160, minFontSize: 90, fontFamily: "DM Sans", lineHeight: 1.0,
        limits: { maxWords: 3, maxChars: 12 },
      },
      statDescription: {
        box: { x: SIDE, y: 630, width: INNER_W, height: 220 },
        fontSize: 36, minFontSize: 28, fontFamily: "Inter", lineHeight: 1.4,
        limits: { maxWords: 15, maxLines: 3 },
      },
      sourceLine: {
        box: { x: SIDE, y: H - 100 - 40, width: 660, height: 40 },
        fontSize: 18, minFontSize: 16, fontFamily: "Inter", lineHeight: 1.2,
        limits: { maxWords: 8, maxChars: 55 },
      },
    },
  },

  // ── 6. Weekly Recap Carousel ─────────────────────────────────────────────
  "weekly-recap-carousel": {
    id: "weekly-recap-carousel",
    name: "Weekly Recap Carousel",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 8,
    zones: {
      categoryLabel: {
        box: { x: SIDE, y: 92, width: 360, height: 48 },
        fontSize: 20, minFontSize: 18, fontFamily: "DM Sans", lineHeight: 1.2,
        limits: { maxWords: 3, maxChars: 18 },
      },
      headline: {
        box: { x: SIDE, y: 250, width: INNER_W, height: 260 },
        fontSize: 54, minFontSize: 36, fontFamily: "DM Sans", lineHeight: 1.15,
        limits: { maxWords: 10, maxLines: 4 },
      },
      body: {
        box: { x: SIDE, y: 550, width: INNER_W, height: 560 },
        fontSize: 32, minFontSize: 24, fontFamily: "Inter", lineHeight: 1.55,
        limits: { maxWords: 40, maxLines: 10 },
      },
      sourceLine: {
        box: { x: SIDE, y: H - 100 - 40, width: 660, height: 40 },
        fontSize: 18, minFontSize: 16, fontFamily: "Inter", lineHeight: 1.2,
        limits: { maxWords: 8, maxChars: 55 },
      },
    },
  },
};

// ── Lookup helpers ────────────────────────────────────────────────────────────

/** Return template config or throw if ID is unknown. */
export function getTemplateConfig(id: string): TemplateConfig {
  const cfg = TEMPLATE_CONFIGS[id];
  if (!cfg) throw new Error(`[ig-engine] Unknown template id: "${id}"`);
  return cfg;
}

/** List all registered template IDs. */
export function listTemplateIds(): string[] {
  return Object.keys(TEMPLATE_CONFIGS);
}
