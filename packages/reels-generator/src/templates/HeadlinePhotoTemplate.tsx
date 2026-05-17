/**
 * HeadlinePhotoTemplate — director + 4 scene cuts (v1.4).
 *
 * Director plan (390 frames = 13 s @ 30 fps):
 *   Scene 0  PhotoEstablishScene 120f  4s  Full-bleed photo (Ken Burns) + soft overlay
 *   Scene 1  HeadlineScene       120f  4s  Headline overlay on zoomed photo
 *   Scene 2  ContextScene         90f  3s  Solid bg, key supporting fact
 *   Scene 3  CtaScene             60f  2s  Brand-flip CTA
 *
 * v1.4 upgrades:
 *   - enterFromCut helpers — no empty cut frames
 *   - Photo treatment: soft top-down gradient + bottom darkening for premium feel
 *   - Headline reveal lands from overshoot scale, not pure fade
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  MOTION,
  TYPE,
  enterFromCutOpacity,
  enterFromCutScale,
  enterFromCutTranslateY,
  getPalette,
  paperBackgroundForScene,
} from "../brand.js";
import { Captions } from "./Captions.js";
import { CtaScene } from "./scenes/CtaScene.js";
import type { BaseTemplateProps, DirectorSpec } from "./types.js";

export const HEADLINE_PHOTO_SCENES: DirectorSpec = [
  { id: "establish", durationFrames: 120 },
  { id: "headline",  durationFrames: 120 },
  { id: "context",   durationFrames: 90  },
  { id: "cta",       durationFrames: 60  },
] as const;

export interface HeadlinePhotoTemplateProps extends BaseTemplateProps {
  headline: string;
  heroImageUrl?: string;
}

// ── Scene 0: PhotoEstablishScene (4 s) ────────────────────────────────────
const PhotoEstablishScene: React.FC<HeadlinePhotoTemplateProps> = ({ topic, heroImageUrl, clips, headline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = paperBackgroundForScene(palette, frame, fps, 0);

  const zoom = interpolate(frame, [0, 120], [1.0, 1.05], { extrapolateRight: "clamp" });
  const panY = interpolate(frame, [0, 120], [0, -10], { extrapolateRight: "clamp" });
  const textOpacity = enterFromCutOpacity(frame, 6, 0.55);
  const textY = enterFromCutTranslateY(frame, 7, 12);
  const textScale = enterFromCutScale(frame, 8, 1.04);
  const eyebrowOpacity = interpolate(frame, [6, 18], [0, 0.78], { extrapolateRight: "clamp" });
  const accentH = interpolate(frame, [0, 16], [20, 84], {
    extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
  });

  const imageUrl = heroImageUrl ?? clips[0]?.url;
  const isVideo = !!imageUrl && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(imageUrl);

  return (
    <AbsoluteFill style={bg}>
      {imageUrl ? (
        isVideo ? (
          <OffthreadVideo src={imageUrl} muted
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                     objectFit: "cover", opacity: 0.24,
                     transform: `scale(${zoom}) translateY(${panY}px)`,
                     transformOrigin: "center 40%" }} />
        ) : (
          <Img src={imageUrl}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                     objectFit: "cover", opacity: 0.24,
                     transform: `scale(${zoom}) translateY(${panY}px)`,
                     transformOrigin: "center 40%" }} />
        )
      ) : null}
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 480,
                    opacity: textOpacity, display: "flex", flexDirection: "column", gap: 22,
                    transform: `translateY(${textY}px) scale(${textScale})`,
                    transformOrigin: "left center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: accentH, height: 6, backgroundColor: palette.secondary, borderRadius: 3 }} />
          <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.semibold,
                        fontSize: TYPE.sizes.caption, color: palette.primary,
                        letterSpacing: TYPE.trackingLoose, textTransform: "uppercase",
                        opacity: eyebrowOpacity }}>
            À LA UNE
          </div>
        </div>
        <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.black,
                      fontSize: TYPE.sizes.headline, lineHeight: TYPE.lineHeightTight,
                      color: palette.primary, letterSpacing: TYPE.trackingTight }}>
          {headline}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 1: HeadlineScene (4 s) ──────────────────────────────────────────
const HeadlineScene: React.FC<HeadlinePhotoTemplateProps> = ({ topic, headline, heroImageUrl, clips, sourceLabel }) => {
  const frame = useCurrentFrame();
  const palette = getPalette(topic);

  const zoom = interpolate(frame, [0, 120], [1.06, 1.14], { extrapolateRight: "clamp" });
  const panY = interpolate(frame, [0, 120], [-18, -36], { extrapolateRight: "clamp" });

  // Snappy entrance: visible at frame 0.
  const headlineOpacity = enterFromCutOpacity(frame, 6, 0.55);
  const headlineY = enterFromCutTranslateY(frame, 8, 16);
  const headlineScale = enterFromCutScale(frame, 8, 1.04);
  const overlayAlpha = 0.84 + 0.04 * Math.sin(frame * 0.03);

  const imageUrl = heroImageUrl ?? clips[0]?.url;
  const isVideo = !!imageUrl && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(imageUrl);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.primary }}>
      {imageUrl ? (
        isVideo ? (
          <OffthreadVideo src={imageUrl} muted
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                     objectFit: "cover", transform: `scale(${zoom}) translateY(${panY}px)`,
                     transformOrigin: "center 40%" }} />
        ) : (
          <Img src={imageUrl}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                     objectFit: "cover", transform: `scale(${zoom}) translateY(${panY}px)`,
                     transformOrigin: "center 40%" }} />
        )
      ) : null}
      {/* Layered overlay: soft top fade + strong bottom darkening + edge vignette */}
      <div style={{ position: "absolute", inset: 0,
                    background: `linear-gradient(180deg, transparent 32%, ${palette.ink}dd 72%, ${palette.ink} 100%)`,
                    opacity: overlayAlpha }} />
      <div style={{ position: "absolute", inset: 0,
                    background: "radial-gradient(ellipse 95% 75% at 50% 50%, transparent 55%, rgba(0,0,0,0.30) 100%)" }} />
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 320,
                    transform: `translateY(${headlineY}px) scale(${headlineScale})`,
                    transformOrigin: "left center",
                    opacity: headlineOpacity, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ width: 92, height: 6, backgroundColor: palette.secondary, borderRadius: 3 }} />
        <h1 style={{ margin: 0, fontFamily: TYPE.display, fontWeight: TYPE.weights.black,
                     fontSize: TYPE.sizes.headline, lineHeight: TYPE.lineHeightTight,
                     color: palette.accent, letterSpacing: TYPE.trackingTight,
                     textShadow: "0 6px 26px rgba(0,0,0,0.40)" }}>
          {headline}
        </h1>
        {sourceLabel ? (
          <div style={{ fontFamily: TYPE.body, fontSize: TYPE.sizes.footer,
                        color: palette.accent, opacity: 0.70,
                        letterSpacing: TYPE.trackingLoose, textTransform: "uppercase" }}>
            {sourceLabel}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: ContextScene (3 s) ───────────────────────────────────────────
const ContextScene: React.FC<HeadlinePhotoTemplateProps> = ({ topic, headline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = paperBackgroundForScene(palette, frame, fps, 2);

  const opacity = enterFromCutOpacity(frame, 6, 0.55);
  const y = enterFromCutTranslateY(frame, 7, 14);
  const barW = interpolate(frame, [4, 18], [40, 92], {
    extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
  });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "flex-start", justifyContent: "center",
                            padding: "0 80px", gap: 28 }}>
      <div style={{ width: barW, height: 6, backgroundColor: palette.secondary, borderRadius: 3 }} />
      <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.semibold,
                    fontSize: TYPE.sizes.caption, color: palette.primary,
                    letterSpacing: TYPE.trackingLoose, textTransform: "uppercase",
                    opacity: opacity * 0.7 }}>
        EN BREF
      </div>
      <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.bold,
                    fontSize: TYPE.sizes.title, lineHeight: TYPE.lineHeightTight,
                    color: palette.ink, letterSpacing: TYPE.trackingTight,
                    opacity, transform: `translateY(${y}px)`,
                    maxWidth: 880 }}>
        {headline}
      </div>
    </AbsoluteFill>
  );
};

// ── Director wrapper ──────────────────────────────────────────────────────
export const HeadlinePhotoTemplate: React.FC<HeadlinePhotoTemplateProps> = (props) => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: getPalette(props.topic).primary }}>
      {HEADLINE_PHOTO_SCENES.map((scene, i) => {
        const from = cursor;
        cursor += scene.durationFrames;
        const el =
          scene.id === "establish" ? <PhotoEstablishScene {...props} /> :
          scene.id === "headline"  ? <HeadlineScene {...props} /> :
          scene.id === "context"   ? <ContextScene {...props} /> :
                                     <CtaScene topic={props.topic} sceneIndex={i} />;
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
