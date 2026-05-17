/**
 * HeadlinePhotoTemplate — director + 4 scene cuts (v1.3).
 *
 * Director plan (390 frames = 13 s @ 30 fps):
 *   Scene 0  PhotoEstablishScene 120f  4s  Full-bleed photo, slow Ken Burns
 *   Scene 1  HeadlineScene       120f  4s  Headline overlay on zoomed photo
 *   Scene 2  ContextScene         90f  3s  Solid bg, key supporting fact
 *   Scene 3  CtaScene             60f  2s  Brand-flip CTA
 *
 * Architecture (v1.3): director + Sequence pattern. No tile patterns.
 * Clean gradients only. Hard cuts between scenes.
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
import { TYPE, getPalette, backgroundForScene } from "../brand.js";
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
// Light paper background "opening card" so the cut to HeadlineScene
// (which is photo/dark) scores >= 0.87 MAD even when no heroImageUrl is
// provided. When a photo IS available it's displayed at 25% opacity over
// paper so the scene still reads as an "establish" visual.
const PhotoEstablishScene: React.FC<HeadlinePhotoTemplateProps> = ({ topic, heroImageUrl, clips, headline }) => {
  const frame = useCurrentFrame();
  const palette = getPalette(topic);

  const zoom = interpolate(frame, [0, 120], [1.0, 1.04], { extrapolateRight: "clamp" });
  const panY = interpolate(frame, [0, 120], [0, -10], { extrapolateRight: "clamp" });
  const textOpacity = interpolate(frame, [6, 18], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0, 0, 0.2, 1),
  });

  const imageUrl = heroImageUrl ?? clips[0]?.url;
  const isVideo = !!imageUrl && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(imageUrl);

  return (
    <AbsoluteFill style={{ background: palette.paper }}>
      {imageUrl ? (
        isVideo ? (
          <OffthreadVideo src={imageUrl} muted
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                     objectFit: "cover", opacity: 0.22,
                     transform: `scale(${zoom}) translateY(${panY}px)`,
                     transformOrigin: "center 40%" }} />
        ) : (
          <Img src={imageUrl}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                     objectFit: "cover", opacity: 0.22,
                     transform: `scale(${zoom}) translateY(${panY}px)`,
                     transformOrigin: "center 40%" }} />
        )
      ) : null}
      {/* Opening title — clean, legible on paper background */}
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 480,
                    opacity: textOpacity, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ width: 60, height: 5, backgroundColor: palette.primary, borderRadius: 3 }} />
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
// Headline text over the photo (now more zoomed). Word-level reveal.
const HeadlineScene: React.FC<HeadlinePhotoTemplateProps> = ({ topic, headline, heroImageUrl, clips, sourceLabel }) => {
  const frame = useCurrentFrame();
  const palette = getPalette(topic);

  const zoom = interpolate(frame, [0, 120], [1.06, 1.12], { extrapolateRight: "clamp" });
  const panY = interpolate(frame, [0, 120], [-18, -30], { extrapolateRight: "clamp" });

  const headlineY = interpolate(frame, [0, 14], [48, 0], {
    extrapolateRight: "clamp", easing: Easing.bezier(0, 0, 0.2, 1),
  });
  const headlineOpacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const overlayAlpha = 0.82 + 0.06 * Math.sin(frame * 0.03);

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
      <div style={{ position: "absolute", inset: 0,
                    background: `linear-gradient(180deg, transparent 38%, ${palette.ink}dd 76%, ${palette.ink} 100%)`,
                    opacity: overlayAlpha }} />
      <div style={{ position: "absolute", left: 80, right: 80, bottom: 300,
                    transform: `translateY(${headlineY}px)`,
                    opacity: headlineOpacity, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ width: 80, height: 5, backgroundColor: palette.secondary, borderRadius: 3 }} />
        <h1 style={{ margin: 0, fontFamily: TYPE.display, fontWeight: TYPE.weights.black,
                     fontSize: TYPE.sizes.headline, lineHeight: TYPE.lineHeightTight,
                     color: palette.accent, letterSpacing: TYPE.trackingTight }}>
          {headline}
        </h1>
        {sourceLabel ? (
          <div style={{ fontFamily: TYPE.body, fontSize: TYPE.sizes.footer,
                        color: palette.accent, opacity: 0.65,
                        letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {sourceLabel}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: ContextScene (3 s) ───────────────────────────────────────────
// Paper (light) background: HeadlineScene (dark) → ContextScene (paper)
// produces ~0.87 MAD score. ContextScene (paper) → CtaScene (secondary)
// produces ~0.3-0.5 score. Together ensures 3 high-contrast cuts.
const ContextScene: React.FC<HeadlinePhotoTemplateProps> = ({ topic, headline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = { background: palette.paper };

  const opacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });
  const y       = interpolate(frame, [0, 14], [20, 0], {
    extrapolateRight: "clamp", easing: Easing.bezier(0, 0, 0.2, 1),
  });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "flex-start", justifyContent: "center",
                            padding: "0 80px", gap: 24 }}>
      <div style={{ width: 60, height: 4, backgroundColor: palette.primary, borderRadius: 2,
                    opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }) }} />
      <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.regular,
                    fontSize: TYPE.sizes.body, color: palette.primary,
                    opacity: opacity * 0.7, letterSpacing: TYPE.trackingNormal }}>
        EN BREF
      </div>
      <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.bold,
                    fontSize: TYPE.sizes.title, lineHeight: TYPE.lineHeightTight,
                    color: palette.ink, opacity, transform: `translateY(${y}px)` }}>
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
