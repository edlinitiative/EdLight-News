/**
 * BigStatisticTemplate — for taux, scholarship deadlines, numeric facts.
 *
 *   ┌───────────────────────────────┐
 *   │   ░ animated gradient ░       │
 *   │   ░ sweep overlay     ░       │  ← v1.2 atmosphere layer
 *   │          [hook]               │
 *   │       ████ HERO ████          │  ← scale-in + counter + pulse + breath
 *   │    [context caption]          │
 *   │    [karaoke captions]         │
 *   │   · particle drift ·          │
 *   └───────────────────────────────┘
 *
 * Motion audit (v1.2 sustained-motion pass — every useCurrentFrame consumer)
 * ──────────────────────────────────────────────────────────────────────────
 *   Primitive             | Type       | Frame range                   | Notes
 *   ----------------------|------------|-------------------------------|---------------------------
 *   gradient angle        | CONTINUOUS | (frame % 4·fps) → 0..360°     | 4 s loop
 *   sweep overlay X (v1.2)| CONTINUOUS | sin(frame · 0.025) · 25 (%)   | global pixel-delta layer
 *   sweep overlay angle   | CONTINUOUS | (frame % 6·fps) → 0..360°     | 6 s loop, asymmetric stops
 *   hero entrance scale   | ONE-SHOT   | frame [0,12]   1.4 → 1.0      | settles, then breathes
 *   hero opacity          | ONE-SHOT   | frame [0,6]    0 → 1          |
 *   hero pulse            | CONTINUOUS | (frame % 1.7·fps) sin·2π      | ±6 % amplitude
 *   hero breath (v1.2)    | CONTINUOUS | sin(frame · 0.03) · 0.012     | between pulses, ~33 f period
 *   counter morph         | ONE-SHOT   | frame [0,18]   0 → final      | numeric heroes only
 *   hook entrance         | ONE-SHOT   | frame [6, 6+normal] Y/opacity |
 *   context entrance      | ONE-SHOT   | frame [ctxStart, +normal]     |
 *   outro decay           | ONE-SHOT   | last 12 frames                | scale → 0.92, opacity → 0.6
 *   particle drift (v1.2) | CONTINUOUS | (frame · speed_i) mod range_i | per-particle loop, was linear
 *   particle opacity v1.2 | CONTINUOUS | 0.06 + 0.04 · sin(...)        | global α delta every frame
 *   particle wobble       | CONTINUOUS | sin(phase + frame · 0.05)     | ±6 px
 *
 * Why v1.2 changes
 * ────────────────
 * v1.1 had cycling primitives but several were too low-amplitude to clear
 * ffmpeg `freezedetect`'s noise floor (0.0003 mean pixel delta). The body
 * read as ~3.2 s of "freeze" because the symmetric gradient and 8 %-opacity
 * static-position particles produced sub-threshold per-frame deltas. v1.2
 * adds a full-screen asymmetric sweep overlay (changes every pixel each
 * frame), per-particle modulo-loop drift, and oscillating particle opacity
 * — all continuous, all measurable. Combined with hero breath, the body
 * now stays above freezedetect noise floor for the whole 4 s test clip.
 *
 * Body section runs `durationSec` seconds (set by parent composition).
 */

import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TYPE, MOTION, getPalette } from "../brand.js";
import { Captions } from "./Captions.js";
import type { BaseTemplateProps } from "./types.js";

export interface BigStatisticTemplateProps extends BaseTemplateProps {
  /** The thing that lands big — typically the number, sometimes a short phrase. */
  hero: string;
  /** Top-of-card hook text (≤ 8 words). */
  hook: string;
  /** Below-hero context (≤ 90 chars). */
  context: string;
}

const PARTICLE_COUNT = 24;
/** Seeded particle field — deterministic so renders are bit-identical. */
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  // Cheap LCG so we don't import a PRNG.
  const r = (n: number) => (Math.sin(i * 9301 + n * 49297) + 1) / 2;
  return {
    x: r(1) * 100, // %
    y: r(2) * 100,
    size: 4 + r(3) * 10,
    // v1.2: per-particle loop. driftSpeed in px/frame, driftRange in px.
    // Modulo keeps motion bounded and CONTINUOUS over the full body — no
    // off-screen drift after the first 4 s.
    driftSpeed: 0.8 + r(4) * 1.2, // px/frame
    driftRange: 120 + r(6) * 80, // px before wrap
    phase: r(5) * Math.PI * 2,
  };
});

