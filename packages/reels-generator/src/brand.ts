/**
 * Brand design system — the single source of truth for Reels visual identity.
 *
 * Every template in `templates/` references this module and never hardcodes
 * a color, font, motion value, or sound effect. Adding a new template is
 * a matter of composing these primitives.
 *
 * Visual reference: docs/reels-style-guide.md
 *
 * Discipline rule (enforced by code review):
 *   ❌ <Text style={{ color: "#0B3D91" }}>          inline color
 *   ✅ <Text style={{ color: palette.primary }}>    brand-locked
 */

import type { ReelTopic } from "./types.js";

// ── Frame ─────────────────────────────────────────────────────────────
// Instagram Reels mandate 9:16 vertical at 1080×1920. 30fps gives us
// smooth motion without ballooning render times or file size.
export const FRAME = {
  width: 1080,
  height: 1920,
  fps: 30,
} as const;

// ── Topic palettes ────────────────────────────────────────────────────
//
// Each topic gets a 5-color anchor: primary (background/dominant),
// secondary (accent for numbers / highlights), accent (3rd color for
// callouts), ink (foreground text on light), paper (background on light
// alternation). These were curated to feel editorial — FT salmon, Economist
// red, NYT cream — adapted to Haitian palette tones.
//
// Hex values are the source of truth — do NOT add a `hsl()` variant here;
// templates should compose directly from these.
export interface TopicPalette {
  primary: string;
  secondary: string;
  accent: string;
  ink: string;
  paper: string;
}

export const TOPIC_PALETTE: Record<ReelTopic, TopicPalette> = {
  scholarship: {
    primary: "#0B3D91",
    secondary: "#F2C14E",
    accent: "#FFFFFF",
    ink: "#0A0A0A",
    paper: "#FAF7F0",
  },
  opportunity: {
    primary: "#1B5E20",
    secondary: "#FFB300",
    accent: "#FFFFFF",
    ink: "#0A0A0A",
    paper: "#F5F5F0",
  },
  taux: {
    primary: "#0F4C3A",
    secondary: "#C0392B",
    accent: "#F4D35E",
    ink: "#000000",
    paper: "#FFFFFF",
  },
  news: {
    primary: "#1A1A1A",
    secondary: "#E63946",
    accent: "#F1FAEE",
    ink: "#0A0A0A",
    paper: "#F8F8F4",
  },
  histoire: {
    primary: "#7B1E2B",
    secondary: "#D4A574",
    accent: "#F5EBDD",
    ink: "#0A0A0A",
    paper: "#F5EBDD",
  },
  fact: {
    primary: "#0E7C7B",
    secondary: "#FF7043",
    accent: "#FFFFFF",
    ink: "#0A0A0A",
    paper: "#F0F4F4",
  },
  education: {
    primary: "#264653",
    secondary: "#E9C46A",
    accent: "#F4A261",
    ink: "#0A0A0A",
    paper: "#FAF7F0",
  },
};

// ── Typography ────────────────────────────────────────────────────────
// One serif (display) + one sans (body) + one mono (numbered cards).
// Fonts are downloaded once and cached in Cloud Storage so Remotion can
// render offline. See docs/reels-style-guide.md for download/upload steps.
export const TYPE = {
  display: "'Playfair Display', 'Georgia', serif",
  body: "'Inter', 'Helvetica Neue', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sizes: {
    hero: 96,
    headline: 64,
    title: 48,
    body: 32,
    caption: 28,
    footer: 22,
  },
  weights: {
    regular: 400,
    medium: 500,
    bold: 700,
    black: 900,
  },
  trackingTight: "-0.02em",
  trackingNormal: "0",
  lineHeightTight: 1.05,
  lineHeightNormal: 1.35,
} as const;

// ── Motion ────────────────────────────────────────────────────────────
// Durations in frames at FRAME.fps (30). Easing curves are cubic-bezier
// arrays compatible with Remotion's `interpolate({ easing })`.
export const MOTION = {
  ease: {
    in: [0.4, 0, 1, 1] as [number, number, number, number],
    out: [0, 0, 0.2, 1] as [number, number, number, number],
    inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
  },
  duration: {
    quick: 8,
    normal: 14,
    slow: 22,
  },
  intro: {
    durationFrames: 36, // 1.2s @ 30fps
  },
  outro: {
    durationFrames: 45, // 1.5s @ 30fps
  },
} as const;

