/**
 * BigStatisticTemplate — director + 4 scene cuts (v1.4).
 *
 * Director plan (390 frames = 13 s @ 30 fps):
 *   Scene 0  HookScene        90f  3 s  Bold title card, animated underline
 *   Scene 1  HeroNumberScene 120f  4 s  Salient number — mega scale, counter, halo
 *   Scene 2  BenefitsScene   120f  4 s  Supporting context, staggered lines
 *   Scene 3  CtaScene         60f  2 s  Brand-flip CTA (shared component)
 *
 * v1.4 upgrades:
 *   - Mega-scale hero number (240 px) with halo glow behind
 *   - enterFromCut helpers — no empty frames immediately after a cut
 *   - paperBackgroundForScene / backgroundForScene give depth (radial highlight + vignette)
 *   - Eyebrow + counter combination above the number for premium editorial feel
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
  shiftLightness,
} from "../brand.js";
import { Captions } from "./Captions.js";
import { CtaScene } from "./scenes/CtaScene.js";
import type { BaseTemplateProps, DirectorSpec } from "./types.js";

// ── Director spec ─────────────────────────────────────────────────────────
export const BIG_STATISTIC_SCENES: DirectorSpec = [
  { id: "hook",    durationFrames: 90  },
  { id: "hero",    durationFrames: 120 },
  { id: "context", durationFrames: 120 },
  { id: "cta",     durationFrames: 60  },
] as const;

export interface BigStatisticTemplateProps extends BaseTemplateProps {
  hero: string;
  hook: string;
  context: string;
}

// ── Scene 0: HookScene (3 s) ──────────────────────────────────────────────
// Paper background with subtle depth. Cut to HeroNumberScene (dark) scores
// ~0.87 in ffmpeg scene detection.
const HookScene: React.FC<BigStatisticTemplateProps> = ({ topic, hook }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = paperBackgroundForScene(palette, frame, fps, 0);

  const titleOpacity = enterFromCutOpacity(frame, 6);
  const titleScale = enterFromCutScale(frame, 8, 1.04);
  const titleY = enterFromCutTranslateY(frame, 7, 12);
  const eyebrowOpacity = interpolate(frame, [6, 16], [0, 0.78], { extrapolateRight: "clamp" });
  const underlineW = interpolate(frame, [12, 32], [0, 132], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(...MOTION.ease.out),
  });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            padding: "0 80px", gap: 26 }}>
      <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.semibold,
                    fontSize: TYPE.sizes.caption, color: palette.primary,
                    letterSpacing: TYPE.trackingLoose, textTransform: "uppercase",
                    opacity: eyebrowOpacity }}>
        EN UN CHIFFRE
      </div>
      <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.black,
                    fontSize: TYPE.sizes.headline, color: palette.ink,
                    textAlign: "center", letterSpacing: TYPE.trackingTight,
                    opacity: titleOpacity,
                    transform: `translateY(${titleY}px) scale(${titleScale})`,
                    lineHeight: TYPE.lineHeightTight,
                    maxWidth: 900 }}>
        {hook}
      </div>
      <div style={{ width: underlineW, height: 6, borderRadius: 3,
                    backgroundColor: palette.secondary }} />
    </AbsoluteFill>
  );
};

// ── Scene 1: HeroNumberScene (4 s) ────────────────────────────────────────
const HeroNumberScene: React.FC<BigStatisticTemplateProps> = ({ topic, hero, hook }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = backgroundForScene(palette, frame, fps, 1);

  // Counter animation on the hero number — over ~30 frames (1 s).
  const counterText = animateCounter(hero, frame, 30);

  // Snappy overshoot scale: 1.10 → 1.0 in 8 frames so the cut never reveals
  // a tiny invisible number.
  const heroScale = enterFromCutScale(frame, 8, 1.10);
  const heroOpacity = enterFromCutOpacity(frame, 5, 0.50);

  // Subtle breathing pulse after entrance.
  const pulsePeriod = Math.round(2.0 * fps);
  const pulseT = (Math.max(0, frame - 12) % pulsePeriod) / pulsePeriod;
  const pulse = 1 + 0.018 * Math.sin(pulseT * Math.PI * 2);

  // Eyebrow + framing label appear AFTER the number lands.
  const labelOpacity = interpolate(frame, [10, 24], [0, 0.85], {
    extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
  });
  const labelY = interpolate(frame, [10, 24], [12, 0], {
    extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
  });

  // Halo glow behind the hero number for depth.
  const haloPulse = 1 + 0.08 * Math.sin(pulseT * Math.PI * 2);
  const haloOpacity = 0.42 + 0.10 * Math.sin(pulseT * Math.PI * 2);

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            padding: "0 80px", gap: 28 }}>
      <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.semibold,
                    fontSize: TYPE.sizes.caption, color: palette.accent,
                    letterSpacing: TYPE.trackingLoose, textTransform: "uppercase",
                    opacity: labelOpacity * 0.85,
                    transform: `translateY(${labelY}px)` }}>
        CHIFFRE CLÉ
      </div>

      {/* Halo + number */}
      <div style={{ position: "relative", display: "flex",
                    alignItems: "center", justifyContent: "center" }}>
        <div aria-hidden style={{ position: "absolute", inset: "-120px -160px",
                                  background: `radial-gradient(ellipse at center, ${shiftLightness(palette.secondary, 8)} 0%, transparent 65%)`,
                                  opacity: haloOpacity,
                                  transform: `scale(${haloPulse})`,
                                  filter: "blur(12px)" }} />
        <div style={{ position: "relative", fontFamily: TYPE.display,
                      fontWeight: TYPE.weights.black,
                      fontSize: TYPE.sizes.mega,
                      color: palette.secondary,
                      transform: `scale(${heroScale * pulse})`,
                      opacity: heroOpacity,
                      letterSpacing: TYPE.trackingTight, lineHeight: 0.92,
                      textAlign: "center",
                      textShadow: "0 10px 40px rgba(0,0,0,0.35)" }}>
          {counterText}
        </div>
      </div>

      {/* Hook word beneath number — anchors meaning */}
      <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.medium,
                    fontSize: TYPE.sizes.body, color: palette.accent,
                    letterSpacing: TYPE.trackingNormal,
                    opacity: labelOpacity * 0.85,
                    transform: `translateY(${labelY}px)`,
                    textAlign: "center", maxWidth: 800,
                    lineHeight: TYPE.lineHeightNormal }}>
        {hook}
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: BenefitsScene (4 s) ──────────────────────────────────────────
// Paper (light) background: dark HeroScene → paper BenefitsScene scores ~0.87
// paper BenefitsScene → secondary CtaScene scores ~0.29-0.50.
const BenefitsScene: React.FC<BigStatisticTemplateProps> = ({ topic, context, hook }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = paperBackgroundForScene(palette, frame, fps, 2);

  // Snappy first-line entrance — second line staggered.
  const e0 = {
    opacity: enterFromCutOpacity(frame, 5, 0.55),
    y: enterFromCutTranslateY(frame, 7, 12),
  };
  const mkStaggered = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 10], [0, 1], {
      extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
    }),
    y: interpolate(frame, [delay, delay + 12], [20, 0], {
      extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
    }),
  });
  const e1 = mkStaggered(8);
  const e2 = mkStaggered(18);
  const lines = splitIntoLines(context, 3);
  const accentH = interpolate(frame, [0, 18], [220, 0.65 * 1920], {
    extrapolateRight: "clamp", easing: Easing.bezier(...MOTION.ease.out),
  });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "row",
                            alignItems: "center" }}>
      <div style={{ width: 10, height: accentH, backgroundColor: palette.secondary,
                    borderRadius: "0 5px 5px 0", flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column",
                    padding: "0 80px 0 48px", gap: 28, flex: 1 }}>
        <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.semibold,
                      fontSize: TYPE.sizes.caption, color: palette.primary,
                      letterSpacing: TYPE.trackingLoose, textTransform: "uppercase",
                      opacity: e0.opacity * 0.85, transform: `translateY(${e0.y}px)` }}>
          {hook}
        </div>
        {lines.slice(0, 2).map((line, i) => {
          const e = i === 0 ? e1 : e2;
          return (
            <div key={i} style={{ fontFamily: TYPE.display,
                                   fontWeight: i === 0 ? TYPE.weights.bold : TYPE.weights.regular,
                                   fontSize: i === 0 ? TYPE.sizes.title : TYPE.sizes.body,
                                   color: palette.ink, lineHeight: TYPE.lineHeightNormal,
                                   letterSpacing: TYPE.trackingTight,
                                   opacity: e.opacity, transform: `translateY(${e.y}px)` }}>
              {line}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Director wrapper ──────────────────────────────────────────────────────
export const BigStatisticTemplate: React.FC<BigStatisticTemplateProps> = (props) => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: getPalette(props.topic).primary }}>
      {BIG_STATISTIC_SCENES.map((scene, i) => {
        const from = cursor;
        cursor += scene.durationFrames;
        const el =
          scene.id === "hook"    ? <HookScene {...props} /> :
          scene.id === "hero"    ? <HeroNumberScene {...props} /> :
          scene.id === "context" ? <BenefitsScene {...props} /> :
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

// ── Helpers ───────────────────────────────────────────────────────────────

function animateCounter(hero: string, frame: number, frames: number): string {
  const match = hero.match(/^(\D*)([0-9][0-9\s.,]*)(.*)$/);
  if (!match) return hero;
  const [, prefix = "", raw, suffix = ""] = match;
  const cleaned = raw.replace(/[\s,]/g, "");
  if ((cleaned.match(/\./g) ?? []).length > 1) return hero;
  const final = parseFloat(cleaned);
  if (!Number.isFinite(final)) return hero;
  const t = interpolate(frame, [0, frames], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.bezier(0, 0, 0.2, 1),
  });
  const current = final * t;
  const isInt = !cleaned.includes(".");
  const sep = raw.includes(",") ? "," : raw.includes(" ") ? " " : "";
  const rounded = isInt ? Math.round(current) : current;
  const display = isInt
    ? sep
      ? Math.round(rounded).toLocaleString("fr-FR").replace(/ /g, sep === "," ? "," : " ")
      : String(Math.round(rounded))
    : rounded.toFixed(1);
  return `${prefix}${display}${suffix}`;
}

function splitIntoLines(text: string, maxLines: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  if (words.length <= 4) return [text];
  const perLine = Math.ceil(words.length / maxLines);
  const lines: string[] = [];
  for (let i = 0; i < words.length && lines.length < maxLines; i += perLine) {
    const chunk = words.slice(i, i + perLine);
    const remaining = words.slice(i + perLine);
    if (lines.length === maxLines - 1 && remaining.length > 0) {
      lines.push([...chunk, ...remaining].join(" ")); break;
    }
    lines.push(chunk.join(" "));
  }
  return lines.filter(Boolean);
}
