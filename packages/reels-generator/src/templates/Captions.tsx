/**
 * Captions — karaoke-style word-level caption bar.
 *
 * v1.1 layout rules (from Reels Quality PR):
 *   - Anchored 280 px above the frame bottom (clear of IG's UI overlay).
 *   - Max width 86 % of frame (≤ 928 px @ 1080w) — never clips the right edge.
 *   - At most 4 words visible at a time. If the 4-word window would exceed
 *     `maxWidth`, drops to 3.
 *   - Body 56 px; active word 60 px (visual emphasis).
 *   - Ink-tinted background at 88 % opacity + soft drop shadow.
 *
 * `offsetSec` is preserved for back-compat — pass 0 if the caption bar is
 * mounted directly under the audio (current orchestrator does exactly that).
 */

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptionWord } from "./types.js";
import { TYPE, getPalette } from "../brand.js";
import type { ReelTopic } from "../types.js";

export interface CaptionsProps {
  topic: ReelTopic;
  words: CaptionWord[];
  /** Subtract this many seconds from frame-time to get voiceover timestamps. */
  offsetSec?: number;
  /**
   * Maximum visible window size. Hard upper bound; the renderer may show
   * fewer words when the 4-word window would overflow `MAX_WIDTH_PX`.
   */
  windowSize?: number;
}

// ── Layout constants (kept here so designers can audit in one place) ───
const FRAME_WIDTH = 1080;
const MAX_WIDTH_RATIO = 0.86;
const MAX_WIDTH_PX = Math.floor(FRAME_WIDTH * MAX_WIDTH_RATIO); // 928
const PADDING_BOTTOM = 280;
const BAR_PADDING_X = 28;
const BAR_PADDING_Y = 24;
const BORDER_RADIUS = 16;
const FONT_SIZE_BODY = 56;
const FONT_SIZE_ACTIVE = 60;
const MAX_WORDS = 4;
/** Rough average char width @ 56 px Inter Bold. Calibrated visually. */
const AVG_CHAR_PX_BODY = 30;
const AVG_CHAR_PX_ACTIVE = 33;

export const Captions: React.FC<CaptionsProps> = ({
  topic,
  words,
  offsetSec = 0,
  windowSize = MAX_WORDS,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const palette = getPalette(topic);

  if (words.length === 0) return null;

  // Absolute voiceover time.
  const tSec = frame / fps + offsetSec;

  // Find the active word.
  let activeIdx = words.findIndex((w) => tSec >= w.start && tSec < w.end);
  if (activeIdx === -1) {
    const lastIdx = words.findLastIndex((w) => w.end <= tSec);
    activeIdx = lastIdx === -1 ? 0 : lastIdx;
  }

  // Word window: slide forward one word at a time so the active word
  // always sits inside the visible cluster (preferring center placement
  // when possible). With windowSize=4, the active word can sit at slots
  // 0..3; keeping it near slot 1 reads most naturally for L→R languages.
  const maxWords = Math.max(1, Math.min(MAX_WORDS, windowSize));
  let start = Math.max(0, activeIdx - 1);
  let end = Math.min(words.length, start + maxWords);
  start = Math.max(0, end - maxWords);

  // Width-aware shrink: if the 4-word window would exceed MAX_WIDTH_PX
  // (long Haitian compound nouns, long French verb tenses), drop to 3.
  let visible = words.slice(start, end);
  if (estimateWindowWidth(visible, activeIdx - start) > MAX_WIDTH_PX) {
    end = Math.min(words.length, start + Math.max(1, maxWords - 1));
    visible = words.slice(start, end);
  }

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: PADDING_BOTTOM,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth: MAX_WIDTH_PX,
          padding: `${BAR_PADDING_Y}px ${BAR_PADDING_X}px`,
          background: `${palette.ink}E0`, // 0xE0 ≈ 88 %
          borderRadius: BORDER_RADIUS,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          fontFamily: TYPE.body,
          fontWeight: TYPE.weights.bold,
          lineHeight: 1.18,
          textAlign: "center",
          letterSpacing: TYPE.trackingNormal,
          // Cluster words on one line; the width-aware shrink keeps us
          // inside MAX_WIDTH_PX so wrap shouldn't trigger, but if a single
          // word is wider than the bar we let it scale rather than clip.
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
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
                marginRight: i === visible.length - 1 ? 0 : 14,
                fontSize: isActive ? FONT_SIZE_ACTIVE : FONT_SIZE_BODY,
                transition: "color 80ms linear, font-size 80ms linear",
                verticalAlign: "baseline",
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

/**
 * Rough width estimate (px) for a caption window. We assume the active word
 * renders at the larger size; everything else at body size. Adds the per-word
 * right margin (14 px) and the bar's horizontal padding. Deliberately
 * conservative — when in doubt we shrink to 3 words.
 */
function estimateWindowWidth(words: CaptionWord[], activeRelIdx: number): number {
  let px = BAR_PADDING_X * 2;
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const charPx = i === activeRelIdx ? AVG_CHAR_PX_ACTIVE : AVG_CHAR_PX_BODY;
    px += w.word.length * charPx;
    if (i < words.length - 1) px += 14; // marginRight
  }
  return px;
}
