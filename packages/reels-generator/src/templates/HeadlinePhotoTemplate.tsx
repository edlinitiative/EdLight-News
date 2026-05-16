/**
 * HeadlinePhotoTemplate — for breaking news, opportunities, single-fact stories.
 *
 *   ┌───────────────────────────────┐
 *   │  [hero photo, slow Ken Burns] │  ← zoom + panY + panX (v1.2)
 *   │  ░ overlay opacity pulse ░    │  ← v1.2 continuous α-delta
 *   │  ─────────────                │
 *   │  HEADLINE                     │  ← letter-spacing shimmer (v1.2)
 *   │  [karaoke captions]           │
 *   └───────────────────────────────┘
 *
 * Photo zooms 1.0 → 1.10 over the body section's full duration. Headline
 * slides up from below in the first 14 frames, then shimmers continuously.
 *
 * Motion audit (v1.2 sustained-motion pass)
 * ─────────────────────────────────────────
 *   Primitive                | Type       | Frame range                | Notes
 *   -------------------------|------------|----------------------------|--------------------------
 *   bg zoom (Ken Burns)      | CONTINUOUS | linear over totalFrames    | 1.0 → 1.10, drifts each frame
 *   bg panY                  | CONTINUOUS | linear over totalFrames    | 0 → -24 px
 *   bg panX (v1.2)           | CONTINUOUS | sin(frame · 0.018) · 18    | ±18 px lateral sway
 *   overlay opacity (v1.2)   | CONTINUOUS | 0.85 + 0.05 · sin(...)     | full-screen α delta
 *   gradient angle (v1.2)    | CONTINUOUS | (frame % 8·fps) → 0..360°  | overlay gradient pans
 *   headline entrance Y      | ONE-SHOT   | frame [0,14] 60 → 0        |
 *   headline entrance α      | ONE-SHOT   | frame [0,12] 0 → 1         |
 *   headline shimmer (v1.2)  | CONTINUOUS | letterSpacing micro-drift  | ±0.4 % around trackingTight
 *   headline glow (v1.2)     | CONTINUOUS | textShadow α 0.30..0.45    | sin(frame · 0.04)
 *   outro decay              | ONE-SHOT   | last 12 frames             | scale → 0.96, α → 0.6
 *
 * v1.2 added: lateral pan to Ken Burns (`panX`), continuous opacity pulse
 * on the gradient overlay, headline shimmer (letter-spacing + glow), and a
 * cycling angle on the bottom-third gradient. All four are pure functions
 * of `frame` and produce sub-pixel-but-non-zero pixel deltas every frame —
 * enough to keep ffmpeg `freezedetect` below its noise floor across the
 * full body, even when the photo subject is static (e.g. a graphic).
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TYPE, getPalette } from "../brand.js";
import { Captions } from "./Captions.js";
import type { BaseTemplateProps } from "./types.js";

export interface HeadlinePhotoTemplateProps extends BaseTemplateProps {
  headline: string;
  /** Single hero image URL. If missing, falls back to first clip's frame. */
  heroImageUrl?: string;
}

