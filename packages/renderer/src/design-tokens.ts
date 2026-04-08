/**
 * @edlight-news/renderer – Shared design tokens
 *
 * Single source of truth for the IG carousel visual system.
 * Bloomberg / Axios-inspired professional media layout:
 *   • Strict safe margins (120 top / 90 side / 100 bottom)
 *   • 3-level typography hierarchy
 *   • Consistent branding across all slide types
 */

// ── Canvas ─────────────────────────────────────────────────────────────────

export const CANVAS = { width: 1080, height: 1350 } as const;

// ── Safe margins ───────────────────────────────────────────────────────────

export const MARGIN = {
  top: 120,
  side: 90,
  bottom: 100,
} as const;

// ── Typography ─────────────────────────────────────────────────────────────
//
// Two-font system inspired by Bloomberg / Axios / Morning Brew:
//   Headlines → DM Sans (geometric, optical sizing, Black 900 for impact)
//   Body      → Inter (proven readability at small sizes)

/** Headlines, pills, stats, brand marks */
export const FONT_HEADLINE =
  "'DM Sans', 'Noto Color Emoji', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Body text, bullets, source lines, secondary UI */
export const FONT_BODY =
  "'Inter', 'Noto Color Emoji', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** @deprecated Use FONT_HEADLINE or FONT_BODY instead */
export const FONT_STACK = FONT_HEADLINE;

export const GOOGLE_FONTS_LINK =
  `<link rel="preconnect" href="https://fonts.googleapis.com">` +
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
  `<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,700;9..40,800;9..40,900&family=Inter:wght@400;500;600;700&family=Noto+Color+Emoji&display=swap" rel="stylesheet">`;

/** Font sizes in px – 3-level hierarchy. */
export const TYPE = {
  /** Category pill label */
  label: 20,
  /** First-slide hero headline */
  headlineHero: 88,
  /** Inner slide headline */
  headlineInner: 64,
  /** Body / bullet text */
  body: 34,
  /** Big stat number on data slides */
  stat: 120,
  /** Source / attribution line */
  source: 15,
} as const;

// ── Colour palettes per igType ─────────────────────────────────────────────

export const ACCENT: Record<string, string> = {
  scholarship: "#60a5fa",
  opportunity: "#fbbf24",
  news:        "#2dd4bf",
  histoire:    "#f59e0b",
  utility:     "#34d399",
  taux:        "#eab308",
  breaking:    "#f43f5e", // rose-red — urgent/flash
  stat:        "#a855f7", // purple  — data/statistics
};

export const DARK: Record<string, string> = {
  scholarship: "#060d1f",
  opportunity: "#0f0d08",
  news:        "#061014",
  histoire:    "#120b06",
  utility:     "#060f0b",
  taux:        "#0a1628",
  breaking:    "#150408",
  stat:        "#0f0514",
};

export const LABEL: Record<string, string> = {
  scholarship: "BOURSE",
  opportunity: "OPPORTUNITÉ",
  news:        "ACTUALITÉ",
  histoire:    "HISTOIRE",
  utility:     "GUIDE",
  taux:        "TAUX DU JOUR",
  breaking:    "FLASH",
  stat:        "DONNÉES",
};

// ── Overlay gradients (per-type) ───────────────────────────────────────────
//
// Each igType gets a cover (first slide) and inner (subsequent slides) overlay
// tuned for its typical text density and image brightness.

interface OverlayPair { cover: string; inner: string; }

/** News / histoire — text-heaviest slides; strongest overlays */
const OVERLAY_TEXT_HEAVY: OverlayPair = {
  cover: `linear-gradient(180deg,
    rgba(0,0,0,0.65) 0%,
    rgba(0,0,0,0.55) 20%,
    rgba(0,0,0,0.58) 45%,
    rgba(0,0,0,0.85) 70%,
    rgba(0,0,0,0.97) 82%,
    rgba(0,0,0,0.99) 100%)`,
  inner: `linear-gradient(180deg,
    rgba(0,0,0,0.52) 0%,
    rgba(0,0,0,0.36) 18%,
    rgba(0,0,0,0.32) 42%,
    rgba(0,0,0,0.58) 65%,
    rgba(0,0,0,0.80) 82%,
    rgba(0,0,0,0.90) 92%,
    rgba(0,0,0,0.95) 100%)`,
};

