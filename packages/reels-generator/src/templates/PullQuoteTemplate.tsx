/**
 * PullQuoteTemplate — director + 4 scene cuts (v1.4).
 *
 * Director plan (390 frames = 13 s @ 30 fps):
 *   Scene 0  AttributionScene  75f  2.5s  Author name + role card
 *   Scene 1  QuoteRevealScene 150f  5.0s  Word-by-word quote reveal
 *   Scene 2  ContextScene      90f  3.0s  Brief framing / publication date
 *   Scene 3  CtaScene          75f  2.5s  Brand-flip CTA
 *
 * v1.4 upgrades:
 *   - enterFromCut helpers — no empty cut frames
 *   - paperBackgroundForScene / backgroundForScene depth (radial highlight + vignette)
 *   - Massive quotation mark glyph as decorative element behind the quote
 *   - Quote reveal uses settle-from-overshoot rather than pure fade
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
const AttributionScene: React.FC<PullQuoteTemplateProps> = ({ topic, attribution, bgImageUrl }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = paperBackgroundForScene(palette, frame, fps, 0);

  const portraitScale = enterFromCutScale(frame, 10, 1.06);
  const portraitOpacity = enterFromCutOpacity(frame, 6, 0.55);
  const nameOpacity = interpolate(frame, [8, 20], [0, 1], {
    extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
  });
  const nameY = interpolate(frame, [8, 22], [16, 0], {
    extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
  });
  const photoKenBurns = interpolate(frame, [0, 75], [1.0, 1.05], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: 44 }}>
      {bgImageUrl ? (
        <div style={{ width: 200, height: 200, borderRadius: "50%", overflow: "hidden",
                      border: `5px solid ${palette.secondary}`,
                      boxShadow: "0 12px 30px rgba(0,0,0,0.20)",
                      transform: `scale(${portraitScale})`,
                      opacity: portraitOpacity }}>
          <Img src={bgImageUrl} style={{ width: "100%", height: "100%", objectFit: "cover",
                                         transform: `scale(${photoKenBurns})` }} />
        </div>
      ) : (
        <div style={{ position: "relative", display: "flex", alignItems: "center",
                      justifyContent: "center", transform: `scale(${portraitScale})`,
                      opacity: portraitOpacity }}>
          <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.black,
                        fontSize: 320, color: palette.secondary, opacity: 0.30,
                        lineHeight: 0.8 }}>
            "
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.semibold,
                      fontSize: TYPE.sizes.caption, color: palette.primary,
                      letterSpacing: TYPE.trackingLoose, textTransform: "uppercase",
                      opacity: nameOpacity * 0.75 }}>
          SELON
        </div>
        <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.bold,
                      fontSize: TYPE.sizes.title, color: palette.primary,
                      textAlign: "center", letterSpacing: TYPE.trackingTight,
                      opacity: nameOpacity, transform: `translateY(${nameY}px)`,
                      lineHeight: TYPE.lineHeightTight, maxWidth: 880 }}>
          {attribution}
        </div>
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

  // Word-by-word reveal over 120f (4s), then hold.
  const words = quote.split(/\s+/);
  const revealFrames = Math.min(120, Math.round(4 * fps));
  const wordsToShow = Math.min(words.length, Math.max(1, Math.floor((frame / revealFrames) * words.length + 1)));
  const visibleQuote = words.slice(0, wordsToShow).join(" ");

  const zoom = interpolate(frame, [0, 150], [1.0, 1.06], { extrapolateRight: "clamp" });
  // Ensure the scene is visible at frame 0.
  const wholeScale = enterFromCutScale(frame, 8, 1.04);
  const wholeOpacity = enterFromCutOpacity(frame, 5, 0.55);

  return (
    <AbsoluteFill style={{ ...bg, opacity: wholeOpacity, transform: `scale(${wholeScale})` }}>
      {bgImageUrl ? (
        <Img src={bgImageUrl} style={{ position: "absolute", inset: 0, width: "100%",
                                        height: "100%", objectFit: "cover", opacity: 0.26,
                                        transform: `scale(${zoom})`, transformOrigin: "center 45%" }} />
      ) : null}
      {/* Decorative quotation mark glyph anchored top-left */}
      <div aria-hidden style={{ position: "absolute", left: 50, top: 220,
                                fontFamily: TYPE.display, fontWeight: TYPE.weights.black,
                                fontSize: 460, color: palette.secondary,
                                opacity: 0.18, lineHeight: 0.7,
                                pointerEvents: "none" }}>
        “
      </div>
      <div style={{ position: "relative", width: "100%", height: "100%",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center", padding: "0 90px", gap: 32 }}>
        <div style={{ fontFamily: TYPE.display, fontStyle: "italic",
                      fontWeight: TYPE.weights.bold, fontSize: TYPE.sizes.headline,
                      lineHeight: TYPE.lineHeightTight, color: palette.accent,
                      textAlign: "center", maxWidth: 920, letterSpacing: TYPE.trackingTight }}>
          {visibleQuote}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: ContextScene (3 s) ───────────────────────────────────────────
const ContextScene: React.FC<PullQuoteTemplateProps> = ({ topic, attribution }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = paperBackgroundForScene(palette, frame, fps, 2);

  const opacity = enterFromCutOpacity(frame, 6, 0.55);
  const y = enterFromCutTranslateY(frame, 7, 12);
  const barW = interpolate(frame, [4, 18], [40, 92], {
    extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
  });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            padding: "0 90px", gap: 28 }}>
      <div style={{ width: barW, height: 6, backgroundColor: palette.secondary, borderRadius: 3 }} />
      <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.semibold,
                    fontSize: TYPE.sizes.caption, color: palette.primary,
                    letterSpacing: TYPE.trackingLoose, textTransform: "uppercase",
                    opacity: opacity * 0.7 }}>
        EN BREF
      </div>
      <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.bold,
                    fontSize: TYPE.sizes.title, color: palette.ink,
                    textAlign: "center", letterSpacing: TYPE.trackingTight,
                    opacity, transform: `translateY(${y}px)`,
                    lineHeight: TYPE.lineHeightTight, maxWidth: 880 }}>
        {attribution}
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
