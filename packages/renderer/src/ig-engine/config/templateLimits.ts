/**
 * @edlight-news/renderer – IG Engine template zone configurations
 *
 * SINGLE SOURCE OF TRUTH for all font-size, line-height, line-clamp, and
 * copy-limit values. Templates MUST read these values; hardcoding is forbidden.
 *
 * Canvas: 1080×1350 (4:5 portrait).
 * Safe margins: 120 top / 90 side / 100 bottom.  Inner width: 900 px.
 *
 * variantZones keys (per template):
 *   news-carousel      → cover | detail | data
 *   breaking-news-single → cover  (single slide, no variants)
 *   opportunity-carousel → cover | detail | deadline
 *   explainer-carousel → cover | detail
 *   quote-stat-card    → stat | quote
 *   weekly-recap-carousel → cover | detail
 *   taux-card          → cover | detail
 */

import type { TemplateConfig } from "../types/post.js";

const W = 1080;
const H = 1350;
const SIDE = 90;
const INNER_W = W - SIDE * 2; // 900 px usable width

// ── Shared small zones ────────────────────────────────────────────────────────

const SOURCE_LINE_ZONE = {
  box: { x: SIDE, y: H - 100 - 40, width: 660, height: 40 },
  fontSize: 18, minFontSize: 16, fontFamily: "Inter", lineHeight: 1.2,
  limits: { maxWords: 8, maxChars: 55 },
} as const;

const CATEGORY_LABEL_ZONE = {
  box: { x: SIDE, y: 92, width: 360, height: 48 },
  fontSize: 20, minFontSize: 18, fontFamily: "DM Sans", lineHeight: 1.2,
  limits: { maxWords: 3, maxChars: 18 },
} as const;

// ── Template registry ─────────────────────────────────────────────────────────

