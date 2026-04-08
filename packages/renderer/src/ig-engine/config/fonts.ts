/**
 * @edlight-news/renderer – IG Engine font configuration
 *
 * Single source of truth for font families, weights, and per-character
 * measurement coefficients used by the text measurement engine.
 *
 * The coefficients are empirically calibrated so that measureText.ts can
 * estimate pixel widths without a live browser, catching obvious overflow
 * violations fast before the Playwright rendering pass.
 */

// ── Font declarations ─────────────────────────────────────────────────────────

export const FONTS = {
  headline: {
    family: "DM Sans",
    stack:
      "'DM Sans', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    /** Supported weights loaded from Google Fonts */
    weights: [400, 600, 700, 800, 900] as const,
    /**
     * Average advance-width coefficient (em-relative) at weight 800–900.
     * estimatedCharWidth = fontSize * avgWidthCoeff
     */
    avgWidthCoeff: 0.57,
    /** Space character width coefficient (narrower than average glyph) */
    spaceWidthCoeff: 0.26,
    /**
     * Narrow-glyph coefficient (i, l, 1, !, ., :, ;, |, ',)
     * These glyphs render at roughly 60 % of avgWidthCoeff.
     */
    narrowWidthCoeff: 0.34,
    /**
     * Wide-glyph coefficient (m, w, M, W)
     * These glyphs render at roughly 150 % of avgWidthCoeff.
     */
    wideWidthCoeff: 0.86,
  },

  body: {
    family: "Inter",
    stack:
      "'Inter', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    /** Supported weights loaded from Google Fonts */
    weights: [400, 500, 600, 700] as const,
    /** Average advance-width coefficient at weight 400–600 */
    avgWidthCoeff: 0.53,
    spaceWidthCoeff: 0.26,
    narrowWidthCoeff: 0.31,
    wideWidthCoeff: 0.80,
  },
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────

/** The two font families supported by the IG Engine. */
export type SupportedFontFamily = "DM Sans" | "Inter";

/** Per-family coefficient bundle returned by getFontCoefficients(). */
export interface FontCoefficients {
  avg: number;
  space: number;
  narrow: number;
  wide: number;
}

// ── Google Fonts URL ──────────────────────────────────────────────────────────

/**
 * Google Fonts CSS2 query URL — loads both families in all used weights.
 * Embed this in the `<head>` of every rendered slide for accurate rendering.
 */
export const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?" +
  "family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800;9..40,900" +
  "&family=Inter:wght@400;500;600;700" +
  "&display=swap";

// ── Coefficient lookup ────────────────────────────────────────────────────────

/**
 * Return measurement coefficients for the given font-family string.
 *
 * Accepts full stack strings (e.g. "'DM Sans', …") or bare family names.
 * Falls back to Inter (body) coefficients for unknown families.
 */
export function getFontCoefficients(fontFamily: string): FontCoefficients {
  const lower = fontFamily.toLowerCase();

  if (lower.includes("dm") || lower.includes("dm sans")) {
    return {
      avg: FONTS.headline.avgWidthCoeff,
      space: FONTS.headline.spaceWidthCoeff,
      narrow: FONTS.headline.narrowWidthCoeff,
      wide: FONTS.headline.wideWidthCoeff,
    };
  }

  // Default: Inter / body
  return {
    avg: FONTS.body.avgWidthCoeff,
    space: FONTS.body.spaceWidthCoeff,
    narrow: FONTS.body.narrowWidthCoeff,
    wide: FONTS.body.wideWidthCoeff,
  };
}

/**
 * Lightweight alias used by measureText.ts (returns avg + space only).
 * @deprecated Prefer getFontCoefficients() for full coefficient access.
 */
export function getFontCoefficient(fontFamily: string): { avg: number; space: number } {
  const c = getFontCoefficients(fontFamily);
  return { avg: c.avg, space: c.space };
}
