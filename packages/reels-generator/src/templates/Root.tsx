/**
 * Root.tsx — Remotion composition registry.
 *
 * One composition per `(template)` — the topic and content come in via
 * `defaultProps` resolved at render time by `composeReel.ts`. We don't
 * register one composition per (topic, template) pair because that would
 * be 7 * 4 = 28 entries; the topic just changes colors and labels.
 *
 * Default duration = MAX_REEL_SEC. The orchestrator overrides
 * `durationInFrames` per-render via `selectComposition()`.
 */

import React from "react";
import { Composition, registerRoot } from "remotion";
import { FRAME, MOTION } from "../brand.js";
import { BigStatisticTemplate } from "./BigStatisticTemplate.js";
import { PullQuoteTemplate } from "./PullQuoteTemplate.js";
import { HeadlinePhotoTemplate } from "./HeadlinePhotoTemplate.js";
import { NumberedPointsTemplate } from "./NumberedPointsTemplate.js";
import { IntroCard } from "./IntroCard.js";
import { OutroCard } from "./OutroCard.js";
import type { ReelTopic } from "../types.js";
import type { CaptionWord, ResolvedClip } from "./types.js";

const DEFAULT_DURATION_SEC = 30;
const DEFAULT_FRAMES = DEFAULT_DURATION_SEC * FRAME.fps;

const fallbackBase = {
  topic: "news" as ReelTopic,
  durationSec: DEFAULT_DURATION_SEC,
  captions: [] as CaptionWord[],
  clips: [] as ResolvedClip[],
  sourceLabel: "EdLight News",
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="reel-big-statistic"
        component={BigStatisticTemplate as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={DEFAULT_FRAMES}
        fps={FRAME.fps}
        width={FRAME.width}
        height={FRAME.height}
        defaultProps={{
          ...fallbackBase,
          hero: "63 %",
          hook: "Réussite au bac",
          context: "Taux national 2024 selon le ministère de l'Éducation.",
        }}
      />
      <Composition
        id="reel-pull-quote"
        component={PullQuoteTemplate as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={DEFAULT_FRAMES}
        fps={FRAME.fps}
        width={FRAME.width}
        height={FRAME.height}
        defaultProps={{
          ...fallbackBase,
          quote: "L'éducation est l'arme la plus puissante.",
          attribution: "Nelson Mandela",
        }}
      />
      <Composition
        id="reel-headline-photo"
        component={HeadlinePhotoTemplate as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={DEFAULT_FRAMES}
        fps={FRAME.fps}
        width={FRAME.width}
        height={FRAME.height}
        defaultProps={{
          ...fallbackBase,
          headline: "Nouvelle bourse pour étudiants haïtiens",
        }}
      />
      <Composition
        id="reel-numbered-points"
        component={NumberedPointsTemplate as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={DEFAULT_FRAMES}
        fps={FRAME.fps}
        width={FRAME.width}
        height={FRAME.height}
        defaultProps={{
          ...fallbackBase,
          framing: "3 choses à savoir",
          points: ["Premier point", "Deuxième point", "Troisième point"],
        }}
      />
      {/* Intro and outro are rendered as standalone clips and concatenated
          by the composer so they can be reused across all templates. */}
      <Composition
        id="reel-intro"
        component={IntroCard as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={MOTION.intro.durationFrames}
        fps={FRAME.fps}
        width={FRAME.width}
        height={FRAME.height}
        defaultProps={{
          topic: fallbackBase.topic,
          dateLabel: "AUJOURD'HUI",
        }}
      />
      <Composition
        id="reel-outro"
        component={OutroCard as unknown as React.ComponentType<Record<string, unknown>>}
        durationInFrames={MOTION.outro.durationFrames}
        fps={FRAME.fps}
        width={FRAME.width}
        height={FRAME.height}
        defaultProps={{ topic: fallbackBase.topic }}
      />
    </>
  );
};

// Required by Remotion's bundle()/renderMedia(): the entry file must call
// registerRoot() with the component that holds the <Composition> tree.
registerRoot(RemotionRoot);
