/**
 * NumberedPointsTemplate — for fact-of-the-day, scholarship requirements,
 * "3 things to know" content. Shows points sequentially.
 *
 *   ┌───────────────────────────────┐
 *   │                               │
 *   │   [framing line, small]       │
 *   │                               │
 *   │   01    [point text]          │  ← cycles per second
 *   │   ──    ──────────────        │
 *   │                               │
 *   │   [karaoke captions]          │
 *   └───────────────────────────────┘
 *
 * Each point gets `durationSec / points.length` seconds. Background
 * alternates `palette.primary` / `palette.paper` per point for rhythm.
 */

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TYPE, getPalette } from "../brand.js";
import { Captions } from "./Captions.js";
import type { BaseTemplateProps } from "./types.js";

export interface NumberedPointsTemplateProps extends BaseTemplateProps {
  framing: string;
  points: string[];
}

export const NumberedPointsTemplate: React.FC<NumberedPointsTemplateProps> = ({
  topic,
  framing,
  points,
  durationSec,
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const palette = getPalette(topic);

  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const perPointFrames = Math.max(1, Math.floor(totalFrames / Math.max(1, points.length)));
  const pointIdx = Math.min(points.length - 1, Math.floor(frame / perPointFrames));
  const localFrame = frame - pointIdx * perPointFrames;

  // Always-on background motion: gradient angle cycles every 5 s so even
  // "static" frames pass scene-change detection.
  const bgPeriod = 5 * fps;
  const bgAngle = (frame % bgPeriod) / bgPeriod * 360;

  // Outro decay on the final point card only.
  const isLast = pointIdx === points.length - 1;
  const decayStart = Math.max(0, durationInFrames - 12);
  const outroOpacity = isLast
    ? interpolate(frame, [decayStart, durationInFrames], [1, 0.6], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const outroScale = isLast
    ? interpolate(frame, [decayStart, durationInFrames], [1, 0.96], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  // Slide the active point in from below; fade in over 10 frames.
  const pointY = interpolate(localFrame, [0, 10], [40, 0], { extrapolateRight: "clamp" });
  const pointOpacity = interpolate(localFrame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  // Crossfade out near the end of the dwell so the next point feels seamless.
  const fadeOutOpacity = interpolate(
    localFrame,
    [perPointFrames - 8, perPointFrames],
    [1, pointIdx === points.length - 1 ? 1 : 0],
    { extrapolateRight: "clamp" },
  );

  // Alternate background per point — primary then paper then primary…
  const isPaper = pointIdx % 2 === 1;
  const bg = isPaper ? palette.paper : palette.primary;
  const numColor = isPaper ? palette.primary : palette.secondary;
  const textColor = isPaper ? palette.ink : palette.accent;
  const framingColor = isPaper ? palette.ink : palette.accent;

  const number = String(pointIdx + 1).padStart(2, "0");
  const currentPoint = points[pointIdx] ?? "";

  // Subtle 8 % brightness wash overlay the alternating bg colour, swept by
  // bgAngle so the field never holds still between scene-change samples.
  const tint = isPaper ? palette.ink : palette.secondary;
  const bgImage = `linear-gradient(${bgAngle}deg, transparent 0%, ${tint}14 50%, transparent 100%)`;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, backgroundImage: bgImage }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "120px 90px 0",
          gap: 80,
          transform: `scale(${outroScale})`,
          opacity: outroOpacity,
          transformOrigin: "center center",
        }}
      >
        <div
          style={{
            fontFamily: TYPE.body,
            fontWeight: TYPE.weights.medium,
            fontSize: TYPE.sizes.body,
            color: framingColor,
            opacity: 0.8,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {framing}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 36,
            transform: `translateY(${pointY}px)`,
            opacity: pointOpacity * fadeOutOpacity,
          }}
        >
          <div
            style={{
              fontFamily: TYPE.mono,
              fontWeight: TYPE.weights.black,
              fontSize: TYPE.sizes.hero,
              color: numColor,
              lineHeight: 1,
              letterSpacing: TYPE.trackingTight,
            }}
          >
            {number}
          </div>
          <div
            style={{
              flex: 1,
              fontFamily: TYPE.display,
              fontWeight: TYPE.weights.bold,
              fontSize: TYPE.sizes.title,
              color: textColor,
              lineHeight: TYPE.lineHeightTight,
              letterSpacing: TYPE.trackingTight,
            }}
          >
            {currentPoint}
          </div>
        </div>
        {/* Progress dots */}
        <div style={{ display: "flex", gap: 10, marginTop: 40 }}>
          {points.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === pointIdx ? 36 : 12,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  i === pointIdx
                    ? numColor
                    : isPaper
                      ? palette.ink + "44"
                      : palette.accent + "44",
                transition: "width 200ms",
              }}
            />
          ))}
        </div>
      </div>
      <Captions topic={topic} words={captions} />
    </AbsoluteFill>
  );
};