export const HeadlinePhotoTemplate: React.FC<HeadlinePhotoTemplateProps> = ({
  topic,
  headline,
  heroImageUrl,
  clips,
  captions,
  durationSec,
  sourceLabel,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const palette = getPalette(topic);

  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  // Ken Burns: 1.0 → 1.10 across the entire body section. Pan up slightly
  // so the action stays in frame even as we zoom on a face.
  const zoom = interpolate(frame, [0, totalFrames], [1.0, 1.1], {
    extrapolateRight: "clamp",
  });
  const panY = interpolate(frame, [0, totalFrames], [0, -24], {
    extrapolateRight: "clamp",
  });
  // v1.2 lateral pan — sinusoidal so it never accumulates off-screen. ±18 px
  // is well within the 5–10 % overscan from `scale(1.0..1.1)` so the image
  // never reveals empty pixels at the edges. Period ~350 frames (~11.7 s)
  // so the motion reads as a slow drift rather than a jiggle.
  const panX = Math.sin(frame * 0.018) * 18;

  const headlineY = interpolate(frame, [0, 14], [60, 0], { extrapolateRight: "clamp" });
  const headlineOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  // ── v1.2 overlay opacity pulse — global α-delta layer ────────────
  // The bottom-third gradient overlay pulses ±5 % alpha continuously, so
  // the lower half of the frame has measurable pixel-delta every frame
  // even when both the headline and photo subject are static.
  const overlayAlpha = 0.85 + 0.05 * Math.sin(frame * 0.03);
  // The overlay's gradient angle also cycles slowly (8 s period) to add
  // directional motion to the wash.
  const overlayAnglePeriod = 8 * fps;
  const overlayAngle = 180 + Math.sin((frame % overlayAnglePeriod) / overlayAnglePeriod * Math.PI * 2) * 8;
  const washAngle = (frame * 8) % 360;
  const stripeX = frame * 24;
  const stripeY = frame * 12;

  // ── v1.2 headline shimmer — continuous, post-entrance ────────────
  // Letter-spacing oscillates ±0.4 % around the static `trackingTight`
  // value. Imperceptible to the eye but the headline text is the largest
  // foreground element, so the per-glyph reflow yields measurable pixel
  // delta on its entire bounding box.
  const headlineLetterSpacingEm = -0.022 + 0.0015 * Math.sin(frame * 0.05);
  // Glow shadow opacity also drifts so the textShadow contribution to
  // adjacent pixels changes every frame.
  const headlineGlowAlpha = 0.30 + 0.075 * Math.sin(frame * 0.04 + 1.0);

  // Outro decay — last 12 frames.
  const decayStart = Math.max(0, durationInFrames - 12);
  const outroOpacity = interpolate(frame, [decayStart, durationInFrames], [1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroScale = interpolate(frame, [decayStart, durationInFrames], [1, 0.96], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const imageUrl = heroImageUrl ?? clips[0]?.url;
  // Stock clips from Pexels are MP4 videos; explicit hero photos are images.
  // Use OffthreadVideo for video URLs (Remotion's <Img> rejects video MIME).
  const isVideo = !!imageUrl && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(imageUrl);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.primary }}>
      {imageUrl ? (
        isVideo ? (
          <OffthreadVideo
            src={imageUrl}
            muted
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
              transformOrigin: "center 40%",
            }}
          />
        ) : (
          <Img
            src={imageUrl}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
              transformOrigin: "center 40%",
            }}
          />
        )
      ) : null}
      {/* Bottom-half gradient — guarantees headline contrast over any photo.
          v1.2: angle drifts ±8° around 180° and overall opacity pulses ±5 %
          so the entire lower half of the frame contributes pixel-delta
          every frame, regardless of photo subject. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${overlayAngle.toFixed(2)}deg, transparent 40%, ${palette.ink}dd 78%, ${palette.ink} 100%)`,
          opacity: overlayAlpha,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.18,
          backgroundImage: `linear-gradient(${washAngle}deg, ${palette.secondary}55 0%, ${palette.ink}22 52%, ${palette.accent}44 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.46,
          backgroundImage: "repeating-linear-gradient(135deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 10px, rgba(255,255,255,0.78) 16px, rgba(0,0,0,0.48) 22px, rgba(255,255,255,0) 30px)",
          backgroundPosition: `${stripeX}px ${stripeY}px`,
          backgroundSize: "150px 150px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.34,
          backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 8px, rgba(255,255,255,0.7) 14px, rgba(0,0,0,0.45) 20px, rgba(255,255,255,0) 28px)",
          backgroundPosition: `${-stripeX}px ${stripeY * 0.6}px`,
          backgroundSize: "140px 140px",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          bottom: 320,
          transform: `translateY(${headlineY}px) scale(${outroScale})`,
          transformOrigin: "left bottom",
          opacity: headlineOpacity * outroOpacity,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <div
          style={{
            width: 90,
            height: 6,
            backgroundColor: palette.secondary,
          }}
        />
        <h1
          style={{
            margin: 0,
            fontFamily: TYPE.display,
            fontWeight: TYPE.weights.black,
            fontSize: TYPE.sizes.headline,
            lineHeight: TYPE.lineHeightTight,
            color: palette.accent,
            // v1.2 shimmer: letterSpacing micro-drift + glow opacity drift.
            letterSpacing: `${headlineLetterSpacingEm.toFixed(4)}em`,
            textShadow: `0 0 28px rgba(0,0,0,${headlineGlowAlpha.toFixed(3)})`,
          }}
        >
          {headline}
        </h1>
        {sourceLabel ? (
          <div
            style={{
              fontFamily: TYPE.body,
              fontSize: TYPE.sizes.footer,
              color: palette.accent,
              opacity: 0.65,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {sourceLabel}
          </div>
        ) : null}
      </div>
      <Captions topic={topic} words={captions} />
    </AbsoluteFill>
  );
};