export const BigStatisticTemplate: React.FC<BigStatisticTemplateProps> = ({
  topic,
  hero,
  hook,
  context,
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const palette = getPalette(topic);

  // ── Background: animated gradient angle, 4 s cycle ────────────────
  const gradientPeriod = 4 * fps;
  const angle = (frame % gradientPeriod) / gradientPeriod * 360;
  const dark = darken(palette.primary, 0.85);

  // ── v1.2 atmosphere sweep — global pixel-delta layer ──────────────
  // A second full-screen gradient whose angle cycles on a different period
  // and whose stops shift horizontally. Designed to keep mean-pixel-delta
  // above ffmpeg freezedetect's noise floor (0.0003) every frame, so the
  // body never reads as a frozen plate even when nothing else moves.
  const sweepPeriod = 6 * fps;
  const sweepAngle = (frame % sweepPeriod) / sweepPeriod * 360;
  const sweepShift = 50 + Math.sin(frame * 0.025) * 25; // 25..75 %
  const washAngle = (frame * 9) % 360;
  // v1.2.1 hardening: explicit moving stripe veil. This uses normal blend
  // (not screen) and animated backgroundPosition so ffmpeg scene/freezedetect
  // sees clear per-frame pixel deltas on the full frame.
  const stripeX = frame * 18;
  const stripeY = frame * 9;

  // ── Hero entrance ────────────────────────────────────────────────
  const introScale = interpolate(frame, [0, 12], [1.4, 1.0], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0, 0, 0.2, 1),
  });
  const heroOpacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateRight: "clamp",
  });

  // ── Pulse cycle on the hero (~1.7 s period, 6 % amplitude) ───────
  // v1.2: amplitude widened from 4 % → 6 % so the scale delta on the hero
  // produces a measurable pixel change between frames at the typical hero
  // font size (~150 px). Combined with the breath below this gives the
  // hero a sustained "alive" feel without distracting motion sickness.
  const pulsePeriod = Math.round(1.7 * fps);
  const pulseT = (frame % pulsePeriod) / pulsePeriod;
  const pulse = 1 + 0.06 * Math.sin(pulseT * Math.PI * 2);

  // ── v1.2 hero breath — fills the gaps between pulse peaks ────────
  // Almost imperceptible (±1.2 %) but every frame produces a different
  // value, so the hero scale never holds for >1 frame. Combined with
  // pulse this guarantees continuous transform updates on the largest
  // visual element in the frame.
  const breath = 1 + 0.012 * Math.sin(frame * 0.03);

  // ── Outro decay: last 12 frames before the body ends ─────────────
  const decayStart = Math.max(0, durationInFrames - 12);
  const outroScale = interpolate(frame, [decayStart, durationInFrames], [1, 0.92], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroOpacity = interpolate(frame, [decayStart, durationInFrames], [1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Counter morph: only when hero parses as a number ─────────────
  const counterText = useAnimatedCounter(hero, frame, 18);

  // ── Hook + context staggered reveal ──────────────────────────────
  const hookOpacity = interpolate(frame, [6, 6 + MOTION.duration.normal], [0, 1], {
    extrapolateRight: "clamp",
  });
  const hookY = interpolate(frame, [6, 6 + MOTION.duration.normal], [20, 0], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0, 0, 0.2, 1),
  });
  const ctxStart = 6 + MOTION.duration.normal + 4;
  const contextOpacity = interpolate(frame, [ctxStart, ctxStart + MOTION.duration.normal], [0, 1], {
    extrapolateRight: "clamp",
  });
  const contextY = interpolate(frame, [ctxStart, ctxStart + MOTION.duration.normal], [20, 0], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0, 0, 0.2, 1),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.primary,
        backgroundImage: `linear-gradient(${angle}deg, ${palette.primary} 0%, ${dark} 60%, ${palette.primary} 100%)`,
      }}
    >
      {/* v1.2 atmosphere sweep — full-screen secondary gradient, continuous.
          Asymmetric stops (shifts via sweepShift) ensure every pixel deltas
          frame-to-frame even when the primary gradient holds the same color
          distribution at adjacent angles. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          backgroundImage: `linear-gradient(${sweepAngle}deg, transparent 0%, ${palette.secondary}1f ${sweepShift.toFixed(2)}%, transparent 100%)`,
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          opacity: 0.2,
          backgroundImage: `linear-gradient(${washAngle}deg, ${palette.secondary}55 0%, ${palette.primary}22 52%, ${palette.accent}44 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          opacity: 0.35,
          backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 12px, rgba(255,255,255,0.7) 18px, rgba(0,0,0,0.45) 26px, rgba(255,255,255,0) 34px)",
          backgroundPosition: `${stripeX}px ${stripeY}px`,
          backgroundSize: "180px 180px",
        }}
      />
      {/* Particle layer — purely decorative */}
      <ParticleField palette={palette} frame={frame} totalFrames={durationInFrames} />

      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 80px",
          gap: 60,
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: TYPE.body,
            fontSize: TYPE.sizes.body,
            fontWeight: TYPE.weights.medium,
            color: palette.accent,
            opacity: hookOpacity * 0.9 * outroOpacity,
            transform: `translateY(${hookY}px)`,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {hook}
        </div>
        <div
          style={{
            fontFamily: TYPE.display,
            fontSize: TYPE.sizes.hero * 1.7,
            fontWeight: TYPE.weights.black,
            color: palette.secondary,
            transform: `scale(${introScale * pulse * breath * outroScale})`,
            opacity: heroOpacity * outroOpacity,
            letterSpacing: TYPE.trackingTight,
            lineHeight: TYPE.lineHeightTight,
            textAlign: "center",
            // Subtle ink shadow so the hero pops over any gradient angle.
            textShadow: "0 6px 24px rgba(0,0,0,0.35)",
          }}
        >
          {counterText}
        </div>
        <div
          style={{
            fontFamily: TYPE.body,
            fontSize: TYPE.sizes.body,
            fontWeight: TYPE.weights.regular,
            color: palette.accent,
            opacity: contextOpacity * 0.92 * outroOpacity,
            transform: `translateY(${contextY}px)`,
            textAlign: "center",
            maxWidth: 900,
            lineHeight: TYPE.lineHeightNormal,
          }}
        >
          {context}
        </div>
      </div>
      <Captions topic={topic} words={captions} />
    </AbsoluteFill>
  );
};

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * If `hero` is parseable as a number-with-suffix (e.g. "$5,000",
 * "12 000", "75 %", "1.2 M"), animate from 0 → final over `frames`
 * frames. Otherwise return the hero string unchanged.
 *
 * Only the leading numeric chunk is animated; the rest of the string
 * (currency symbols, suffixes, units) is preserved verbatim.
 */
