/**
 * HeadlinePhotoTemplate — director + 4 scene cuts (v1.6).
 *
 * Director baseline (390 frames = 13 s @ 30 fps):
 *   Scene 0  PhotoEstablishScene 100f  3.3s  Full-bleed photo (or graphic fallback)
 *   Scene 1  HeadlineScene       100f  3.3s  Headline overlay on zoomed photo + source chip
 *   Scene 2  ContextScene        130f  4.3s  keyFacts card stack (deadline emphasised)
 *   Scene 3  CtaScene             60f  2.0s  Action verb + source domain + tap cue
 *
 * v1.6 fixes
 *   #1 — Director now uses `scaleSceneDurations()` so when the audio runs
 *        long (up to 20 s) the slack is absorbed into the CTA instead of
 *        leaving a 3 s solid-blue void after the CTA window closes.
 *   #3 — When no hero image is available, PhotoEstablishScene renders a
 *        graphic fallback (gradient + topic glyph + eyebrow) instead of
 *        leaving the slot effectively empty.
 *   #4 — Baseline rebalanced: ContextScene 90→130 f so keyFacts cards
 *        breathe (was the most information-dense scene at the shortest
 *        duration).
 *   #6 — `<SourceChip>` mounted on HeadlineScene + ContextScene (top-right
 *        on dark, bottom-right on light).
 *   #7 — Deadline card in ContextScene renders larger + URGENT eyebrow.
 *   #8 — Card stagger extended 6→10 frames per card for a guided scan.
 *   #5 — Captions dimmed via `dimAfterFrame` once CtaScene starts.
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
  shiftLightness,
} from "../brand.js";
import { Captions } from "./Captions.js";
import { CtaScene } from "./scenes/CtaScene.js";
import { SourceChip } from "./scenes/SourceChip.js";
import { scaleSceneDurations } from "./types.js";
import type { BaseTemplateProps, DirectorSpec } from "./types.js";

/** v1.6 baseline — see header. Sums to 390 f. */
export const HEADLINE_PHOTO_BASELINE: DirectorSpec = [
  { id: "establish", durationFrames: 100 },
  { id: "headline",  durationFrames: 100 },
  { id: "context",   durationFrames: 130 },
  { id: "cta",       durationFrames: 60  },
] as const;

/** Back-compat export — some external imports may reference the old name. */
export const HEADLINE_PHOTO_SCENES = HEADLINE_PHOTO_BASELINE;

/** Topic-specific glyphs for the no-photo fallback. Unicode-only. */
const TOPIC_GLYPH: Record<string, string> = {
  scholarship: "🎓",
  opportunity: "💼",
  taux:        "📊",
  news:        "📰",
  histoire:    "📜",
  fact:        "💡",
  education:   "📚",
};

export interface HeadlinePhotoTemplateProps extends BaseTemplateProps {
  headline: string;
  heroImageUrl?: string;
  /**
   * Optional supporting facts. When present, ContextScene renders these as
   * an information-dense card stack instead of echoing the headline. All
   * fields ≤ 48 chars (enforced upstream by the script schema).
   */
  keyFacts?: {
    amount?: string;
    deadline?: string;
    eligibility?: string;
    action?: string;
  };
}

