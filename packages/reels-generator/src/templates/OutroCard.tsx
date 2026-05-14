/**
 * OutroCard — brand-locked 1.5s closer used by every template.
 *
 *   ┌───────────────────────────────┐
 *   │       SUIVEZ-NOUS             │
 *   │                               │
 *   │       @edlightnews            │
 *   │                               │
 *   │   [topic-specific CTA]        │
 *   │   news.edlight.org            │
 *   └───────────────────────────────┘
 *
 * Triggers `outroChime` SFX at the OutroCard's first frame. Composition
 * mixes audio — template only renders pixels.
 */

import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TYPE, MOTION, getPalette } from "../brand.js";
import type { ReelTopic } from "../types.js";

export interface OutroCardProps {
  topic: ReelTopic;
}

const CTA_BY_TOPIC: Record<ReelTopic, string> = {
  scholarship: "Plus de bourses sur news.edlight.org/bourses",
  opportunity: "Toutes les opportunités sur news.edlight.org/opportunites",
  taux: "Taux à jour chaque matin sur news.edlight.org",
  news: "L'info vérifiée chaque jour sur news.edlight.org",
  histoire: "L'histoire d'Haïti sur news.edlight.org/histoire",
  fact: "Un fait vérifié par jour — abonnez-vous",
  education: "Ressources étudiantes sur news.edlight.org/education",
};

export const OutroCard: React.FC<OutroCardProps> = ({ topic }) => {
  const frame = useCurrentFrame();
  const palette = getPalette(topic);

  // Slide up from below + fade in over the first 12 frames.
  const translateY = interpolate(frame, [0, 12], [40, 0], {
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: palette.primary, color: palette.accent }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          transform: `translateY(${translateY}px)`,
          opacity,
          padding: "0 80px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: TYPE.body,
            fontWeight: TYPE.weights.medium,
            fontSize: TYPE.sizes.body,
            color: palette.accent,
            opacity: 0.7,
            letterSpacing: "0.12em",
          }}
        >
          SUIVEZ-NOUS
        </div>
        <div
          style={{
            fontFamily: TYPE.display,
            fontWeight: TYPE.weights.black,
            fontSize: TYPE.sizes.headline,
            color: palette.secondary,
            letterSpacing: TYPE.trackingTight,
          }}
        >
          @edlightnews
        </div>
        <div
          style={{
            fontFamily: TYPE.body,
            fontSize: TYPE.sizes.body,
            color: palette.accent,
            lineHeight: TYPE.lineHeightNormal,
            maxWidth: 800,
          }}
        >
          {CTA_BY_TOPIC[topic]}
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const OUTRO_DURATION_FRAMES = MOTION.outro.durationFrames;
