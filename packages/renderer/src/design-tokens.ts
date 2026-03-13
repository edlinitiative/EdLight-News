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

export const FONT_STACK =
  "'Inter', 'Noto Color Emoji', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const GOOGLE_FONTS_LINK =
  `<link rel="preconnect" href="https://fonts.googleapis.com">` +
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
  `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Color+Emoji&display=swap" rel="stylesheet">`;

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
};

export const DARK: Record<string, string> = {
  scholarship: "#060d1f",
  opportunity: "#0f0d08",
  news:        "#061014",
  histoire:    "#120b06",
  utility:     "#060f0b",
  taux:        "#0a1628",
};

export const LABEL: Record<string, string> = {
  scholarship: "BOURSE",
  opportunity: "OPPORTUNITÉ",
  news:        "ACTUALITÉ",
  histoire:    "HISTOIRE",
  utility:     "GUIDE",
  taux:        "TAUX DU JOUR",
};

// ── Overlay gradients ──────────────────────────────────────────────────────

export const OVERLAY = {
  /** Heavy overlay for hero (first) slide with image — extra-dark bottom 20% hides watermarks */
  hero: `linear-gradient(180deg,
    rgba(0,0,0,0.55) 0%,
    rgba(0,0,0,0.25) 20%,
    rgba(0,0,0,0.30) 45%,
    rgba(0,0,0,0.80) 70%,
    rgba(0,0,0,0.97) 82%,
    rgba(0,0,0,0.99) 100%)`,
  /** Inner slide overlay — strengthened for reliably readable text over bright images */
  inner: `linear-gradient(180deg,
    rgba(0,0,0,0.70) 0%,
    rgba(0,0,0,0.65) 20%,
    rgba(0,0,0,0.68) 50%,
    rgba(0,0,0,0.78) 70%,
    rgba(0,0,0,0.92) 85%,
    rgba(0,0,0,0.97) 95%,
    rgba(0,0,0,0.99) 100%)`,

} as const;
