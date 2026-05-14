/**
 * HeadlinePhotoTemplate — for breaking news, opportunities, single-fact stories.
 *
 *   ┌───────────────────────────────┐
 *   │  [hero photo, slow Ken Burns] │
 *   │                               │
 *   │  ─────────────                │
 *   │  HEADLINE                     │  ← bold display, bottom-third overlay
 *   │  [karaoke captions]           │
 *   └───────────────────────────────┘
 *
 * Photo zooms 1.0 → 1.10 over the body section's full duration. Headline
 * slides up from below in the first 14 frames.
 */

import React from "react";
import {
  AbsoluteFill,
  Img,
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
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);

  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const zoom = interpolate(frame, [0, totalFrames], [1.0, 1.1], {
    extrapolateRight: "clamp",
  });
  const headlineY = interpolate(frame, [0, 14], [60, 0], { extrapolateRight: "clamp" });
  const headlineOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });

  const imageUrl = heroImageUrl ?? clips[0]?.url;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.primary }}>
      {imageUrl ? (
        <Img
          src={imageUrl}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${zoom})`,
            transformOrigin: "center 40%",
          }}
        />
      ) : null}
      {/* Bottom-half gradient — guarantees headline contrast over any photo. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, transparent 40%, ${palette.ink}dd 78%, ${palette.ink} 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          bottom: 320,
          transform: `translateY(${headlineY}px)`,
          opacity: headlineOpacity,
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
            letterSpacing: TYPE.trackingTight,
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
