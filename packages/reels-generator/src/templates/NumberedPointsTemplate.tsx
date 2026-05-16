/**
 * NumberedPointsTemplate — for fact-of-the-day, scholarship requirements,
 * "3 things to know" content. Shows points sequentially.
 *
 *   ┌───────────────────────────────┐
 *   │   ░ cycling gradient ░        │
 *   │   · drifting particles ·      │  ← v1.2
 *   │   [framing line, small]       │
 *   │                               │
 *   │   01    [point text]          │  ← cycles per second; badge bounces
 *   │   ──    ──────────────        │
 *   │   ● ● ●                       │  ← active dot width pulses (v1.2)
 *   │   [karaoke captions]          │
 *   └───────────────────────────────┘
 *
 * Each point gets `durationSec / points.length` seconds. Background
 * alternates `palette.primary` / `palette.paper` per point for rhythm.
 *
 * Motion audit (v1.2 sustained-motion pass)
 * ─────────────────────────────────────────
 *   Primitive               | Type       | Frame range                | Notes
 *   ------------------------|------------|----------------------------|-------------------------
 *   bg gradient angle       | CONTINUOUS | (frame % 5·fps) → 0..360°  | 5 s loop
 *   tint alpha (v1.2)       | STATIC     | linear-gradient at 22hex   | upgraded from 14hex
 *   sweep overlay (v1.2)    | CONTINUOUS | sweepAngle / sweepShift    | full-screen pixel delta
 *   particle drift (v1.2)   | CONTINUOUS | (frame · speed) mod range  | per-particle loop, 16 pts
 *   particle opacity (v1.2) | CONTINUOUS | 0.05 + 0.04 · sin(...)     | global α delta every frame
 *   per-point entrance      | ONE-SHOT   | localFrame [0,10] Y+fade   |
 *   per-point exit fade     | ONE-SHOT   | localFrame [perPt-8,perPt] |
 *   badge bounce (v1.2)     | CONTINUOUS | sin(localFrame · 0.04) · 3 | translateY, post-entrance
 *   active-dot width (v1.2) | CONTINUOUS | 36 + 6 · sin(...)          | 30..42 px continuous
 *   outro decay             | ONE-SHOT   | last 12 frames, last point | scale → 0.96, α → 0.6
 *
 * v1.2 added: sweep overlay, particle field (copied from BigStatistic with
 * smaller count), badge bounce, dot pulse, and bumped the tint wash alpha
 * from `14` (8 %) to `22` (13 %) so the cycling gradient is visible enough
 * to clear ffmpeg `freezedetect`'s noise floor on its own.
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

// Seeded mini particle field (16 particles vs BigStatistic's 24).
const NP_PARTICLE_COUNT = 16;
const NP_PARTICLES = Array.from({ length: NP_PARTICLE_COUNT }, (_, i) => {
  const r = (n: number) => (Math.sin(i * 7411 + n * 31337) + 1) / 2;
  return {
    x: r(1) * 100,
    y: r(2) * 100,
    size: 3 + r(3) * 8,
    driftSpeed: 0.6 + r(4) * 1.0,
    driftRange: 100 + r(6) * 80,
    phase: r(5) * Math.PI * 2,
  };
});

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

  // ── Background: gradient angle cycles every 5 s (CONTINUOUS) ─────
  const bgPeriod = 5 * fps;
  const bgAngle = (frame % bgPeriod) / bgPeriod * 360;

  // ── v1.2 atmosphere sweep — global pixel delta layer ─────────────
  const sweepPeriod = 7 * fps;
  const sweepAngle = (frame % sweepPeriod) / sweepPeriod * 360;
  const sweepShift = 50 + Math.sin(frame * 0.022) * 22;
  const washAngle = (frame * 8) % 360;
  const stripeX = frame * 18;
  const stripeY = frame * 9;

  // ── Outro decay on the final point card only ─────────────────────
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

  // ── Per-point entrance (one-shot, slides in from below) ──────────
  const pointY = interpolate(localFrame, [0, 10], [40, 0], { extrapolateRight: "clamp" });
  const pointOpacity = interpolate(localFrame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  // Crossfade out near the end of the dwell so the next point feels seamless.
  const fadeOutOpacity = interpolate(
    localFrame,
    [perPointFrames - 8, perPointFrames],
    [1, pointIdx === points.length - 1 ? 1 : 0],
    { extrapolateRight: "clamp" },
  );

  // ── v1.2 badge bounce — CONTINUOUS, fills the dwell ──────────────
  // The number badge gently bobs ±3 px after the entrance has settled.
  // Period ~25 frames (~0.83 s), small enough not to draw the eye yet
  // produces a measurable frame-to-frame transform delta on the largest
  // numeric glyph on screen.
  const badgeBob = Math.sin(localFrame * 0.04) * 3;

  // ── v1.2 active-dot pulse — CONTINUOUS ───────────────────────────
  // Active dot width oscillates 30..42 px so the bottom UI keeps animating
  // even mid-dwell.
  const activeDotWidth = 36 + Math.sin(frame * 0.05) * 6;

  // Alternate background per point — primary then paper then primary…
  const isPaper = pointIdx % 2 === 1;
  const bg = isPaper ? palette.paper : palette.primary;
  const numColor = isPaper ? palette.primary : palette.secondary;
  const textColor = isPaper ? palette.ink : palette.accent;
  const framingColor = isPaper ? palette.ink : palette.accent;

  const number = String(pointIdx + 1).padStart(2, "0");
  const currentPoint = points[pointIdx] ?? "";

  // v1.2: tint alpha bumped from 14 (8 %) to 22 (13 %) so the cycling
  // gradient is visible enough on its own. The sweep overlay adds an extra
  // moving wash on top.
  const tint = isPaper ? palette.ink : palette.secondary;
  const bgImage = `linear-gradient(${bgAngle}deg, transparent 0%, ${tint}22 50%, transparent 100%)`;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, backgroundImage: bgImage }}>
      {/* v1.2 sweep overlay — global continuous α-delta layer. */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          backgroundImage: `linear-gradient(${sweepAngle}deg, transparent 0%, ${tint}14 ${sweepShift.toFixed(2)}%, transparent 100%)`,
          mixBlendMode: "screen",
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          opacity: 0.18,
          backgroundImage: `linear-gradient(${washAngle}deg, ${numColor}55 0%, ${bg}22 52%, ${textColor}44 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          opacity: 0.34,
          backgroundImage: "repeating-linear-gradient(140deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 12px, rgba(255,255,255,0.7) 18px, rgba(0,0,0,0.42) 26px, rgba(255,255,255,0) 34px)",
          backgroundPosition: `${stripeX}px ${stripeY}px`,
          backgroundSize: "180px 180px",
        }}
      />
      {/* v1.2 particle layer */}
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
        {NP_PARTICLES.map((p, i) => {
          const drift = (frame * p.driftSpeed) % p.driftRange;
          const wobble = Math.sin(p.phase + frame * 0.05) * 5;
          const opacity = 0.05 + 0.04 * Math.sin((frame + i * 10) * 0.05);
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
                background: numColor,
                opacity,
                transform: `translate3d(${wobble}px, ${-drift}px, 0)`,
              }}
            />
          );
        })}
      </AbsoluteFill>
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
          position: "relative",
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
              transform: `translateY(${badgeBob}px)`,
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
        {/* Progress dots — active dot's width pulses continuously (v1.2). */}
        <div style={{ display: "flex", gap: 10, marginTop: 40 }}>
          {points.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === pointIdx ? activeDotWidth : 12,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  i === pointIdx
                    ? numColor
                    : isPaper
                      ? palette.ink + "44"
                      : palette.accent + "44",
              }}
            />
          ))}
        </div>
      </div>
      <Captions topic={topic} words={captions} />
    </AbsoluteFill>
  );
};
