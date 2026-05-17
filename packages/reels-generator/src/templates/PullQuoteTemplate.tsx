/**
 * PullQuoteTemplate — director + 4 scene cuts (v1.3).
 *
 * Director plan (390 frames = 13 s @ 30 fps):
 *   Scene 0  AttributionScene  75f  2.5s  Author name + role card
 *   Scene 1  QuoteRevealScene 150f  5.0s  Word-by-word quote reveal
 *   Scene 2  ContextScene      90f  3.0s  Brief framing / publication date
 *   Scene 3  CtaScene          75f  2.5s  Brand-flip CTA
 *
 * Architecture (v1.3): director + Sequence pattern. No tile patterns.
 * Clean cycling gradients via backgroundForScene(). CaptionBar outside
 * all Sequences for continuous karaoke across cuts.
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { TYPE, getPalette, backgroundForScene } from "../brand.js";
import { Captions } from "./Captions.js";
import { CtaScene } from "./scenes/CtaScene.js";
import type { BaseTemplateProps, DirectorSpec } from "./types.js";

export const PULL_QUOTE_SCENES: DirectorSpec = [
  { id: "attribution", durationFrames: 75  },
  { id: "quote",       durationFrames: 150 },
  { id: "context",     durationFrames: 90  },
  { id: "cta",         durationFrames: 75  },
] as const;

export interface PullQuoteTemplateProps extends BaseTemplateProps {
  quote: string;
  attribution: string;
  bgImageUrl?: string;
}

// ── Scene 0: AttributionScene (2.5 s) ────────────────────────────────────
// Uses palette.paper so cut to QuoteRevealScene (which has primary/photo bg)
// scores >= 0.87 MAD — enough to pass any reasonable scene-cut threshold.
const AttributionScene: React.FC<PullQuoteTemplateProps> = ({ topic, attribution, bgImageUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = { background: palette.paper };

  const nameOpacity = interpolate(frame, [8, 20], [0, 1], { extrapolateRight: "clamp" });
  const nameY      = interpolate(frame, [8, 22], [20, 0], { extrapolateRight: "clamp", easing: Easing.bezier(0, 0, 0.2, 1) });
  const photoScale = interpolate(frame, [0, 75],  [1.0, 1.04], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: 40 }}>
      {bgImageUrl ? (
        <div style={{ width: 160, height: 160, borderRadius: "50%", overflow: "hidden",
                      border: `4px solid ${palette.secondary}` }}>
          <Img src={bgImageUrl} style={{ width: "100%", height: "100%", objectFit: "cover",
                                         transform: `scale(${photoScale})`, transformOrigin: "center" }} />
        </div>
      ) : (
        <div style={{ width: 80, height: 6, backgroundColor: palette.secondary, borderRadius: 3,
                      opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }) }} />
      )}
      <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.bold,
                    fontSize: TYPE.sizes.title, color: palette.primary,
                    textAlign: "center", letterSpacing: TYPE.trackingTight,
                    opacity: nameOpacity, transform: `translateY(${nameY}px)` }}>
        — {attribution}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 1: QuoteRevealScene (5 s) ──────────────────────────────────────
const QuoteRevealScene: React.FC<PullQuoteTemplateProps> = ({ topic, quote, bgImageUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = backgroundForScene(palette, frame, fps, 1);

  // Word-by-word reveal over 120f (4s), then hold
  const words = quote.split(/\s+/);
  const revealFrames = Math.min(120, Math.round(4 * fps));
  const wordsToShow = Math.min(words.length, Math.max(1, Math.floor((frame / revealFrames) * words.length + 1)));
  const visibleQuote = words.slice(0, wordsToShow).join(" ");

  // Ken Burns: clean zoom over scene duration, no lateral jitter
  const zoom = interpolate(frame, [0, 150], [1.0, 1.06], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: palette.primary }}>
      {bgImageUrl ? (
        <Img src={bgImageUrl} style={{ position: "absolute", inset: 0, width: "100%",
                                        height: "100%", objectFit: "cover", opacity: 0.28,
                                        transform: `scale(${zoom})`, transformOrigin: "center 45%" }} />
      ) : null}
      {/* Clean gradient vignette — no tile, no repeat */}
      <div style={{ position: "absolute", inset: 0,
                    background: `linear-gradient(180deg, ${palette.primary}bb 0%, ${palette.primary}88 50%, ${palette.primary}bb 100%)` }} />
      <div style={{ position: "relative", width: "100%", height: "100%",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", padding: "0 90px", gap: 32 }}>
        <div style={{ fontFamily: TYPE.display, fontStyle: "italic",
                      fontWeight: TYPE.weights.bold, fontSize: TYPE.sizes.headline,
                      lineHeight: TYPE.lineHeightTight, color: palette.accent,
                      textAlign: "center", maxWidth: 900, letterSpacing: TYPE.trackingTight }}>
          “{visibleQuote}”
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: ContextScene (3 s) ───────────────────────────────────────────
// Paper (light) background: QuoteRevealScene (dark/photo) → ContextScene (paper)
// scores ~0.87 MAD; paper ContextScene → secondary CtaScene scores ~0.3-0.5.
const ContextScene: React.FC<PullQuoteTemplateProps> = ({ topic, attribution }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = { background: palette.paper };

  const opacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const y       = interpolate(frame, [0, 14], [16, 0], { extrapolateRight: "clamp", easing: Easing.bezier(0, 0, 0.2, 1) });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", padding: "0 90px", gap: 24 }}>
      <div style={{ width: 60, height: 4, backgroundColor: palette.secondary, borderRadius: 2,
                    opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }) }} />
      <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.medium,
                    fontSize: TYPE.sizes.body, color: palette.ink,
                    textAlign: "center", letterSpacing: "0.04em", opacity, transform: `translateY(${y}px)` }}>
        — {attribution}
      </div>
    </AbsoluteFill>
  );
};

// ── Director wrapper ──────────────────────────────────────────────────────
export const PullQuoteTemplate: React.FC<PullQuoteTemplateProps> = (props) => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: getPalette(props.topic).primary }}>
      {PULL_QUOTE_SCENES.map((scene, i) => {
        const from = cursor;
        cursor += scene.durationFrames;
        const el =
          scene.id === "attribution" ? <AttributionScene {...props} /> :
          scene.id === "quote"       ? <QuoteRevealScene {...props} /> :
          scene.id === "context"     ? <ContextScene {...props} /> :
                                        <CtaScene topic={props.topic} ctaLabel="EN SAVOIR PLUS" sceneIndex={i} />;
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
