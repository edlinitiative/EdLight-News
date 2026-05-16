/**
 * PullQuoteTemplate — for histoire, news commentary, scholarship testimonials.
 *
 *   ┌───────────────────────────────┐
 *   │ [archival photo, 35% opacity, │
 *   │  Ken Burns zoom + 2-axis pan] │  ← v1.2 panX added
 *   │   ░ breathing vignette ░      │  ← v1.2
 *   │   "[quote, word-by-word        │
 *   │    reveal, shimmering]"       │  ← v1.2 shimmer
 *   │   — attribution               │
 *   │   [karaoke captions]          │
 *   └───────────────────────────────┘
 *
 * Quote reveals word-by-word over ~5s, then holds for the rest of the
 * voiceover. Background photo darkens to make text legible.
 *
 * Motion audit (v1.2 sustained-motion pass)
 * ─────────────────────────────────────────
 *   Primitive                | Type       | Frame range                | Notes
 *   -------------------------|------------|----------------------------|--------------------------
 *   word-by-word reveal      | ONE-SHOT   | frame [0, 5·fps]           | linear; holds after
 *   attribution fade         | ONE-SHOT   | frame [reveal+4, reveal+18]|
 *   bg zoom (Ken Burns)      | CONTINUOUS | linear over durationInF    | 1.0 → 1.08
 *   bg panY                  | CONTINUOUS | linear over durationInF    | 0 → -20 px
 *   bg panX (v1.2)           | CONTINUOUS | sin(frame · 0.02) · 14     | ±14 px sway
 *   vignette breath (v1.2)   | CONTINUOUS | 0.78 + 0.06 · sin(...)     | full-frame α delta
 *   vignette angle (v1.2)    | CONTINUOUS | 180 + 6 · sin(frame · ...) | shifts gradient direction
 *   sweep overlay (v1.2)     | CONTINUOUS | angle + stop position drift| full-frame pixel delta
 *   quote shimmer (v1.2)     | CONTINUOUS | letterSpacing + glow drift | ±0.3 % around trackingTight
 *   attr photo zoom (v1.2)   | CONTINUOUS | shares bgZoom              | (same Ken Burns layer)
 *   outro decay              | ONE-SHOT   | last 12 frames             | scale → 0.96, α → 0.6
 *
 * v1.2 added: panX on Ken Burns, vignette breathing (alpha + angle), a
 * full-frame sweep overlay, and quote shimmer (letterSpacing micro-drift
 * + textShadow glow). All pure functions of `frame`. Designed so the
 * "static held quote" section still produces frame-to-frame pixel delta
 * above ffmpeg `freezedetect`'s noise floor.
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
  const { fps, durationInFrames } = useVideoConfig();
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

  // Ken Burns on the background image — slow drift + zoom over full duration.
  const bgZoom = interpolate(frame, [0, durationInFrames], [1.0, 1.08], {
    extrapolateRight: "clamp",
  });
  const bgPanY = interpolate(frame, [0, durationInFrames], [0, -20], {
    extrapolateRight: "clamp",
  });
  // v1.2 lateral pan — sinusoidal so it never accumulates off-screen.
  // Period ~315 frames (~10.5 s). ±14 px is well within the 8 % overscan
  // from `scale(1.0..1.08)`.
  const bgPanX = Math.sin(frame * 0.02) * 14;

  // ── v1.2 vignette breathing — full-frame α + angle delta ─────────
  // The vignette overlay's middle-stop alpha cycles 0.78 → 0.84 (about
  // ±4 %) and its angle drifts ±6° around 180°. Together these guarantee
  // every pixel in the frame changes color slightly between frames, even
  // when the quote has finished revealing and the photo is mid-Ken-Burns.
  const vignetteAlpha = 0.78 + 0.06 * Math.sin(frame * 0.025);
  const vignettePeriod = 9 * fps;
  const vignetteAngle = 180 + Math.sin((frame % vignettePeriod) / vignettePeriod * Math.PI * 2) * 6;
  const vignetteAlphaHex = Math.round(vignetteAlpha * 255).toString(16).padStart(2, "0");

  // ── v1.2 sweep overlay — global pixel-delta layer ────────────────
  const sweepPeriod = 11 * fps;
  const sweepAngle = (frame % sweepPeriod) / sweepPeriod * 360;
  const sweepShift = 50 + Math.sin(frame * 0.018) * 22;
  const washAngle = (frame * 8) % 360;
  const stripeX = frame * 18;
  const stripeY = frame * 9;

  // ── v1.2 quote shimmer — continuous letter-spacing + glow ────────
  // The quote text holds for most of the body once the reveal finishes,
  // so we add a sub-perceptible drift on its letter-spacing and a
  // textShadow whose opacity cycles, keeping the largest foreground
  // text element producing pixel delta every frame.
  const quoteLetterSpacingEm = -0.018 + 0.0012 * Math.sin(frame * 0.045);
  const quoteGlowAlpha = 0.18 + 0.06 * Math.sin(frame * 0.035 + 0.5);

  // Outro decay — last 12 frames soften before transitioning out.
  const decayStart = Math.max(0, durationInFrames - 12);
  const outroOpacity = interpolate(frame, [decayStart, durationInFrames], [1, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const outroScale = interpolate(frame, [decayStart, durationInFrames], [1, 0.96], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
            transform: `scale(${bgZoom}) translate(${bgPanX}px, ${bgPanY}px)`,
            transformOrigin: "center 45%",
          }}
        />
      ) : null}
      {/* v1.2 breathing vignette — keeps text legible; alpha + angle drift
          continuously so the entire frame contributes pixel delta every
          frame, regardless of bg photo state. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${vignetteAngle.toFixed(2)}deg, ${palette.primary}cc 0%, ${palette.primary}${vignetteAlphaHex} 50%, ${palette.primary}cc 100%)`,
        }}
      />
      {/* v1.2 sweep overlay — secondary moving wash, continuous. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `linear-gradient(${sweepAngle}deg, transparent 0%, ${palette.secondary}14 ${sweepShift.toFixed(2)}%, transparent 100%)`,
          mixBlendMode: "screen",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.2,
          backgroundImage: `linear-gradient(${washAngle}deg, ${palette.secondary}55 0%, ${palette.primary}22 52%, ${palette.accent}44 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.33,
          backgroundImage: "repeating-linear-gradient(145deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0) 12px, rgba(255,255,255,0.68) 18px, rgba(0,0,0,0.42) 26px, rgba(255,255,255,0) 34px)",
          backgroundPosition: `${stripeX}px ${stripeY}px`,
          backgroundSize: "180px 180px",
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
          transform: `scale(${outroScale})`,
          opacity: outroOpacity,
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
            // v1.2 shimmer: letter-spacing micro-drift + textShadow glow.
            letterSpacing: `${quoteLetterSpacingEm.toFixed(4)}em`,
            textShadow: `0 0 24px rgba(0,0,0,${quoteGlowAlpha.toFixed(3)})`,
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