// ── Scene 0: PhotoEstablishScene (~3.3 s) ────────────────────────────────
// v1.6: when no hero image is available we render a richer GRAPHIC
// fallback (large topic glyph behind a tinted gradient) so the slot is
// never just paper-colored. The photo path is unchanged.
const PhotoEstablishScene: React.FC<HeadlinePhotoTemplateProps> = ({ topic, heroImageUrl, clips, headline, dateLabel }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = paperBackgroundForScene(palette, frame, fps, 0);

  const zoom = interpolate(frame, [0, durationInFrames], [1.0, 1.05], { extrapolateRight: "clamp" });
  const panY = interpolate(frame, [0, durationInFrames], [0, -10], { extrapolateRight: "clamp" });
  const textOpacity = enterFromCutOpacity(frame, 6, 0.55);
  const textY = enterFromCutTranslateY(frame, 7, 12);
  const textScale = enterFromCutScale(frame, 8, 1.04);
  const eyebrowOpacity = interpolate(frame, [6, 18], [0, 0.78], { extrapolateRight: "clamp" });
  const accentH = interpolate(frame, [0, 16], [20, 84], {
    extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
  });

  const imageUrl = heroImageUrl ?? clips[0]?.url;
  const isVideo = !!imageUrl && /\.(mp4|webm|mov|m4v)(\?|$)/i.test(imageUrl);
  const hasMedia = !!imageUrl;

  // Graphic fallback bits (only rendered when !hasMedia).
  const glyph = TOPIC_GLYPH[topic] ?? "📰";
  const glyphScale = interpolate(frame, [0, 30], [0.92, 1.0], {
    extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
  });
  const glyphOpacity = interpolate(frame, [0, 20], [0, 0.22], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={bg}>
      {hasMedia ? (
        isVideo ? (
          <OffthreadVideo src={imageUrl!} muted
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                     objectFit: "cover", opacity: 0.24,
                     transform: `scale(${zoom}) translateY(${panY}px)`,
                     transformOrigin: "center 40%" }} />
        ) : (
          <Img src={imageUrl!}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%",
                     objectFit: "cover", opacity: 0.24,
                     transform: `scale(${zoom}) translateY(${panY}px)`,
                     transformOrigin: "center 40%" }} />
        )
      ) : (
        // ── Graphic fallback (v1.6 issue #3) ─────────────────────────
        // Tinted gradient + massive topic glyph behind the headline.
        <>
          <div aria-hidden style={{ position: "absolute", inset: 0,
                                    background: `radial-gradient(ellipse 70% 50% at 70% 30%, ${shiftLightness(palette.secondary, 4)} 0%, transparent 60%),
                                                 linear-gradient(160deg, ${palette.paper} 0%, ${shiftLightness(palette.paper, -4)} 100%)` }} />
          <div aria-hidden
               style={{ position: "absolute", right: 60, top: 220,
                        fontSize: 520, lineHeight: 1,
                        opacity: glyphOpacity,
                        transform: `scale(${glyphScale})`,
                        transformOrigin: "center",
                        filter: "saturate(0.6)",
                        userSelect: "none",
                        pointerEvents: "none" }}>
            {glyph}
          </div>
        </>
      )}
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
            {hasMedia ? "À LA UNE" : (dateLabel ?? "AUJOURD'HUI")}
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

// ── Scene 1: HeadlineScene (~3.3 s) ───────────────────────────────────────
const HeadlineScene: React.FC<HeadlinePhotoTemplateProps> = ({ topic, headline, heroImageUrl, clips, sourceLabel, sourceDomain }) => {
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
      {/* v1.6 — visible source attribution chip (issue #6) */}
      <SourceChip topic={topic} domain={sourceDomain} surface="dark" placement="top-right" />
    </AbsoluteFill>
  );
};

