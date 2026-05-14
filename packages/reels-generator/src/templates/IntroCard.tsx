/**
 * IntroCard — brand-locked 1.2s opener used by every template.
 *
 *   ┌───────────────────────────────┐
 *   │                               │
 *   │    [Sandra avatar (round)]    │
 *   │                               │
 *   │    EDLIGHT NEWS               │
 *   │    [topic badge]  [date]      │
 *   │                               │
 *   └───────────────────────────────┘
 *
 * Triggers the `introWhoosh` SFX at frame 0 (mounted at Composition level).
 * The card scales in from 0.92 → 1.00 over the full 36-frame duration.
 */

import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { TYPE, MOTION, BRAND_ASSETS, getPalette, FRAME } from "../brand.js";
import type { ReelTopic } from "../types.js";

export interface IntroCardProps {
  topic: ReelTopic;
  dateLabel: string;
  /** Resolved HTTPS URL for Sandra avatar (passed in by composeReel). */
  avatarUrl?: string;
}

const TOPIC_BADGE_LABEL: Record<ReelTopic, string> = {
  scholarship: "BOURSES",
  opportunity: "OPPORTUNITÉS",
  taux: "TAUX DU JOUR",
  news: "ACTUALITÉS",
  histoire: "HISTOIRE",
  fact: "LE SAVIEZ-VOUS",
  education: "ÉDUCATION",
};

export const IntroCard: React.FC<IntroCardProps> = ({ topic, dateLabel, avatarUrl }) => {
  const frame = useCurrentFrame();
  const palette = getPalette(topic);

  // Scale in over full intro duration. Easing: gentle out-cubic.
  const scale = interpolate(
    frame,
    [0, MOTION.intro.durationFrames],
    [0.92, 1.0],
    { extrapolateRight: "clamp" },
  );
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
          gap: 32,
          transform: `scale(${scale})`,
          opacity,
        }}
      >
        {avatarUrl ? (
          <Img
            src={avatarUrl}
            style={{
              width: 240,
              height: 240,
              borderRadius: "50%",
              border: `6px solid ${palette.secondary}`,
              objectFit: "cover",
            }}
          />
        ) : (
          // Avatar fallback — ring with monogram, in case asset is missing.
          <div
            style={{
              width: 240,
              height: 240,
              borderRadius: "50%",
              border: `6px solid ${palette.secondary}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: TYPE.display,
              fontSize: 96,
              color: palette.accent,
            }}
          >
            S
          </div>
        )}
        <div
          style={{
            fontFamily: TYPE.body,
            fontSize: TYPE.sizes.title,
            fontWeight: TYPE.weights.black,
            letterSpacing: "0.08em",
            color: palette.accent,
          }}
        >
          EDLIGHT NEWS
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div
            style={{
              padding: "10px 22px",
              backgroundColor: palette.secondary,
              color: palette.ink,
              fontFamily: TYPE.body,
              fontWeight: TYPE.weights.bold,
              fontSize: TYPE.sizes.caption,
              letterSpacing: "0.06em",
              borderRadius: 999,
            }}
          >
            {TOPIC_BADGE_LABEL[topic]}
          </div>
          <div
            style={{
              fontFamily: TYPE.body,
              fontSize: TYPE.sizes.caption,
              color: palette.accent,
              opacity: 0.85,
            }}
          >
            {dateLabel}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const INTRO_DURATION_FRAMES = MOTION.intro.durationFrames;
export const INTRO_FRAME_SIZE = { width: FRAME.width, height: FRAME.height };