// ── Sound design ──────────────────────────────────────────────────────
// SFX are short (< 1s) percussive cues. CC0 from freesound.org / zapsplat.
// Files live in Cloud Storage — bucket name is REELS_STORAGE_BUCKET.
//
// Volume convention: SFX at -18dB beneath voiceover (~0.18 in Remotion).
export const SFX = {
  introWhoosh: "sfx/intro_whoosh.mp3",
  transitionTick: "sfx/transition_tick.mp3",
  outroChime: "sfx/outro_chime.mp3",
  /** Multiplier applied to all SFX channels. */
  defaultVolume: 0.18,
} as const;

// ── Brand assets ──────────────────────────────────────────────────────
// Logos and Sandra avatar — referenced by IntroCard / OutroCard. Paths
// are relative to REELS_STORAGE_BUCKET; consumers prepend the gs:// URL.
export const BRAND_ASSETS = {
  logoLight: "brand/edlight-news-logo-light.png",
  logoDark: "brand/edlight-news-logo-dark.png",
  sandraAvatar: "brand/sandra-avatar-512.png",
  /** Default fallback footage when Pexels and Wikimedia both fail. */
  fallbackFootage: "brand/fallback-bokeh-loop.mp4",
} as const;

/**
 * Helper — returns a palette with a dev-time check. If a future topic
 * is added to `ReelTopic` but not to `TOPIC_PALETTE`, this throws so the
 * gap is caught immediately rather than producing a black render.
 */
export function getPalette(topic: ReelTopic): TopicPalette {
  const p = TOPIC_PALETTE[topic];
  if (!p) {
    throw new Error(`brand: no palette defined for topic "${topic}"`);
  }
  return p;
}

// ── Background helpers ────────────────────────────────────────────────
//
// Design rule (v1.3): backgrounds must be clean gradients only.
// Allowed: solid color, linear-gradient, cycling angle/lightness.
// BANNED: repeating-linear-gradient, background-repeat, tiled patterns,
//         raster textures, crosshatch, diagonal-stripe overlays.
// See docs/reels-style-guide.md §3 Backgrounds for the full spec.

/**
 * Shift an #RRGGBB color's brightness by `deltaPercent` points (positive =
 * lighter, negative = darker). Each channel shifts uniformly — adequate for
 * the subtle ±4% lightness nudges we use in scene backgrounds.
 */
export function shiftLightness(hex: string, deltaPercent: number): string {
  if (!hex.startsWith("#") || hex.length !== 7) return hex;
  const delta = Math.round(255 * deltaPercent / 100);
  const clamp = (v: number) => Math.min(255, Math.max(0, v));
  const r = clamp(parseInt(hex.slice(1, 3), 16) + delta);
  const g = clamp(parseInt(hex.slice(3, 5), 16) + delta);
  const b = clamp(parseInt(hex.slice(5, 7), 16) + delta);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Returns a `background` CSS string for a scene: a clean, continuously
 * animating linear-gradient.
 *
 * - Gradient angle cycles ±6° around a base angle over a 4-second loop.
 * - Each scene index shifts the base angle by 30° so adjacent scenes look
 *   visibly different — key for hard cuts to register as scene changes.
 * - Stop colours are lightness-shifted variants of `palette.primary`.
 *
 * NO tile pattern. NO background-image. NO repeat. Pure math on `frame`.
 *
 * @param palette - topic palette
 * @param frame   - current Remotion frame (inside a Sequence = local frame)
 * @param fps     - frames per second from useVideoConfig()
 * @param sceneIndex - 0-based scene position (gives each scene a distinct hue)
 */
export function backgroundForScene(
  palette: TopicPalette,
  frame: number,
  fps: number,
  sceneIndex: number = 0,
): { background: string } {
  const cyclePosition = (frame % (fps * 4)) / (fps * 4); // 0..1 over 4s
  const wobble = Math.sin(cyclePosition * Math.PI * 2);
  const baseAngle = 135 + sceneIndex * 30; // scenes: 135°, 165°, 195°, 225°…
  const angle = baseAngle + wobble * 6;    // ±6° continuous wobble
  const lightShift = wobble * 4;           // ±4% lightness
  const stop1 = shiftLightness(palette.primary, lightShift);
  const stop2 = shiftLightness(palette.primary, -lightShift * 0.5);
  return { background: `linear-gradient(${angle.toFixed(2)}deg, ${stop1} 0%, ${stop2} 100%)` };
}