// ── Scene 2: ContextScene (~4.3 s) ────────────────────────────────────────
// When `keyFacts` are provided the scene renders an information-dense card
// stack (amount / deadline / eligibility / action) instead of echoing the
// headline. Cards animate in with a staggered cascade so the eye lands on
// each fact in turn — this is the single most actionable scene in the reel.
const ContextScene: React.FC<HeadlinePhotoTemplateProps> = ({ topic, headline, keyFacts, sourceDomain }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = paperBackgroundForScene(palette, frame, fps, 2);

  const opacity = enterFromCutOpacity(frame, 6, 0.55);
  const y = enterFromCutTranslateY(frame, 7, 14);
  const barW = interpolate(frame, [4, 18], [40, 92], {
    extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
  });

  // Order: deadline first (most urgent), then amount, then who, then how.
  // `urgent` flag drives the v1.6 emphasis treatment (larger value + halo).
  type Card = { label: string; value: string; tint: string; urgent?: boolean };
  const cards: Card[] = [];
  if (keyFacts?.deadline)    cards.push({ label: "ÉCHÉANCE — URGENT", value: keyFacts.deadline,    tint: palette.secondary, urgent: true });
  if (keyFacts?.amount)      cards.push({ label: "MONTANT",            value: keyFacts.amount,      tint: palette.primary });
  if (keyFacts?.eligibility) cards.push({ label: "POUR QUI",           value: keyFacts.eligibility, tint: palette.ink });
  if (keyFacts?.action)      cards.push({ label: "ACTION",             value: keyFacts.action,      tint: palette.secondary });

  // v1.6 issue #8 — extended stagger 6→10 f per card so the eye lands on
  // each fact distinctly (was previously perceived as a single block).
  const STAGGER = 10;

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "flex-start", justifyContent: "center",
                            padding: "0 80px", gap: 26 }}>
      <div style={{ width: barW, height: 6, backgroundColor: palette.secondary, borderRadius: 3 }} />
      <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.semibold,
                    fontSize: TYPE.sizes.caption, color: palette.primary,
                    letterSpacing: TYPE.trackingLoose, textTransform: "uppercase",
                    opacity: opacity * 0.7 }}>
        {cards.length > 0 ? "L'ESSENTIEL" : "EN BREF"}
      </div>

      {cards.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 880 }}>
          {cards.map((card, idx) => {
            const cardOpacity = interpolate(
              frame, [4 + idx * STAGGER, 14 + idx * STAGGER], [0, 1],
              { extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out) },
            );
            const cardX = interpolate(
              frame, [4 + idx * STAGGER, 14 + idx * STAGGER], [-28, 0],
              { extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out) },
            );
            // v1.6 issue #7 — deadline card gets emphasised treatment:
            // chunkier border, larger value text, soft halo.
            const isUrgent = card.urgent === true;
            return (
              <div key={card.label}
                   style={{ display: "flex", flexDirection: "column", gap: 6,
                            padding: isUrgent ? "22px 26px" : "16px 22px",
                            borderLeft: `${isUrgent ? 12 : 8}px solid ${card.tint}`,
                            backgroundColor: isUrgent
                              ? `${shiftLightness(palette.secondary, 12)}ee`
                              : `${palette.accent}cc`,
                            borderRadius: 10,
                            boxShadow: isUrgent
                              ? `0 8px 26px ${palette.secondary}55`
                              : "none",
                            opacity: cardOpacity,
                            transform: `translateX(${cardX}px)` }}>
                <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.bold,
                              fontSize: isUrgent ? TYPE.sizes.caption : TYPE.sizes.footer,
                              color: isUrgent ? palette.primary : card.tint,
                              letterSpacing: TYPE.trackingLoose, textTransform: "uppercase" }}>
                  {card.label}
                </div>
                <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.bold,
                              fontSize: isUrgent ? TYPE.sizes.headline : TYPE.sizes.title,
                              color: palette.ink, lineHeight: 1.05,
                              letterSpacing: TYPE.trackingTight }}>
                  {card.value}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Fallback: no keyFacts available — echo the headline.
        <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.bold,
                      fontSize: TYPE.sizes.title, lineHeight: TYPE.lineHeightTight,
                      color: palette.ink, letterSpacing: TYPE.trackingTight,
                      opacity, transform: `translateY(${y}px)`,
                      maxWidth: 880 }}>
          {headline}
        </div>
      )}
      {/* v1.6 — source attribution chip on light surface (issue #6) */}
      <SourceChip topic={topic} domain={sourceDomain} surface="light" placement="bottom-right" />
    </AbsoluteFill>
  );
};

// ── Director wrapper ──────────────────────────────────────────────────────
export const HeadlinePhotoTemplate: React.FC<HeadlinePhotoTemplateProps> = (props) => {
  // v1.6 issue #1 — scale the baseline so the CTA absorbs any audio
  // overhang. When bodyDurationFrames is missing (e.g. older callers),
  // fall back to the baseline sum so behaviour is unchanged.
  const baseTotal = HEADLINE_PHOTO_BASELINE.reduce((s, x) => s + x.durationFrames, 0);
  const scenes = scaleSceneDurations(
    HEADLINE_PHOTO_BASELINE,
    props.bodyDurationFrames ?? baseTotal,
    /* padIndex = CTA */ HEADLINE_PHOTO_BASELINE.length - 1,
  );
  let cursor = 0;
  // ctaStart drives Captions dim window (issue #5).
  const ctaStart = scenes.slice(0, -1).reduce((s, x) => s + x.durationFrames, 0);

  return (
    <AbsoluteFill style={{ backgroundColor: getPalette(props.topic).primary }}>
      {scenes.map((scene, i) => {
        const from = cursor;
        cursor += scene.durationFrames;
        const el =
          scene.id === "establish" ? <PhotoEstablishScene {...props} /> :
          scene.id === "headline"  ? <HeadlineScene {...props} /> :
          scene.id === "context"   ? <ContextScene {...props} /> :
                                     <CtaScene
                                       topic={props.topic}
                                       sceneIndex={i}
                                       sourceDomain={props.sourceDomain}
                                       deadline={props.keyFacts?.deadline}
                                     />;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={scene.durationFrames}>
            {el}
          </Sequence>
        );
      })}
      <Captions topic={props.topic} words={props.captions} dimAfterFrame={ctaStart} />
    </AbsoluteFill>
  );
};
