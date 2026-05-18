/**
 * CtaScene — shared CTA used by all four body template directors (v1.6).
 *
 * v1.6 overhaul rationale
 * ───────────────────────
 * Before v1.6 the CTA prominently displayed "edlight.news" — but viewers
 * cannot apply for a Royal Society scholarship on edlight.news. The CTA
 * scene now hands them off to the actual source. It also absorbs any
 * audio overhang via a dynamic `durationInFrames` (no more solid-blue
 * void tail).
 *
 * Layout (top → bottom)
 *   ─ accent bar (animated draw-on)
 *   ─ POSTULE / CANDIDATER / …      ← action verb (huge, pulse)
 *   ─ royalsociety.org · 15 mars    ← sourceDomain · deadline
 *   ─ 👉 Lien en description        ← tap-cue (replaces v1.5 down-chevron)
 *   ─ @edlightnews · suis pour plus  ← brand lockup (fades in last 0.6 s)
 *
 * Dynamic duration
 *   useVideoConfig().durationInFrames returns the SEQUENCE length here,
 *   so when the director uses scaleSceneDurations() to pad this scene
 *   with body slack, the lockup correctly fades in at the very end.
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
  /**
   * v1.6 — Display-ready domain of the actionable source (e.g.
   * "royalsociety.org"). Replaces "edlight.news" as the destination.
   * When undefined, falls back to "edlight.news" (legacy behaviour).
   */
  sourceDomain?: string;
  /**
   * v1.6 — Optional second line, typically the deadline string from
   * keyFacts ("15 mars 2025"). When present, rendered as
   * "{sourceDomain} · {deadline}" to reinforce urgency.
   */
  deadline?: string;
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
  sourceDomain,
  deadline,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
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

  // ── Tap cue: horizontal bob (replaces v1.5 down-chevron which pointed
  //    at the IG UI overlay area where there's nothing to interact with).
  const tapBob = 4 * Math.sin(pulseT * Math.PI * 2);
  const tapOpacity = interpolate(frame, [4, 14], [0, 0.92], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(...MOTION.ease.out),
  });

  // ── Accent bar: animated draw-on then breathe ─────────────────────
  const barWidth = interpolate(frame, [0, 12], [40, 92], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(...MOTION.ease.out),
  });

  // ── Brand lockup: fades in during the FINAL 18 frames (0.6 s) so the
  //    closing beat shows "@edlightnews · suis pour plus" without
  //    competing with the action verb during the main dwell.
  const lockupStart = Math.max(0, durationInFrames - 18);
  const lockupOpacity = interpolate(
    frame, [lockupStart, lockupStart + 12], [0, 0.78],
    { extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out) },
  );

  const label = ctaLabel ?? DEFAULT_CTA[topic] ?? "LIRE LA SUITE";
  // Compose destination line: "royalsociety.org · 15 mars" when both present;
  // either alone otherwise; fall back to edlight.news as a last resort
  // (only when both upstream fields are empty — should not happen in
  // practice post-pipeline-plumbing).
  const destination = sourceDomain ?? "edlight.news";
  const destinationLine = deadline ? `${destination} · ${deadline}` : destination;

  return (
    <AbsoluteFill
      style={{
        background: bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
        opacity: entranceOpacity,
        transform: `scale(${entranceScale})`,
        padding: "0 64px",
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

      {/* Destination line — the actual handoff (v1.6 fix for issue #2). */}
      <div
        style={{
          fontFamily: TYPE.body,
          fontWeight: TYPE.weights.bold,
          fontSize: TYPE.sizes.body,
          color: palette.primary,
          letterSpacing: "0.01em",
          textAlign: "center",
          maxWidth: 920,
          lineHeight: 1.2,
          opacity: 0.95,
        }}
      >
        {destinationLine}
      </div>

      {/* Tap cue — "Lien en description" with hand-tap glyph.
          Replaces v1.5 down-chevron which pointed at the IG UI strip. */}
      <div
        aria-hidden
        style={{
          marginTop: 6,
          transform: `translateX(${tapBob}px)`,
          opacity: tapOpacity,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          fontFamily: TYPE.body,
          fontWeight: TYPE.weights.semibold,
          fontSize: 30,
          color: palette.primary,
          letterSpacing: TYPE.trackingLoose,
          textTransform: "uppercase",
        }}
      >
        <TapGlyph color={palette.primary} size={36} />
        <span>Lien en description</span>
      </div>

      {/* Brand lockup — fades in during the final 0.6 s as a closing beat
          (v1.6 fix for issue #10 — provides the outro sting without
          mounting a separate scene). */}
      <div
        style={{
          marginTop: 18,
          fontFamily: TYPE.body,
          fontWeight: TYPE.weights.medium,
          fontSize: TYPE.sizes.caption,
          color: palette.primary,
          letterSpacing: TYPE.trackingLoose,
          textTransform: "uppercase",
          opacity: lockupOpacity,
        }}
      >
        @edlightnews · suis pour plus
      </div>
    </AbsoluteFill>
  );
};

/**
 * Hand-tap glyph — points at the caption area below the post.
 * Pure-SVG so no external icon font is needed.
 */
const TapGlyph: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9 11V6a2 2 0 1 1 4 0v5M13 11V4a2 2 0 1 1 4 0v8M17 11V7a2 2 0 1 1 4 0v9a6 6 0 0 1-6 6h-2a6 6 0 0 1-5.2-3l-3.3-5.7a2 2 0 0 1 .7-2.7l.3-.2a2 2 0 0 1 2.8.7L9 14"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
