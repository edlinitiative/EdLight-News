/**
 * BigStatisticTemplate — for taux, scholarship deadlines, numeric facts.
 *
 *   ┌───────────────────────────────┐
 *   │                               │
 *   │          [hook]               │
 *   │                               │
 *   │       ████ HERO ████          │  ← big number, scale + counter
 *   │                               │
 *   │    [context caption]          │
 *   │    [karaoke captions]         │
 *   └───────────────────────────────┘
 *
 * Body section runs `durationSec` seconds (set by parent composition).
 * Number scales 0.6 → 1.0 over MOTION.duration.slow, then holds.
 */

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
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

export const BigStatisticTemplate: React.FC<BigStatisticTemplateProps> = ({
  topic,
  hero,
  hook,
  context,
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);

  // Hero scale-in across the slow duration window.
  const scale = interpolate(frame, [0, MOTION.duration.slow], [0.6, 1.0], {
    extrapolateRight: "clamp",
  });
  const heroOpacity = interpolate(frame, [0, MOTION.duration.normal], [0, 1], {
    extrapolateRight: "clamp",
  });
  // Hook + context fade in slightly after the hero.
  const hookOpacity = interpolate(frame, [4, 16], [0, 1], { extrapolateRight: "clamp" });
  const contextOpacity = interpolate(
    frame,
    [MOTION.duration.normal, MOTION.duration.normal + 12],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.primary,
        backgroundImage: `radial-gradient(ellipse at center, ${palette.primary} 0%, ${darken(palette.primary)} 100%)`,
      }}
    >
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
        }}
      >
        <div
          style={{
            fontFamily: TYPE.body,
            fontSize: TYPE.sizes.body,
            fontWeight: TYPE.weights.medium,
            color: palette.accent,
            opacity: hookOpacity * 0.85,
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
            transform: `scale(${scale})`,
            opacity: heroOpacity,
            letterSpacing: TYPE.trackingTight,
            lineHeight: TYPE.lineHeightTight,
            textAlign: "center",
          }}
        >
          {hero}
        </div>
        <div
          style={{
            fontFamily: TYPE.body,
            fontSize: TYPE.sizes.body,
            fontWeight: TYPE.weights.regular,
            color: palette.accent,
            opacity: contextOpacity * 0.92,
            textAlign: "center",
            maxWidth: 900,
            lineHeight: TYPE.lineHeightNormal,
          }}
        >
          {context}
        </div>
      </div>
      <Captions topic={topic} words={captions} />
      <FrameIndex frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};

// Tiny helpers — keep templates readable without scattering color math.
function darken(hex: string): string {
  // Lazy 20% darken — interpret #RRGGBB and multiply each channel by 0.8.
  const r = Math.max(0, Math.floor(parseInt(hex.slice(1, 3), 16) * 0.8));
  const g = Math.max(0, Math.floor(parseInt(hex.slice(3, 5), 16) * 0.8));
  const b = Math.max(0, Math.floor(parseInt(hex.slice(5, 7), 16) * 0.8));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Dev-only frame indicator. Renders nothing in production builds.
const FrameIndex: React.FC<{ frame: number; fps: number }> = () => null;
