/**
 * CtaScene — shared CTA used by all four body template directors (v1.4).
 *
 * Visual upgrades over v1.3:
 *   - Halo: soft radial glow behind the action verb (palette.primary @ low α).
 *   - Animated chevron: down-arrow indicator that pulses to drive the action.
 *   - Stronger entrance: overshoot scale 1.06 → 1.0, opacity starts at 0.55
 *     so the cut never reveals an empty CTA scene.
 *   - Pulse: subtle scale 1.00 → 1.03 on a 1.4 s loop, plus tracking pump on
 *     the accent bar so the screen always has motion.
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  MOTION,
  TYPE,
  enterFromCutOpacity,
  enterFromCutScale,
  getPalette,
  shiftLightness,
} from "../../brand.js";
import type { ReelTopic } from "../../types.js";

export interface CtaSceneProps {
  topic: ReelTopic;
  /** Action label displayed in the CTA. Defaults by topic if not provided. */
  ctaLabel?: string;
  /** Scene index for backgroundForScene() — pass the actual index in the director. */
  sceneIndex?: number;
}

/** Per-topic CTA verbs — editorial, not marketing. */
const DEFAULT_CTA: Record<ReelTopic, string> = {
  scholarship: "POSTULE",
  opportunity: "CANDIDATER",
  taux:        "VOIR LE DÉTAIL",
  news:        "LIRE LA SUITE",
  histoire:    "EN SAVOIR PLUS",
  fact:        "EXPLORER",
  education:   "DÉCOUVRIR",
};

export const CtaScene: React.FC<CtaSceneProps> = ({
  topic,
  ctaLabel,
  sceneIndex = 3,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);

  // ── Background: palette.secondary with subtle radial highlight + vignette ─
  // Maintains the high-contrast "brand flip" required by the scene-cut test
  // (paper → secondary scores ~0.3–0.5 MAD, primary → secondary scores ~0.6+).
  const cycleT = (frame % (fps * 4)) / (fps * 4);
  const wobble = Math.sin(cycleT * Math.PI * 2);
  const angle = 135 + sceneIndex * 30 + wobble * 6;
  const stop1 = shiftLightness(palette.secondary, wobble * 3);
  const stop2 = shiftLightness(palette.secondary, -wobble * 1.5);
  const haloDriftX = 50 + Math.sin(cycleT * Math.PI * 2) * 6;
  const haloDriftY = 50 + Math.cos(cycleT * Math.PI * 2) * 4;
  const bg = `radial-gradient(ellipse 70% 50% at ${haloDriftX}% ${haloDriftY}%, ${shiftLightness(palette.secondary, 6)} 0%, transparent 60%),
              radial-gradient(ellipse 92% 72% at 50% 52%, transparent 50%, rgba(0,0,0,0.18) 100%),
              linear-gradient(${angle.toFixed(2)}deg, ${stop1} 0%, ${stop2} 100%)`;

  // ── Entrance ───────────────────────────────────────────────────────
  const entranceScale = enterFromCutScale(frame, 8, 1.06);
  const entranceOpacity = enterFromCutOpacity(frame, 6, 0.55);

  // ── Pulse: subtle scale 1.0 → 1.03 every 1.4 s ────────────────────
  const pulsePeriod = Math.round(1.4 * fps);
  const pulseT = (frame % pulsePeriod) / pulsePeriod;
  const pulse = 1 + 0.03 * Math.sin(pulseT * Math.PI * 2);

  // ── Halo: soft radial glow behind the label that breathes ─────────
  const haloPulse = 1 + 0.06 * Math.sin(pulseT * Math.PI * 2);
  const haloOpacity = 0.32 + 0.10 * Math.sin(pulseT * Math.PI * 2);

  // ── Chevron: bobs down 6 px on the same cadence as the pulse ──────
  const chevronY = 4 + 6 * Math.sin(pulseT * Math.PI * 2);
  const chevronOpacity = interpolate(frame, [4, 14], [0, 0.85], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(...MOTION.ease.out),
  });

  // ── Accent bar: animated draw-on then breathe ─────────────────────
  const barWidth = interpolate(frame, [0, 12], [40, 92], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(...MOTION.ease.out),
  });

  const label = ctaLabel ?? DEFAULT_CTA[topic] ?? "LIRE LA SUITE";

  return (
    <AbsoluteFill
      style={{
        background: bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        opacity: entranceOpacity,
        transform: `scale(${entranceScale})`,
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          width: barWidth,
          height: 6,
          borderRadius: 3,
          backgroundColor: palette.primary,
          opacity: 0.85,
        }}
      />

      {/* Halo glow + action verb */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "-80px -120px",
            background: `radial-gradient(ellipse at center, ${palette.primary} 0%, transparent 65%)`,
            opacity: haloOpacity,
            transform: `scale(${haloPulse})`,
            filter: "blur(8px)",
          }}
        />
        <div
          style={{
            position: "relative",
            fontFamily: TYPE.display,
            fontWeight: TYPE.weights.black,
            fontSize: TYPE.sizes.hero,
            color: palette.primary,
            letterSpacing: "0.04em",
            textAlign: "center",
            transform: `scale(${pulse})`,
            textShadow: "0 4px 22px rgba(0,0,0,0.22)",
            lineHeight: 1,
          }}
        >
          {label}
        </div>
      </div>

      {/* EdLight handle */}
      <div
        style={{
          fontFamily: TYPE.body,
          fontWeight: TYPE.weights.medium,
          fontSize: TYPE.sizes.caption,
          color: palette.primary,
          letterSpacing: TYPE.trackingLoose,
          textTransform: "uppercase",
          opacity: 0.78,
        }}
      >
        edlight.news
      </div>

      {/* Animated chevron — directional cue */}
      <div
        aria-hidden
        style={{
          marginTop: 12,
          transform: `translateY(${chevronY}px)`,
          opacity: chevronOpacity,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Chevron color={palette.primary} size={40} />
        <Chevron color={palette.primary} size={40} opacity={0.55} />
      </div>
    </AbsoluteFill>
  );
};

/** Down-pointing chevron SVG — pure stroke, no fill. */
const Chevron: React.FC<{ color: string; size: number; opacity?: number }> = ({
  color,
  size,
  opacity = 1,
}) => (
  <svg
    width={size}
    height={size * 0.5}
    viewBox="0 0 24 12"
    fill="none"
    style={{ opacity }}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M2 2 L12 10 L22 2"
      stroke={color}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