export const TEMPLATE_CONFIGS: Record<string, TemplateConfig> = {

  // ── 1. Breaking News Single ──────────────────────────────────────────────
  // One slide only; "cover" is the only variant.
  // CSS: headline 60–88px dynamic, support 30px/clamp:2
  "breaking-news-single": {
    id: "breaking-news-single",
    name: "Breaking News Single",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 1,
    zones: {
      categoryLabel: { ...CATEGORY_LABEL_ZONE },
      // Defaults used as fallback if resolveZone called without variant
      headline: {
        box: { x: SIDE, y: 260, width: INNER_W, height: 580 },
        fontSize: 60, minFontSize: 52, fontFamily: "DM Sans", lineHeight: 1.05,
        limits: { maxWords: 12, minWords: 6, maxLines: 6 },
        dynamicFontSize: [
          { maxWords: 6,  size: 88 },
          { maxWords: 9,  size: 80 },
          { maxWords: 12, size: 70 },
          { size: 60 },
        ],
      },
      supportLine: {
        box: { x: SIDE, y: 880, width: INNER_W, height: 84 },
        fontSize: 30, minFontSize: 24, fontFamily: "Inter", lineHeight: 1.4,
        limits: { maxWords: 10, maxLines: 2, maxChars: 80 },
      },
      sourceLine: { ...SOURCE_LINE_ZONE },
    },
    variantZones: {
      cover: {
        headline: {
          box: { x: SIDE, y: 260, width: INNER_W, height: 580 },
          fontSize: 60, minFontSize: 52, fontFamily: "DM Sans", lineHeight: 1.05,
          limits: { maxWords: 12, minWords: 6, maxLines: 6 },
          dynamicFontSize: [
            { maxWords: 6,  size: 88 },
            { maxWords: 9,  size: 80 },
            { maxWords: 12, size: 70 },
            { size: 60 },
          ],
        },
        supportLine: {
          box: { x: SIDE, y: 880, width: INNER_W, height: 84 },
          fontSize: 30, minFontSize: 24, fontFamily: "Inter", lineHeight: 1.4,
          limits: { maxWords: 10, maxLines: 2, maxChars: 80 },
        },
      },
    },
  },

  // ── 2. News Carousel ─────────────────────────────────────────────────────
  // cover: headline 46–76px dynamic / clamp:3(deck) 6(no-deck), deck 34px/clamp:3,
  //        cover-facts (body) 28px/clamp:2 per bullet
  // detail: headline 52px/clamp:3, bullets 32px/clamp:3 per bullet
  // data: statValue dynamic 100–140px, statDescription 36px/clamp:3
  "news-carousel": {
    id: "news-carousel",
    name: "News Carousel",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 7,
    zones: {
      categoryLabel: { ...CATEGORY_LABEL_ZONE },
      // Base fallback zone (detail values used as default)
      headline: {
        box: { x: SIDE, y: 260, width: INNER_W, height: 172 },
        fontSize: 52, minFontSize: 38, fontFamily: "DM Sans", lineHeight: 1.1,
        limits: { maxWords: 10, maxLines: 3 },
      },
      body: {
        box: { x: SIDE, y: 460, width: INNER_W, height: 690 },
        fontSize: 32, minFontSize: 26, fontFamily: "Inter", lineHeight: 1.5,
        // 2 bullets × 4 lines × ~7.5 words/line ≈ 60 words
        limits: { maxWords: 60, maxLines: 8, perBulletMaxLines: 4 },
      },
      supportLine: {
        box: { x: SIDE, y: 480, width: INNER_W, height: 150 },
        fontSize: 34, minFontSize: 28, fontFamily: "Inter", lineHeight: 1.4,
        limits: { maxWords: 24, maxLines: 3 },
      },
      sourceLine: { ...SOURCE_LINE_ZONE },
    },
    variantZones: {
      cover: {
        headline: {
          box: { x: SIDE, y: 260, width: INNER_W, height: 324 },
          fontSize: 56, minFontSize: 46, fontFamily: "DM Sans", lineHeight: 1.08,
          limits: { maxWords: 18, maxLines: 4 },
          dynamicFontSize: [
            { maxWords: 7,  size: 76 },
            { maxWords: 10, size: 66 },
            { maxWords: 14, size: 56 },
            { maxWords: 18, size: 48 },
            { size: 46 },
          ],
        },
        supportLine: {
          box: { x: SIDE, y: 600, width: INNER_W, height: 143 },
          fontSize: 34, minFontSize: 28, fontFamily: "Inter", lineHeight: 1.4,
          limits: { maxWords: 24, maxLines: 3 },
        },
        body: {
          box: { x: SIDE, y: 960, width: INNER_W, height: 240 },
          fontSize: 28, minFontSize: 22, fontFamily: "Inter", lineHeight: 1.45,
          limits: { maxWords: 30, maxLines: 6, perBulletMaxLines: 2 },
        },
      },
      detail: {
        headline: {
          box: { x: SIDE, y: 260, width: INNER_W, height: 172 },
          fontSize: 52, minFontSize: 38, fontFamily: "DM Sans", lineHeight: 1.1,
          limits: { maxWords: 10, maxLines: 3 },
        },
        body: {
          box: { x: SIDE, y: 460, width: INNER_W, height: 690 },
          fontSize: 32, minFontSize: 26, fontFamily: "Inter", lineHeight: 1.5,
          // 2 bullets × 4 lines × ~7.5 words/line ≈ 60 words
          limits: { maxWords: 60, maxLines: 8, perBulletMaxLines: 4 },
        },
      },
      data: {
        statValue: {
          box: { x: SIDE, y: 320, width: INNER_W, height: 200 },
          fontSize: 100, minFontSize: 80, fontFamily: "DM Sans", lineHeight: 1.0,
          limits: { maxWords: 3, maxChars: 12, maxLines: 2 },
          dynamicFontSize: [
            { maxChars: 4, size: 140 },
            { size: 100 },
          ],
        },
        statDescription: {
          box: { x: SIDE, y: 540, width: INNER_W, height: 154 },
          fontSize: 36, minFontSize: 28, fontFamily: "Inter", lineHeight: 1.4,
          limits: { maxWords: 15, maxLines: 3 },
        },
      },
    },
  },

  // ── 3. Opportunity Carousel ──────────────────────────────────────────────
  // cover: headline 58–80px dynamic/clamp:4
  // detail: headline 50px/clamp:3, bullets 30px/clamp:3 per, body 30px/clamp:7
  // deadline: value 72px/clamp:2, note (body) 28px/clamp:3
  "opportunity-carousel": {
    id: "opportunity-carousel",
    name: "Opportunity Carousel",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 6,
    zones: {
      categoryLabel: { ...CATEGORY_LABEL_ZONE },
      // Fallback (detail values)
      headline: {
        box: { x: SIDE, y: 240, width: INNER_W, height: 170 },
        fontSize: 50, minFontSize: 38, fontFamily: "DM Sans", lineHeight: 1.1,
        limits: { maxWords: 12, maxLines: 3 },
      },
      body: {
        box: { x: SIDE, y: 430, width: INNER_W, height: 650 },
        fontSize: 30, minFontSize: 24, fontFamily: "Inter", lineHeight: 1.55,
        // maxLines:7 × ~8 words/line ≈ 50 words
        limits: { maxWords: 50, maxLines: 7, perBulletMaxLines: 4 },
      },
      deadline: {
        box: { x: SIDE, y: 440, width: INNER_W, height: 150 },
        fontSize: 72, minFontSize: 48, fontFamily: "DM Sans", lineHeight: 1.05,
        limits: { maxWords: 8, maxLines: 2 },
      },
      sourceLine: { ...SOURCE_LINE_ZONE },
    },
    variantZones: {
      cover: {
        headline: {
          box: { x: SIDE, y: 240, width: INNER_W, height: 336 },
          fontSize: 58, minFontSize: 46, fontFamily: "DM Sans", lineHeight: 1.08,
          limits: { maxWords: 9, maxLines: 4 },
          dynamicFontSize: [
            { maxWords: 6, size: 80 },
            { maxWords: 9, size: 70 },
            { size: 58 },
          ],
        },
      },
      detail: {
        headline: {
          box: { x: SIDE, y: 240, width: INNER_W, height: 170 },
          fontSize: 50, minFontSize: 38, fontFamily: "DM Sans", lineHeight: 1.1,
          limits: { maxWords: 12, maxLines: 3 },
        },
        body: {
          box: { x: SIDE, y: 430, width: INNER_W, height: 650 },
          fontSize: 30, minFontSize: 24, fontFamily: "Inter", lineHeight: 1.55,
          // maxLines:7 × ~8 words/line ≈ 50 words
          limits: { maxWords: 50, maxLines: 7, perBulletMaxLines: 4 },
        },
      },
      deadline: {
        deadline: {
          box: { x: SIDE, y: 440, width: INNER_W, height: 150 },
          fontSize: 72, minFontSize: 48, fontFamily: "DM Sans", lineHeight: 1.05,
          limits: { maxWords: 8, maxLines: 2 },
        },
        body: {
          box: { x: SIDE, y: 630, width: INNER_W, height: 126 },
          fontSize: 28, minFontSize: 22, fontFamily: "Inter", lineHeight: 1.4,
          limits: { maxWords: 16, maxLines: 3 },
        },
      },
    },
  },

  // ── 4. Explainer Carousel ────────────────────────────────────────────────
  // cover: headline 58–80px dynamic/clamp:5, deck (supportLine) 30px/clamp:2
  // detail (concept): headline 52px/clamp:3, body 32px/clamp:8
  "explainer-carousel": {
    id: "explainer-carousel",
    name: "Explainer Carousel",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 8,
    zones: {
      categoryLabel: { ...CATEGORY_LABEL_ZONE },
      // Fallback (detail values)
      headline: {
        box: { x: SIDE, y: 240, width: INNER_W, height: 180 },
        fontSize: 52, minFontSize: 36, fontFamily: "DM Sans", lineHeight: 1.1,
        limits: { maxWords: 10, maxLines: 3 },
      },
      body: {
        box: { x: SIDE, y: 440, width: INNER_W, height: 700 },
        fontSize: 32, minFontSize: 26, fontFamily: "Inter", lineHeight: 1.6,
        limits: { maxWords: 45, maxLines: 8 },
      },
      sourceLine: { ...SOURCE_LINE_ZONE },
    },
    variantZones: {
      cover: {
        headline: {
          box: { x: SIDE, y: 240, width: INNER_W, height: 450 },
          fontSize: 58, minFontSize: 46, fontFamily: "DM Sans", lineHeight: 1.08,
          limits: { maxWords: 8, maxLines: 5 },
          dynamicFontSize: [
            { maxWords: 5, size: 80 },
            { maxWords: 8, size: 70 },
            { size: 58 },
          ],
        },
        supportLine: {
          box: { x: SIDE, y: 720, width: INNER_W, height: 90 },
          fontSize: 30, minFontSize: 24, fontFamily: "Inter", lineHeight: 1.5,
          limits: { maxWords: 16, maxLines: 2 },
        },
      },
      detail: {
        headline: {
          box: { x: SIDE, y: 240, width: INNER_W, height: 180 },
          fontSize: 52, minFontSize: 36, fontFamily: "DM Sans", lineHeight: 1.1,
          limits: { maxWords: 10, maxLines: 3 },
        },
        body: {
          box: { x: SIDE, y: 440, width: INNER_W, height: 700 },
          fontSize: 32, minFontSize: 26, fontFamily: "Inter", lineHeight: 1.6,
          limits: { maxWords: 45, maxLines: 8 },
        },
      },
    },
  },

  // ── 5. Quote / Stat Card ─────────────────────────────────────────────────
  // stat: statValue 110–200px dynamic (by chars), desc 36px/clamp:3, context 26px/clamp:2
  // quote: headline 48–80px dynamic (by words), clamp:7
  "quote-stat-card": {
    id: "quote-stat-card",
    name: "Quote / Stat Card",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 2,
    zones: {
      categoryLabel: { ...CATEGORY_LABEL_ZONE },
      // Fallback (quote values)
      headline: {
        box: { x: SIDE, y: 320, width: INNER_W, height: 620 },
        fontSize: 48, minFontSize: 40, fontFamily: "DM Sans", lineHeight: 1.2,
        limits: { maxWords: 20, maxLines: 7 },
        dynamicFontSize: [
          { maxWords: 8,  size: 80 },
          { maxWords: 14, size: 66 },
          { maxWords: 20, size: 56 },
          { size: 48 },
        ],
      },
      statValue: {
        box: { x: SIDE, y: 280, width: INNER_W, height: 320 },
        fontSize: 110, minFontSize: 90, fontFamily: "DM Sans", lineHeight: 1.0,
        limits: { maxWords: 3, maxChars: 12, maxLines: 2 },
        dynamicFontSize: [
          { maxChars: 4,  size: 200 },
          { maxChars: 7,  size: 160 },
          { maxChars: 10, size: 130 },
          { size: 110 },
        ],
      },
      statDescription: {
        box: { x: SIDE, y: 630, width: INNER_W, height: 154 },
        fontSize: 36, minFontSize: 28, fontFamily: "Inter", lineHeight: 1.4,
        limits: { maxWords: 15, maxLines: 3 },
      },
      sourceLine: { ...SOURCE_LINE_ZONE },
    },
    variantZones: {
      stat: {
        statValue: {
          box: { x: SIDE, y: 280, width: INNER_W, height: 320 },
          fontSize: 110, minFontSize: 90, fontFamily: "DM Sans", lineHeight: 1.0,
          limits: { maxWords: 3, maxChars: 12, maxLines: 2 },
          dynamicFontSize: [
            { maxChars: 4,  size: 200 },
            { maxChars: 7,  size: 160 },
            { maxChars: 10, size: 130 },
            { size: 110 },
          ],
        },
        statDescription: {
          box: { x: SIDE, y: 630, width: INNER_W, height: 154 },
          fontSize: 36, minFontSize: 28, fontFamily: "Inter", lineHeight: 1.4,
          limits: { maxWords: 15, maxLines: 3 },
        },
        body: {
          // context line beneath the stat
          box: { x: SIDE, y: 810, width: INNER_W, height: 72 },
          fontSize: 26, minFontSize: 22, fontFamily: "Inter", lineHeight: 1.4,
          limits: { maxWords: 12, maxLines: 2 },
        },
      },
      quote: {
        headline: {
          box: { x: SIDE, y: 320, width: INNER_W, height: 620 },
          fontSize: 48, minFontSize: 40, fontFamily: "DM Sans", lineHeight: 1.2,
          limits: { maxWords: 20, maxLines: 7 },
          dynamicFontSize: [
            { maxWords: 8,  size: 80 },
            { maxWords: 14, size: 66 },
            { maxWords: 20, size: 56 },
            { size: 48 },
          ],
        },
      },
    },
  },

  // ── 6. Weekly Recap Carousel ─────────────────────────────────────────────
  // cover: headline 60–80px dynamic/clamp:4
  // detail (story): headline 48–64px dynamic/clamp:3, body 30px/clamp:7
  "weekly-recap-carousel": {
    id: "weekly-recap-carousel",
    name: "Weekly Recap Carousel",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 8,
    zones: {
      categoryLabel: { ...CATEGORY_LABEL_ZONE },
      // Fallback (story/detail values)
      headline: {
        box: { x: SIDE, y: 250, width: INNER_W, height: 200 },
        fontSize: 48, minFontSize: 36, fontFamily: "DM Sans", lineHeight: 1.1,
        limits: { maxWords: 9, maxLines: 3 },
        dynamicFontSize: [
          { maxWords: 6, size: 64 },
          { maxWords: 9, size: 56 },
          { size: 48 },
        ],
      },
      body: {
        box: { x: SIDE, y: 470, width: INNER_W, height: 630 },
        fontSize: 30, minFontSize: 24, fontFamily: "Inter", lineHeight: 1.55,
        limits: { maxWords: 40, maxLines: 7 },
      },
      sourceLine: { ...SOURCE_LINE_ZONE },
    },
    variantZones: {
      cover: {
        headline: {
          box: { x: SIDE, y: 250, width: INNER_W, height: 340 },
          fontSize: 60, minFontSize: 48, fontFamily: "DM Sans", lineHeight: 1.08,
          limits: { maxWords: 8, maxLines: 4 },
          dynamicFontSize: [
            { maxWords: 5, size: 80 },
            { maxWords: 8, size: 70 },
            { size: 60 },
          ],
        },
      },
      detail: {
        headline: {
          box: { x: SIDE, y: 250, width: INNER_W, height: 200 },
          fontSize: 48, minFontSize: 36, fontFamily: "DM Sans", lineHeight: 1.1,
          limits: { maxWords: 9, maxLines: 3 },
          dynamicFontSize: [
            { maxWords: 6, size: 64 },
            { maxWords: 9, size: 56 },
            { size: 48 },
          ],
        },
        body: {
          box: { x: SIDE, y: 470, width: INNER_W, height: 630 },
          fontSize: 30, minFontSize: 24, fontFamily: "Inter", lineHeight: 1.55,
          limits: { maxWords: 40, maxLines: 7 },
        },
      },
    },
  },

  // ── 7. Taux Card (Exchange Rate) ─────────────────────────────────────────
  // cover: rate (headline) 124px/no-clamp, dateNote (supportLine) 22px
  // detail: title (headline) 52px/clamp:2, row (body) 32px/clamp:2 per row
  "taux-card": {
    id: "taux-card",
    name: "Taux Card",
    canvasWidth: W,
    canvasHeight: H,
    safeMargin: { top: 120, side: SIDE, bottom: 100 },
    maxSlides: 2,
    zones: {
      categoryLabel: { ...CATEGORY_LABEL_ZONE },
      // Fallback (detail values)
      headline: {
        box: { x: SIDE, y: 240, width: INNER_W, height: 115 },
        fontSize: 52, minFontSize: 38, fontFamily: "DM Sans", lineHeight: 1.1,
        limits: { maxWords: 10, maxLines: 2 },
      },
      body: {
        box: { x: SIDE, y: 380, width: INNER_W, height: 720 },
        fontSize: 32, minFontSize: 26, fontFamily: "Inter", lineHeight: 1.5,
        limits: { maxWords: 60, maxLines: 12, perBulletMaxLines: 2 },
      },
      sourceLine: { ...SOURCE_LINE_ZONE },
    },
    variantZones: {
      cover: {
        headline: {
          // rate value (e.g. "1 USD = 130 HTG")
          box: { x: SIDE, y: 420, width: INNER_W, height: 130 },
          fontSize: 124, minFontSize: 80, fontFamily: "DM Sans", lineHeight: 1.0,
          limits: { maxWords: 5, maxChars: 18, maxLines: 1 },
        },
        supportLine: {
          // date note (e.g. "15 jan. 2025")
          box: { x: SIDE, y: 580, width: INNER_W, height: 30 },
          fontSize: 22, minFontSize: 18, fontFamily: "Inter", lineHeight: 1.3,
          limits: { maxWords: 6, maxLines: 1 },
        },
      },
      detail: {
        headline: {
          box: { x: SIDE, y: 240, width: INNER_W, height: 115 },
          fontSize: 52, minFontSize: 38, fontFamily: "DM Sans", lineHeight: 1.1,
          limits: { maxWords: 10, maxLines: 2 },
        },
        body: {
          box: { x: SIDE, y: 380, width: INNER_W, height: 720 },
          fontSize: 32, minFontSize: 26, fontFamily: "Inter", lineHeight: 1.5,
          limits: { maxWords: 60, maxLines: 12, perBulletMaxLines: 2 },
        },
      },
    },
  },
};

// ── Derived char-budget constants ─────────────────────────────────────────────
// Formatters must cap bullet text to these values so the CSS line-clamp
// acts as a safety net, not a routine truncation mechanism.
//
// Formula: (INNER_W / (fontSize × avgCharCoeff)) × safetyFactor × clampLines
//   avgCharCoeff ≈ 0.52 for Inter.  safetyFactor ≈ 0.75 accounts for
//   word-wrap overhead and long French compound words.

/** Safe chars for detail body bullets: 32 px Inter, 900 px wide, 4-line clamp.
 *  (900 / (32 × 0.52)) × 0.75 × 4 ≈ 163 — use 160 as working limit. */
export const DETAIL_BULLET_CHARS = 160;

/** Safe chars for cover body facts: 28 px Inter, 900 px wide, 2-line clamp.
 *  (900 / (28 × 0.52)) × 0.75 × 2 ≈ 92 — use 90 as working limit. */
export const COVER_BULLET_CHARS = 90;

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
