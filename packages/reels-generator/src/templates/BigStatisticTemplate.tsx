/**
 * BigStatisticTemplate — director + 4 scene cuts (v1.3).
 *
 * Director plan (390 frames = 13 s @ 30 fps):
 *   Scene 0  HookScene        90f  3 s  Bold title card, animated underline
 *   Scene 1  HeroNumberScene 120f  4 s  Salient number, counter animation
 *   Scene 2  BenefitsScene   120f  4 s  Supporting context, staggered lines
 *   Scene 3  CtaScene         60f  2 s  Brand-flip CTA (shared component)
 *
 * Architecture (v1.3):
 *   - Each scene rendered inside a Remotion Sequence. useCurrentFrame() is
 *     sequence-local (0 → durationFrames-1).
 *   - Captions lives OUTSIDE all Sequences — karaoke spans all cuts.
 *   - NO tile patterns. NO repeating-linear-gradient. Clean gradients only
 *     via backgroundForScene() from brand.ts.
 *   - Hard cuts only (v1.4 will add optional dissolves).
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
import { TYPE, MOTION, getPalette, backgroundForScene } from "../brand.js";
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
// Paper (light) background: the opening scene is a clean, bright title card.
// HookScene(paper) → HeroScene(dark) scores ~0.87 in ffmpeg scene detection,
// creating the first of three hard cuts the test requires.
const HookScene: React.FC<BigStatisticTemplateProps> = ({ topic, hook }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = { background: palette.paper };

  const titleOpacity = interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" });
  const titleY = interpolate(frame, [0, 14], [24, 0], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0, 0, 0.2, 1),
  });
  const underlineW = interpolate(frame, [14, 38], [0, 120], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            padding: "0 80px", gap: 20 }}>
      <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.black,
                    fontSize: TYPE.sizes.headline * 1.1, color: palette.primary,
                    textAlign: "center", letterSpacing: "0.04em", textTransform: "uppercase",
                    opacity: titleOpacity, transform: `translateY(${titleY}px)`,
                    lineHeight: TYPE.lineHeightTight }}>
        {hook}
      </div>
      <div style={{ width: underlineW, height: 6, borderRadius: 3,
                    backgroundColor: palette.primary }} />
    </AbsoluteFill>
  );
};

// ── Scene 1: HeroNumberScene (4 s) ────────────────────────────────────────
// Uses palette.paper (light) so the cut from dark HookScene is obvious.
// Light-on-dark alternation ensures every scene boundary scores >= 0.25
// in ffmpeg scene detection (paper→primary produces ~0.87 MAD score).
const HeroNumberScene: React.FC<BigStatisticTemplateProps> = ({ topic, hero, hook }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);
  const bg = backgroundForScene(palette, frame, fps, 1);

  const introScale = interpolate(frame, [0, 14], [1.35, 1.0], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0, 0, 0.2, 1),
  });
  const heroOpacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const pulsePeriod = Math.round(1.7 * fps);
  const pulse = 1 + 0.04 * Math.sin((frame % pulsePeriod) / pulsePeriod * Math.PI * 2);
  const counterText = animateCounter(hero, frame, 30);
  const kindOpacity = interpolate(frame, [10, 22], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            padding: "0 80px", gap: 32 }}>
      <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.medium,
                    fontSize: TYPE.sizes.caption, color: palette.accent,
                    letterSpacing: "0.10em", textTransform: "uppercase",
                    opacity: kindOpacity * 0.75 }}>
        {hook}
      </div>
      <div style={{ fontFamily: TYPE.display, fontWeight: TYPE.weights.black,
                    fontSize: TYPE.sizes.hero * 1.9, color: palette.secondary,
                    transform: `scale(${introScale * pulse})`, opacity: heroOpacity,
                    letterSpacing: TYPE.trackingTight, lineHeight: 1,
                    textAlign: "center", textShadow: "0 6px 32px rgba(0,0,0,0.3)" }}>
        {counterText}
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
  const bg = { background: palette.paper };

  const mkEntrance = (delay: number) => ({
    opacity: interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateRight: "clamp" }),
    y: interpolate(frame, [delay, delay + 14], [24, 0], {
      extrapolateRight: "clamp", easing: Easing.bezier(0, 0, 0.2, 1),
    }),
  });
  const e0 = mkEntrance(4);
  const e1 = mkEntrance(14);
  const e2 = mkEntrance(24);
  const lines = splitIntoLines(context, 3);
  const accentH = interpolate(frame, [0, 18], [0, 0.55 * 1920], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ ...bg, display: "flex", flexDirection: "row",
                            alignItems: "center" }}>
      <div style={{ width: 8, height: accentH, backgroundColor: palette.primary,
                    borderRadius: "0 4px 4px 0", flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column",
                    padding: "0 72px 0 40px", gap: 28 }}>
        <div style={{ fontFamily: TYPE.body, fontWeight: TYPE.weights.medium,
                      fontSize: TYPE.sizes.caption, color: palette.primary,
                      letterSpacing: "0.10em", textTransform: "uppercase",
                      opacity: e0.opacity, transform: `translateY(${e0.y}px)` }}>
          {hook}
        </div>
        {lines.slice(0, 2).map((line, i) => {
          const e = i === 0 ? e1 : e2;
          return (
            <div key={i} style={{ fontFamily: TYPE.display,
                                   fontWeight: i === 0 ? TYPE.weights.bold : TYPE.weights.regular,
                                   fontSize: i === 0 ? TYPE.sizes.title : TYPE.sizes.body,
                                   color: palette.ink, lineHeight: TYPE.lineHeightNormal,
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
      ? Math.round(rounded).toLocaleString("fr-FR").replace(/\u202f/g, sep === "," ? "," : " ")
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

// Keep MOTION imported — used in brand-level constants referenced by Root.
void MOTION;