/** Scholarship / opportunity — medium text density; balanced overlays */
const OVERLAY_MEDIUM: OverlayPair = {
  cover: `linear-gradient(180deg,
    rgba(0,0,0,0.60) 0%,
    rgba(0,0,0,0.48) 20%,
    rgba(0,0,0,0.52) 45%,
    rgba(0,0,0,0.84) 70%,
    rgba(0,0,0,0.97) 82%,
    rgba(0,0,0,0.99) 100%)`,
  inner: `linear-gradient(180deg,
    rgba(0,0,0,0.46) 0%,
    rgba(0,0,0,0.30) 20%,
    rgba(0,0,0,0.30) 45%,
    rgba(0,0,0,0.52) 70%,
    rgba(0,0,0,0.76) 85%,
    rgba(0,0,0,0.88) 93%,
    rgba(0,0,0,0.93) 100%)`,
};

/** Utility / taux — rarely has full-bleed photos; standard overlays */
const OVERLAY_STANDARD: OverlayPair = {
  cover: `linear-gradient(180deg,
    rgba(0,0,0,0.60) 0%,
    rgba(0,0,0,0.45) 20%,
    rgba(0,0,0,0.50) 45%,
    rgba(0,0,0,0.84) 70%,
    rgba(0,0,0,0.97) 82%,
    rgba(0,0,0,0.99) 100%)`,
  inner: `linear-gradient(180deg,
    rgba(0,0,0,0.46) 0%,
    rgba(0,0,0,0.30) 20%,
    rgba(0,0,0,0.32) 50%,
    rgba(0,0,0,0.52) 70%,
    rgba(0,0,0,0.74) 85%,
    rgba(0,0,0,0.86) 93%,
    rgba(0,0,0,0.92) 100%)`,
};

/** Histoire — editorial photo-forward; transparent middle lets the background image breathe */
const OVERLAY_HISTOIRE: OverlayPair = {
  cover: `linear-gradient(180deg,
    rgba(0,0,0,0.58) 0%,
    rgba(0,0,0,0.30) 15%,
    rgba(0,0,0,0.10) 35%,
    rgba(0,0,0,0.08) 50%,
    rgba(0,0,0,0.42) 65%,
    rgba(0,0,0,0.78) 80%,
    rgba(0,0,0,0.93) 90%,
    rgba(0,0,0,0.97) 100%)`,
  inner: `linear-gradient(180deg,
    rgba(0,0,0,0.52) 0%,
    rgba(0,0,0,0.24) 15%,
    rgba(0,0,0,0.08) 35%,
    rgba(0,0,0,0.06) 50%,
    rgba(0,0,0,0.38) 65%,
    rgba(0,0,0,0.76) 80%,
    rgba(0,0,0,0.90) 90%,
    rgba(0,0,0,0.96) 100%)`,
};

/** Per-type overlay lookup. Defaults to OVERLAY_STANDARD. */
export const OVERLAY_BY_TYPE: Record<string, OverlayPair> = {
  news:        OVERLAY_TEXT_HEAVY,
  histoire:    OVERLAY_HISTOIRE,
  scholarship: OVERLAY_MEDIUM,
  opportunity: OVERLAY_MEDIUM,
  utility:     OVERLAY_STANDARD,
  taux:        OVERLAY_STANDARD,
  breaking:    OVERLAY_TEXT_HEAVY, // single slide — needs strong contrast over image
  stat:        OVERLAY_STANDARD,   // data layout rarely uses full-bleed photos
};

/** Legacy two-value OVERLAY for any code that still references it. */
export const OVERLAY = {
  hero:  OVERLAY_MEDIUM.cover,
  inner: OVERLAY_MEDIUM.inner,
} as const;
