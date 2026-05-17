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
//
// v1.4: type scale upgraded to premium ratio (1.414 ≈ √2) so hero / headline
// / title / body / caption form a clean visual hierarchy at thumbnail size.
export const TYPE = {
  display: "'Playfair Display', 'Georgia', serif",
  body: "'Inter', 'Helvetica Neue', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', monospace",
  sizes: {
    /** Massive standalone numbers — NumberedPoints index, BigStatistic hero. */
    mega: 240,
    /** Headline-scale numbers — counter, big-stat hero. */
    hero: 144,
    /** Top-level scene headline. */
    headline: 88,
    /** Scene titles, point body text. */
    title: 60,
    /** Supporting body copy. */
    body: 36,
    /** Eyebrow labels, small callouts, source line. */
    caption: 28,
    /** Footer / attribution. */
    footer: 22,
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    black: 900,
  },
  /** Premium uppercase eyebrow spacing — adds breathing room. */
  trackingLoose: "0.12em",
  trackingTight: "-0.02em",
  trackingNormal: "0",
  lineHeightTight: 1.04,
  lineHeightNormal: 1.35,
} as const;

// ── Motion ────────────────────────────────────────────────────────────
// Durations in frames at FRAME.fps (30). Easing curves are cubic-bezier
// arrays compatible with Remotion's `interpolate({ easing })`.
//
// v1.4 motion philosophy
// ──────────────────────
// The v1.3 architecture cuts hard between scenes. The v1.3 ENTRANCE
// animations (14-frame fades) caused visible empty frames right after a
// cut: the new scene's text was 0 % visible at frame 0 because the fade
// hadn't progressed yet.
//
// v1.4 fix: `enterFromCut` — every first-to-appear element in a scene
// should use these defaults so the cut never reveals a blank frame.
//
//   • durationFrames: 6  (snappy)
//   • opacityStart:   0.55  (already half-visible at frame 0)
//   • scaleStart:     1.04  (lands from gentle overshoot, not zoom-in)
//   • translateYStart:  8 px  (small slide for life, not a 24 px lurch)
export const MOTION = {
  ease: {
    in: [0.4, 0, 1, 1] as [number, number, number, number],
    out: [0.16, 1, 0.3, 1] as [number, number, number, number],      // premium "ease-out-expo"-ish
    inOut: [0.4, 0, 0.2, 1] as [number, number, number, number],
    /** Overshoot-and-settle. Use for hero numbers, CTA pops. */
    overshoot: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  },
  duration: {
    /** Instant punch — accent draws, scale pops. */
    snap: 4,
    /** Default entrance — text from cut. */
    fast: 6,
    /** Secondary content — supporting lines. */
    normal: 10,
    /** Slow reveal — underlines drawing on, long captions. */
    slow: 18,
    /** Backwards-compat alias. */
    quick: 6,
  },
  /**
   * Defaults for elements that appear as the FIRST visible item right after
   * a hard cut. Following these prevents the "empty frame at cut" bug.
   */
  enterFromCut: {
    durationFrames: 6,
    opacityStart: 0.55,
    scaleStart: 1.04,
    translateYStart: 8,
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
// Design rule (v1.4): backgrounds compose at most THREE clean layers:
//   1) base linear-gradient (cycling angle + lightness from palette.primary)
//   2) soft radial highlight that drifts within the scene
//   3) soft radial vignette for edge depth
// Allowed: solid color, linear-gradient, radial-gradient (non-repeating).
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
 * Soft radial highlight that drifts across the scene over a 6-second loop.
 * Each scene index nudges the highlight to a different anchor so adjacent
 * scenes don't look identically lit — adds the perception of depth + life
 * without breaking ffmpeg's scene-cut MAD score (highlight alpha = 0.18).
 */
function radialHighlight(frame: number, fps: number, sceneIndex: number): string {
  const cyclePos = (frame % (fps * 6)) / (fps * 6);
  const driftX = Math.sin(cyclePos * Math.PI * 2);
  const driftY = Math.cos(cyclePos * Math.PI * 2);
  // x roughly 30 → 70 %, anchored per scene so different scenes look distinct
  const x = 50 + driftX * 18 + ((sceneIndex * 11) % 24) - 12;
  const y = 28 + driftY * 6;
  return `radial-gradient(ellipse 55% 42% at ${x.toFixed(1)}% ${y.toFixed(1)}%, rgba(255,255,255,0.16) 0%, transparent 62%)`;
}

/** Soft edge vignette — keeps the eye on the center subject. */
function vignette(strength: number = 0.28): string {
  return `radial-gradient(ellipse 92% 72% at 50% 52%, transparent 48%, rgba(0,0,0,${strength}) 100%)`;
}

/**
 * Returns a `background` CSS string for a DARK scene: layered radial highlight
 * + vignette + cycling linear-gradient. The composition gives the scene
 * subtle depth and motion without resorting to tiled patterns.
 *
 * - Gradient angle cycles ±6° around a base angle over a 4-second loop.
 * - Each scene index shifts the base angle by 30° so adjacent scenes look
 *   visibly different — key for hard cuts to register as scene changes.
 * - Highlight drifts across the scene over a 6-second loop.
 * - Vignette is static (edge darken).
 *
 * NO tile pattern. NO background-image. NO repeat. Pure CSS layering.
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
  const highlight = radialHighlight(frame, fps, sceneIndex);
  const v = vignette(0.30);
  return {
    background: `${highlight}, ${v}, linear-gradient(${angle.toFixed(2)}deg, ${stop1} 0%, ${stop2} 100%)`,
  };
}

/**
 * Paper / light-scene background companion. Adds a very soft warm highlight
 * + a barely-there edge fade to the flat paper color so the scene reads
 * with depth instead of looking like a flat plate. Contrast with adjacent
 * dark scenes stays ≥ 0.6 MAD (scene-cut gate is 0.20).
 */
export function paperBackgroundForScene(
  palette: TopicPalette,
  frame: number,
  fps: number,
  sceneIndex: number = 0,
): { background: string } {
  const cyclePos = (frame % (fps * 6)) / (fps * 6);
  const driftX = Math.sin(cyclePos * Math.PI * 2);
  // Anchor highlight in a different corner per scene for variety.
  const corners = [[28, 22], [72, 24], [30, 78], [70, 76]] as const;
  const corner = corners[sceneIndex % corners.length]!;
  const x = corner[0] + driftX * 4;
  const y = corner[1];
  const highlight = `radial-gradient(ellipse 60% 45% at ${x.toFixed(1)}% ${y.toFixed(1)}%, ${shiftLightness(palette.paper, 3)} 0%, transparent 65%)`;
  const v = `radial-gradient(ellipse 95% 75% at 50% 58%, transparent 55%, ${shiftLightness(palette.paper, -6)} 100%)`;
  return {
    background: `${highlight}, ${v}, ${palette.paper}`,
  };
}

// ── Entrance animation helpers (v1.4) ─────────────────────────────────
//
// These helpers encode the "no empty cut frame" rule. Templates SHOULD use
// `enterFromCut*` for the very first element they reveal in each scene.
// Subsequent / staggered elements can use slower fades — but the first
// element must be visible at frame 0.
//
// All return plain numbers so callers can compose them into style transforms.

/**
 * Opacity that starts at MOTION.enterFromCut.opacityStart (not zero) and
 * ramps to 1 over `durationFrames`. The first frame of a scene is never
 * fully invisible.
 */
export function enterFromCutOpacity(
  frame: number,
  durationFrames: number = MOTION.enterFromCut.durationFrames,
  startAt: number = MOTION.enterFromCut.opacityStart,
): number {
  if (frame <= 0) return startAt;
  if (frame >= durationFrames) return 1;
  return startAt + (1 - startAt) * (frame / durationFrames);
}

/**
 * Scale that lands from a gentle overshoot. Visually reads as "settling
 * into place" without the empty-zoom-in feel of 0.94 → 1.0.
 */
export function enterFromCutScale(
  frame: number,
  durationFrames: number = MOTION.enterFromCut.durationFrames,
  overshoot: number = MOTION.enterFromCut.scaleStart,
): number {
  if (frame <= 0) return overshoot;
  if (frame >= durationFrames) return 1;
  const t = frame / durationFrames;
  return overshoot + (1 - overshoot) * (1 - Math.pow(1 - t, 3));
}

/**
 * Small Y translation — element starts a few pixels below its final position
 * and settles in over `durationFrames`. Adds life without making the cut feel
 * incomplete.
 */
export function enterFromCutTranslateY(
  frame: number,
  durationFrames: number = MOTION.enterFromCut.durationFrames,
  fromY: number = MOTION.enterFromCut.translateYStart,
): number {
  if (frame <= 0) return fromY;
  if (frame >= durationFrames) return 0;
  const t = frame / durationFrames;
  return fromY * (1 - (1 - Math.pow(1 - t, 3)));
}