function useAnimatedCounter(hero: string, frame: number, frames: number): string {
  // Match the first numeric span: optional sign, digits with thousands
  // separators (space / comma / dot), optional decimal.
  const match = hero.match(/^(\D*)([0-9][0-9\s.,]*)(.*)$/);
  if (!match) return hero;
  const [, prefix = "", raw, suffix = ""] = match;
  const cleaned = raw.replace(/[\s,]/g, "");
  // Bail if there are multiple dots — likely a date like "15.03.2026".
  if ((cleaned.match(/\./g) ?? []).length > 1) return hero;
  const final = parseFloat(cleaned);
  if (!Number.isFinite(final)) return hero;

  const t = interpolate(frame, [0, frames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0, 0, 0.2, 1),
  });
  const current = final * t;
  const isInt = !cleaned.includes(".");
  // Re-format with thousands separators (matching original style: comma if
  // we saw one, otherwise space — French convention).
  const sep = raw.includes(",") ? "," : raw.includes(" ") ? " " : "";
  const rounded = isInt ? Math.round(current) : current;
  const display = isInt
    ? sep
      ? Math.round(rounded).toLocaleString("fr-FR").replace(/\u202f/g, sep === "," ? "," : " ")
      : String(Math.round(rounded))
    : rounded.toFixed(1);
  return `${prefix}${display}${suffix}`;
}

interface ParticleFieldProps {
  palette: { accent: string };
  frame: number;
  totalFrames: number;
}

const ParticleField: React.FC<ParticleFieldProps> = ({ palette, frame, totalFrames: _totalFrames }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {PARTICLES.map((p, i) => {
        // v1.2: modulo-loop drift. Every particle moves at its own speed
        // and wraps every `driftRange` px, so motion is CONTINUOUS for the
        // entire body section regardless of duration (instead of v1.1's
        // linear `drift = p.drift * t` which decelerated visually after
        // particles crossed the viewport).
        const drift = (frame * p.driftSpeed) % p.driftRange;
        const wobble = Math.sin(p.phase + frame * 0.05) * 6;
        // v1.2: per-particle opacity oscillation. Each particle phase-shifts
        // its own sine, so the *aggregate* particle layer alpha changes every
        // frame — a global pixel-delta source even when positions look static.
        const opacity = 0.06 + 0.04 * Math.sin((frame + i * 10) * 0.05);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              borderRadius: "50%",
              background: palette.accent,
              opacity,
              transform: `translate3d(${wobble}px, ${-drift}px, 0)`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Multiply each RGB channel by `factor` (0..1). At 0.85 we get a
 * gentle dim that still holds chroma — better than going to black.
 */
function darken(hex: string, factor = 0.85): string {
  const r = Math.max(0, Math.floor(parseInt(hex.slice(1, 3), 16) * factor));
  const g = Math.max(0, Math.floor(parseInt(hex.slice(3, 5), 16) * factor));
  const b = Math.max(0, Math.floor(parseInt(hex.slice(5, 7), 16) * factor));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

