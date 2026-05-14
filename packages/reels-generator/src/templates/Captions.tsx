/**
 * Captions — karaoke-style word-level highlighting using Whisper output.
 *
 * Used by every template that wants captions. Renders the most recent
 * 7-word window centered at the bottom 22% of the frame. The currently
 * spoken word is colored `palette.secondary`; the rest stay `palette.accent`.
 *
 * The component is offset-aware: pass `offsetSec` so a body-section caption
 * can use absolute audio timestamps from Whisper while rendering inside a
 * Sequence that started later.
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptionWord } from "./types.js";
import { TYPE, getPalette } from "../brand.js";
import type { ReelTopic } from "../types.js";

export interface CaptionsProps {
  topic: ReelTopic;
  words: CaptionWord[];
  /**
   * Subtract this many seconds from the local frame-time to get the absolute
   * voiceover timestamp. If captions are mounted directly under the audio
   * (no offset Sequence), pass 0.
   */
  offsetSec?: number;
  /** Window size — 7 words is the FT/Reels readability sweet spot. */
  windowSize?: number;
}

export const Captions: React.FC<CaptionsProps> = ({
  topic,
  words,
  offsetSec = 0,
  windowSize = 7,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);

  if (words.length === 0) return null;

  // Absolute time within the voiceover (seconds since voiceover start).
  const tSec = frame / fps + offsetSec;

  // Find the active word — the one whose [start, end] contains tSec.
  let activeIdx = words.findIndex((w) => tSec >= w.start && tSec < w.end);
  if (activeIdx === -1) {
    // Between words — show the most recent one as still active.
    const lastIdx = words.findLastIndex((w) => w.end <= tSec);
    activeIdx = lastIdx === -1 ? 0 : lastIdx;
  }

  const half = Math.floor(windowSize / 2);
  const start = Math.max(0, activeIdx - half);
  const end = Math.min(words.length, start + windowSize);
  const visible = words.slice(start, end);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 280,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: 920,
          padding: "20px 36px",
          background: "rgba(0,0,0,0.55)",
          borderRadius: 18,
          fontFamily: TYPE.body,
          fontWeight: TYPE.weights.bold,
          fontSize: TYPE.sizes.title,
          lineHeight: 1.25,
          textAlign: "center",
          letterSpacing: TYPE.trackingNormal,
        }}
      >
        {visible.map((w, i) => {
          const globalIdx = start + i;
          const isActive = globalIdx === activeIdx;
          return (
            <span
              key={`${globalIdx}-${w.start}`}
              style={{
                color: isActive ? palette.secondary : palette.accent,
                marginRight: 14,
                transition: "color 80ms linear",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
