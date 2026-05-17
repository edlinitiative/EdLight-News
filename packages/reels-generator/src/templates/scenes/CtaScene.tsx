/**
 * CtaScene — shared CTA used by all four body template directors.
 *
 * Visual: palette.secondary as the full-bleed background (brand flip —
 * the strongest visual punctuation in any Reel). A bold action verb
 * ("LIRE LA SUITE" / "POSTULE" / "EN SAVOIR PLUS") pulses gently; the
 * EdLight handle sits below in smaller caps.
 *
 * Duration target: 60 frames (2 s). Works well as the closing scene across
 * all topic types.
 */

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TYPE, getPalette, backgroundForScene } from "../../brand.js";
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

  // ── Background: solid palette.secondary — pure brand flip ──────────
  // Using mostly palette.secondary (not blended with primary) maximises
  // the scene-cut visibility. The cut FROM any palette.primary-based scene
  // TO this secondary background scores ~0.3-0.6 in ffmpeg's MAD metric
  // (enough to clear the MIN_HARD_CUT_COUNT gate at threshold 0.2).
  const angle = 135 + Math.sin((frame % (fps * 4)) / (fps * 4) * Math.PI * 2) * 6;
  const bg = `linear-gradient(${angle.toFixed(2)}deg, ${palette.secondary} 0%, ${palette.secondary}ee 100%)`;

  // ── Entrance: whole card scales in 0.94 → 1.0 over 12 frames ─────
  const entrance = interpolate(frame, [0, 12], [0.94, 1.0], {
    extrapolateRight: "clamp",
  });
  const fadeIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });

  // ── Pulse: scale 1.0 → 1.04 → 1.0 every 1.2 s ───────────────────
  const pulsePeriod = Math.round(1.2 * fps);
  const pulseT = (frame % pulsePeriod) / pulsePeriod;
  const pulse = 1 + 0.04 * Math.sin(pulseT * Math.PI * 2);

  const label = ctaLabel ?? DEFAULT_CTA[topic] ?? "LIRE LA SUITE";

  return (
    <AbsoluteFill
      style={{ background: bg, display: "flex", flexDirection: "column",
               alignItems: "center", justifyContent: "center", gap: 32,
               opacity: fadeIn, transform: `scale(${entrance})` }}
    >
      {/* Accent bar */}
      <div style={{ width: 60, height: 5, borderRadius: 3,
                    backgroundColor: palette.primary, opacity: 0.7 }} />

      {/* Action verb */}
      <div
        style={{
          fontFamily: TYPE.display,
          fontWeight: TYPE.weights.black,
          fontSize: TYPE.sizes.hero,
          color: palette.primary,
          letterSpacing: "0.04em",
          textAlign: "center",
          transform: `scale(${pulse})`,
          textShadow: "0 4px 18px rgba(0,0,0,0.18)",
        }}
      >
        {label}
      </div>

      {/* EdLight handle */}
      <div
        style={{
          fontFamily: TYPE.body,
          fontWeight: TYPE.weights.medium,
          fontSize: TYPE.sizes.caption,
          color: palette.primary,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          opacity: 0.75,
        }}
      >
        edlight.news
      </div>
    </AbsoluteFill>
  );
};
