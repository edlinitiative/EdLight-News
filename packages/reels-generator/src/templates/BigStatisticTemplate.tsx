/**
 * BigStatisticTemplate — for taux, scholarship deadlines, numeric facts.
 *
 *   ┌───────────────────────────────┐
 *   │   ░ animated gradient ░       │
 *   │          [hook]               │
 *   │       ████ HERO ████          │  ← scale-in + counter + pulse
 *   │    [context caption]          │
 *   │    [karaoke captions]         │
 *   │   · particle drift ·          │
 *   └───────────────────────────────┘
 *
 * Motion language (v1.1 quality pass — see docs/reels-style-guide.md):
 *   • Background gradient angle cycles 0° → 360° over 4 s.
 *   • Hero entrance: scale 1.4 → 1.0 over 12f, opacity over 6f.
 *   • Counter morphs from 0 → final value over 18f when the hero is numeric.
 *   • Hook reveals (translateY 20 → 0, fade) at frame 6, body at frame 14.
 *   • Pulse cycle 1.0 → 1.04 → 1.0 every ~1.7 s on the hero.
 *   • 24 background particles drift slowly at 8 % opacity.
 *   • Outro decay: scale → 0.92, opacity → 0.6 in the final 12 frames.
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
    drift: 60 + r(4) * 80, // px traveled across the full duration
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

  // ── Hero entrance ────────────────────────────────────────────────
  const introScale = interpolate(frame, [0, 12], [1.4, 1.0], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0, 0, 0.2, 1),
  });
  const heroOpacity = interpolate(frame, [0, 6], [0, 1], {
    extrapolateRight: "clamp",
  });

  // ── Pulse cycle on the hero (~1.7 s period, 4 % amplitude) ───────
  const pulsePeriod = Math.round(1.7 * fps);
  const pulseT = (frame % pulsePeriod) / pulsePeriod;
  const pulse = 1 + 0.04 * Math.sin(pulseT * Math.PI * 2);

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
            transform: `scale(${introScale * pulse * outroScale})`,
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

const ParticleField: React.FC<ParticleFieldProps> = ({ palette, frame, totalFrames }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {PARTICLES.map((p, i) => {
        const t = totalFrames > 0 ? frame / totalFrames : 0;
        const drift = p.drift * t;
        const wobble = Math.sin(p.phase + frame * 0.05) * 6;
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
              opacity: 0.08,
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

