/**
 * @edlight-news/renderer – IG Engine brand configuration
 *
 * Single source of truth for the structured rendering engine's visual identity.
 * All template builders import from here rather than duplicating color values.
 */

// ── Brand identity ────────────────────────────────────────────────────────────

export const BRAND = {
  name: "EdLight News",
  wordmark: { left: "EDLIGHT", right: "NEWS" },
  instagram: "@edlightnews",

  colors: {
    primary: "#1e40af",
    primaryDark: "#1e3a8a",
    white: "#ffffff",
    offWhite: "#f1f5f9",
    dark: "#0f172a",
    darkAlt: "#1e293b",

    // Content-type accent colors
    breaking: "#f43f5e",    // Rose-red — urgent / flash
    news: "#2dd4bf",        // Teal — general news
    opportunity: "#fbbf24", // Amber — opportunities
    scholarship: "#60a5fa", // Sky-blue — scholarships
    explainer: "#a855f7",   // Purple — analysis / explainers
    stat: "#a855f7",        // Purple — data / statistics
    recap: "#34d399",       // Emerald — weekly recap
    history: "#f59e0b",     // Orange — histoire
    utility: "#34d399",     // Emerald — guides
  },

  // Dark canvas backgrounds per content type
  backgrounds: {
    breaking: "#150408",
    news: "#061014",
    opportunity: "#0f0d08",
    scholarship: "#060d1f",
    explainer: "#0f0514",
    stat: "#0f0514",
    recap: "#060f0b",
    history: "#120b06",
    utility: "#060f0b",
  },

  fonts: {
    headline: "'DM Sans', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    body: "'Inter', -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },

  /** Category pill labels (primarily French/Creole) */
  labels: {
    breaking: "FLASH",
    news: "ACTUALITÉ",
    opportunity: "OPPORTUNITÉ",
    scholarship: "BOURSE",
    explainer: "ANALYSE",
    stat: "DONNÉES",
    recap: "RÉSUMÉ",
    history: "HISTOIRE",
    utility: "GUIDE",
    default: "EDLIGHT NEWS",
  },
} as const;

// ── Helper functions ──────────────────────────────────────────────────────────

/** Resolve accent color for a given content type string. */
export function getBrandAccent(contentType: string): string {
  return (BRAND.colors as Record<string, string>)[contentType] ?? BRAND.colors.primary;
}

/** Resolve dark canvas background for a given content type string. */
export function getBrandBackground(contentType: string): string {
  return (BRAND.backgrounds as Record<string, string>)[contentType] ?? BRAND.backgrounds.news;
}

/** Resolve category pill label for a given content type string. */
export function getBrandLabel(contentType: string): string {
  return (BRAND.labels as Record<string, string>)[contentType] ?? contentType.toUpperCase();
}

// ── Google Fonts preload link (HTML head snippet) ──────────────────────────────

export const GOOGLE_FONTS_LINK =
  `<link rel="preconnect" href="https://fonts.googleapis.com">` +
  `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` +
  `<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700;9..40,800;9..40,900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">`;

// ── Shared HTML helpers ───────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Brand wordmark HTML used in footer area of all templates. */
export function brandWordmarkHtml(accent: string, fontSize = 18): string {
  return `<span style="font-family:${BRAND.fonts.headline};font-size:${fontSize}px;font-weight:800;letter-spacing:2.5px;display:inline-flex;align-items:center;gap:6px"><span style="color:rgba(255,255,255,0.85)">${BRAND.wordmark.left}</span><span style="color:${accent}">${BRAND.wordmark.right}</span></span>`;
}

/** Category pill HTML used at the top of all slides. */
export function categoryPillHtml(label: string, accent: string, fontFamily: string): string {
  return `<div style="display:inline-flex;align-items:center;background:${accent};color:#000;font-family:${fontFamily};font-size:20px;font-weight:800;text-transform:uppercase;letter-spacing:3px;padding:10px 24px;border-radius:4px">${escapeHtml(label)}</div>`;
}

/** Footer bar with source line and brand mark. */
export function footerBarHtml(sourceLine: string | undefined, accent: string, fontFamily: string): string {
  const src = sourceLine
    ? `<span style="font-size:17px;opacity:0.35;max-width:60%;line-height:1.3;font-weight:400;font-family:${fontFamily}">${escapeHtml(sourceLine)}</span>`
    : `<span></span>`;
  return `<div style="display:flex;justify-content:space-between;align-items:flex-end;padding-top:14px;border-top:1px solid rgba(255,255,255,0.10)">${src}${brandWordmarkHtml(accent)}</div>`;
}

/**
 * Premium background atmosphere: SVG fractal-noise grain at 4 % opacity
 * layered with a three-point radial mesh gradient using the slide's accent
 * colour. Replaces the flat left-edge accent bar on all templates.
 */
export function premiumAtmosphereHtml(accent: string): string {
  return (
    // SVG fractal-noise grain — subtle film texture
    `<svg style="position:absolute;inset:0;width:1080px;height:1350px;opacity:0.04;pointer-events:none">` +
    `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/></filter>` +
    `<rect width="100%" height="100%" filter="url(#grain)"/></svg>` +
    // Mesh gradient — three-point accent bleed
    `<div style="position:absolute;inset:0;pointer-events:none;background:` +
    `radial-gradient(ellipse at 80% 15%, ${accent}26 0%, transparent 50%),` +
    `radial-gradient(ellipse at 18% 80%, ${accent}1a 0%, transparent 45%),` +
    `radial-gradient(ellipse at 52% 48%, ${accent}0d 0%, transparent 38%)` +
    `"></div>`
  );
}
