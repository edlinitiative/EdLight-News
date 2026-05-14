/**
 * PullQuoteTemplate — for histoire, news commentary, scholarship testimonials.
 *
 *   ┌───────────────────────────────┐
 *   │   [archival photo, 35% opacity]│
 *   │                               │
 *   │   "[quote, word-by-word        │
 *   │    reveal, italic display]"   │
 *   │                               │
 *   │   — attribution               │
 *   │   [karaoke captions]          │
 *   └───────────────────────────────┘
 *
 * Quote reveals word-by-word over ~5s, then holds for the rest of the
 * voiceover. Background photo darkens to make text legible.
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

export interface PullQuoteTemplateProps extends BaseTemplateProps {
  quote: string;
  /** Person/source attribution shown beneath the quote. */
  attribution: string;
  /** Optional background image URL. Falls back to gradient if missing. */
  bgImageUrl?: string;
}

export const PullQuoteTemplate: React.FC<PullQuoteTemplateProps> = ({
  topic,
  quote,
  attribution,
  bgImageUrl,
  captions,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);

  // Word-by-word reveal across the first 5 seconds (150 frames @ 30fps).
  const words = quote.split(/\s+/);
  const revealDurFrames = 5 * fps;
  const wordsToShow = Math.min(
    words.length,
    Math.max(0, Math.floor((frame / revealDurFrames) * words.length)),
  );
  const visibleQuote = words.slice(0, wordsToShow).join(" ");

  const attrOpacity = interpolate(
    frame,
    [revealDurFrames + 4, revealDurFrames + 18],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: palette.primary }}>
      {bgImageUrl ? (
        <Img
          src={bgImageUrl}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.35,
          }}
        />
      ) : null}
      {/* Vignette overlay to keep text legible regardless of photo brightness. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${palette.primary}cc 0%, ${palette.primary}99 50%, ${palette.primary}cc 100%)`,
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 90px",
          gap: 50,
        }}
      >
        <div
          style={{
            fontFamily: TYPE.display,
            fontStyle: "italic",
            fontWeight: TYPE.weights.bold,
            fontSize: TYPE.sizes.headline,
            lineHeight: TYPE.lineHeightTight,
            color: palette.accent,
            textAlign: "center",
            maxWidth: 900,
            letterSpacing: TYPE.trackingTight,
          }}
        >
          “{visibleQuote}”
        </div>
        <div
          style={{
            fontFamily: TYPE.body,
            fontWeight: TYPE.weights.medium,
            fontSize: TYPE.sizes.body,
            color: palette.secondary,
            opacity: attrOpacity,
            letterSpacing: "0.04em",
          }}
        >
          — {attribution}
        </div>
      </div>
      <Captions topic={topic} words={captions} />
    </AbsoluteFill>
  );
};
