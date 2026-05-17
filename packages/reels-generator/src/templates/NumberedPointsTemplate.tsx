/**
 * NumberedPointsTemplate — director + 5 scene cuts (v1.4).
 *
 * Director plan (390 frames = 13 s @ 30 fps):
 *   Scene 0  HookScene   60f  2s  Framing text card with eyebrow
 *   Scene 1  PointScene  90f  3s  Point 1 of N — MASSIVE number on top
 *   Scene 2  PointScene  90f  3s  Point 2 of N
 *   Scene 3  PointScene  90f  3s  Point 3 of N  (extras truncated to 3)
 *   Scene 4  CtaScene    60f  2s  Brand-flip CTA
 *
 * v1.4 upgrades:
 *   - Mega-scale numbers (240 px) with accent block behind
 *   - enterFromCut helpers — no empty frames immediately after a cut
 *   - paperBackgroundForScene / backgroundForScene depth (radial highlight + vignette)
 *   - Progress dots scale-pop as they activate
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  MOTION,
  TYPE,
  backgroundForScene,
  enterFromCutOpacity,
  enterFromCutScale,
  enterFromCutTranslateY,
  getPalette,
  paperBackgroundForScene,
} from "../brand.js";
import { Captions } from "./Captions.js";
import { CtaScene } from "./scenes/CtaScene.js";
import type { BaseTemplateProps, DirectorSpec, SceneSpec } from "./types.js";

// Dynamic director: framing hook + up to 3 point cards + CTA = 390f max
function buildDirectorSpec(pointCount: number): DirectorSpec {
  const n = Math.min(3, Math.max(1, pointCount));
  const specs: SceneSpec[] = [
    { id: "hook", durationFrames: 60 },
    ...Array.from({ length: n }, (_, i) => ({ id: `point-${i}`, durationFrames: 90 })),
    { id: "cta",  durationFrames: 60 },
  ];
  return specs;
}

export interface NumberedPointsTemplateProps extends BaseTemplateProps {
  framing: string;
  points: string[];
}

// ── Scene 0: HookScene (2 s) ──────────────────────────────────────────────
// Paper (light) background so the cut to PointScene #1 (dark) scores high.
const HookScene: React.FC<NumberedPointsTemplateProps> = ({ topic, framing }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = paperBackgroundForScene(palette, frame, fps, 0);

  // Snappy entry: visible at frame 0, settles in 6 frames.
  const opacity = enterFromCutOpacity(frame, MOTION.duration.fast);
  const scale = enterFromCutScale(frame, 8);
  const translateY = enterFromCutTranslateY(frame, 7);

  // Eyebrow + underline draw a beat AFTER the headline lands so the eye
  // moves down to the headline first.
  const eyebrowOpacity = interpolate(frame, [4, 14], [0, 0.75], { extrapolateRight: "clamp" });
  const underlineW = interpolate(frame, [10, 26], [0, 96], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(...MOTION.ease.out),
  });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            padding: "0 80px", gap: 28 }}>
      <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.semibold,
                    fontSize: TYPE.sizes.caption, color: palette.primary,
                    letterSpacing: TYPE.trackingLoose, textTransform: "uppercase",
                    opacity: eyebrowOpacity }}>
        À RETENIR
      </div>
      <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.black,
                    fontSize: TYPE.sizes.headline, lineHeight: TYPE.lineHeightTight,
                    color: palette.ink, textAlign: "center", letterSpacing: TYPE.trackingTight,
                    opacity, transform: `translateY(${translateY}px) scale(${scale})` }}>
        {framing}
      </div>
      <div style={{ width: underlineW, height: 6, borderRadius: 3,
                    backgroundColor: palette.secondary }} />
    </AbsoluteFill>
  );
};

// ── PointScene: numbered card (3 s each) ──────────────────────────────────
interface PointSceneProps extends NumberedPointsTemplateProps {
  pointIndex: number;
  totalPoints: number;
  sceneIndex: number;
}

// Odd sceneIndex (1, 3) = dark primary; even sceneIndex (2) = paper (light).
// This ensures every scene boundary is a high-contrast dark↔light cut.
const PointScene: React.FC<PointSceneProps> = ({ topic, points, pointIndex, totalPoints, sceneIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const isLight = sceneIndex % 2 === 0;
  const bg = isLight
    ? paperBackgroundForScene(palette, frame, fps, sceneIndex)
    : backgroundForScene(palette, frame, fps, sceneIndex);

  // Mega-number: drops in with overshoot, breathes thereafter.
  const numScale = enterFromCutScale(frame, 8, 1.10);
  const numTranslateY = enterFromCutTranslateY(frame, 8, 14);
  const numOpacity = enterFromCutOpacity(frame, 5, 0.50);
  const numBreathe = 1 + 0.012 * Math.sin(Math.max(0, frame - 12) * 0.06);

  // Point text: slightly delayed for staggered reveal.
  const textOpacity = interpolate(frame, [4, 14], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(...MOTION.ease.out),
  });
  const textY = interpolate(frame, [4, 16], [22, 0], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(...MOTION.ease.out),
  });

  const currentPoint = points[pointIndex] ?? "";
  const number = String(pointIndex + 1).padStart(2, "0");

  // Adaptive colors for light vs dark background.
  const numColor  = isLight ? palette.primary : palette.secondary;
  const textColor = isLight ? palette.ink     : palette.accent;
  const dotColor  = isLight ? palette.primary : palette.secondary;
  const accentBlockColor = isLight ? palette.secondary : palette.primary;

  // Accent block behind the number (subtle slab of color).
  const accentBlockW = interpolate(frame, [0, 12], [120, 220], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(...MOTION.ease.out),
  });
  const accentBlockOpacity = interpolate(frame, [0, 10], [0.30, 0.55], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "flex-start", justifyContent: "center",
                            padding: "0 80px", gap: 12 }}>
      {/* Number + slab underline (the slab sits BENEATH the baseline,
          reads as a highlighter swipe — not a slice through the number). */}
      <div style={{ position: "relative", display: "inline-flex", flexDirection: "column",
                    alignItems: "flex-start",
                    transform: `translateY(${numTranslateY}px) scale(${numScale * numBreathe})`,
                    opacity: numOpacity, marginBottom: -8, transformOrigin: "left center" }}>
        <div style={{ position: "relative", fontFamily: TYPE.display,
                      fontWeight: TYPE.weights.black,
                      fontSize: TYPE.sizes.mega, color: numColor,
                      letterSpacing: TYPE.trackingTight, lineHeight: 0.92,
                      textShadow: isLight ? "none" : "0 8px 30px rgba(0,0,0,0.35)" }}>
          {number}
        </div>
        <div aria-hidden style={{ marginTop: -22,
                                  width: accentBlockW, height: 14, borderRadius: 7,
                                  backgroundColor: accentBlockColor,
                                  opacity: accentBlockOpacity }} />
      </div>

      {/* Point text */}
      <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.bold,
                    fontSize: TYPE.sizes.title, lineHeight: TYPE.lineHeightTight,
                    color: textColor, opacity: textOpacity,
                    transform: `translateY(${textY}px)`,
                    maxWidth: 880,
                    letterSpacing: TYPE.trackingTight }}>
        {currentPoint}
      </div>

      {/* Progress dots — scale-pop on activation */}
      <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
        {Array.from({ length: totalPoints }, (_, i) => {
          const isActive = i === pointIndex;
          const isDone = i < pointIndex;
          const popScale = isActive
            ? 1 + 0.08 * Math.sin((frame % 60) * 0.10)
            : 1;
          return (
            <div key={i} style={{
              width: isActive ? 36 : 12,
              height: 6,
              borderRadius: 3,
              backgroundColor: isActive || isDone ? dotColor : (isLight ? palette.ink : palette.accent),
              opacity: isActive ? 1 : isDone ? 0.7 : 0.28,
              transform: `scaleX(${popScale})`,
              transition: "width 200ms ease, background-color 200ms ease",
            }} />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Director wrapper ──────────────────────────────────────────────────────
export const NumberedPointsTemplate: React.FC<NumberedPointsTemplateProps> = (props) => {
  const n = Math.min(3, Math.max(1, props.points.length));
  const scenes = buildDirectorSpec(n);
  let cursor = 0;
  let pointIdx = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: getPalette(props.topic).primary }}>
      {scenes.map((scene, i) => {
        const from = cursor;
        cursor += scene.durationFrames;

        let el: React.ReactElement;
        if (scene.id === "hook") {
          el = <HookScene {...props} />;
        } else if (scene.id === "cta") {
          el = <CtaScene topic={props.topic} sceneIndex={i} />;
        } else {
          const pi = pointIdx++;
          el = <PointScene {...props} pointIndex={pi} totalPoints={n} sceneIndex={i} />;
        }
        return (
          <Sequence key={scene.id} from={from} durationInFrames={scene.durationFrames}>
            {el}
          </Sequence>
        );
      })}
      <Captions topic={props.topic} words={props.captions} />
    </AbsoluteFill>
  );
};
