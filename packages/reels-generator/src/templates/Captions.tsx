/**
 * Captions — premium karaoke caption bar (v1.4).
 *
 * v1.4 layout & motion rules:
 *   - Anchored 280 px above the frame bottom (clear of IG's UI overlay).
 *   - Active word renders at 68 px with a scale-pop on becoming active.
 *   - Spoken words (left of active) and upcoming words (right of active)
 *     render at 50 px and dim to 70 % opacity.
 *   - Active word gets a subtle accent underline (palette.secondary) that
 *     draws on with each new active word.
 *   - Word-boundary truncation: the visible window is built by ACCUMULATING
 *     measured width — words only enter the window if they fit cleanly.
 *     We never show a mid-word ellipsis (regression caught in v1.3 frames:
 *     "campag", "visant u").
 *   - Bar background uses 86 % ink + soft drop shadow for glass feel.
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
   * fewer words when accumulated word width exceeds `MAX_WIDTH_PX`.
   */
  windowSize?: number;
}

// ── Layout constants (kept here so designers can audit in one place) ───
const FRAME_WIDTH = 1080;
const MAX_WIDTH_RATIO = 0.86;
const MAX_WIDTH_PX = Math.floor(FRAME_WIDTH * MAX_WIDTH_RATIO); // 928
const PADDING_BOTTOM = 280;
const BAR_PADDING_X = 32;
const BAR_PADDING_Y = 26;
const BORDER_RADIUS = 22;
const FONT_SIZE_BODY = 50;
const FONT_SIZE_ACTIVE = 68;
const MAX_WORDS = 4;
/** Rough average char width for Inter Bold @ these sizes. Calibrated visually. */
const AVG_CHAR_PX_BODY = 27;
const AVG_CHAR_PX_ACTIVE = 38;
const WORD_GAP_PX = 16;

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

  // ── Active word ────────────────────────────────────────────────────
  let activeIdx = words.findIndex((w) => tSec >= w.start && tSec < w.end);
  if (activeIdx === -1) {
    const lastIdx = words.findLastIndex((w) => w.end <= tSec);
    activeIdx = lastIdx === -1 ? 0 : lastIdx;
  }
  const activeWord = words[activeIdx]!;

  // ── Build the visible window by accumulating WHOLE WORDS only ──────
  // Strategy: pivot on the active word, add words to the left and right
  // alternately while accumulated width stays under MAX_WIDTH_PX. Never
  // split a word — never show a mid-word ellipsis.
  const maxWords = Math.max(1, Math.min(MAX_WORDS, windowSize));
  const window = buildVisibleWindow(words, activeIdx, maxWords, MAX_WIDTH_PX - BAR_PADDING_X * 2);

  // ── Per-active-word entrance: scale-pop with overshoot ─────────────
  // The active word "pops" each time it becomes active. We compute its
  // age (frames since it became active) and apply an overshoot curve.
  const activeAgeSec = Math.max(0, tSec - activeWord.start);
  const activeAgeFrames = activeAgeSec * fps;
  const popDuration = 6;
  const popScale = activePopScale(activeAgeFrames, popDuration);
  const underlineProgress = Math.min(1, activeAgeFrames / 8);

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
          padding: `${BAR_PADDING_Y}px ${BAR_PADDING_X}px`,
          background: `${palette.ink}DC`, // ~86 % opacity
          borderRadius: BORDER_RADIUS,
          boxShadow: "0 16px 38px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.18)",
          fontFamily: TYPE.body,
          fontWeight: TYPE.weights.bold,
          lineHeight: 1.04,
          textAlign: "center",
          letterSpacing: TYPE.trackingNormal,
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "baseline",
          gap: WORD_GAP_PX,
        }}
      >
        {window.map((w, i) => {
          const globalIdx = window[0]!.globalIdx + i;
          const isActive = globalIdx === activeIdx;
          const isSpoken = globalIdx < activeIdx;
          const baseSize = isActive ? FONT_SIZE_ACTIVE : FONT_SIZE_BODY;
          const opacity = isActive ? 1 : isSpoken ? 0.55 : 0.78;
          const color = isActive ? palette.secondary : palette.accent;

          return (
            <span
              key={`${globalIdx}-${w.start}`}
              style={{
                position: "relative",
                color,
                fontSize: baseSize,
                opacity,
                transform: isActive ? `scale(${popScale})` : "scale(1)",
                transformOrigin: "center bottom",
                transition: "color 60ms linear, opacity 80ms linear",
                whiteSpace: "nowrap",
                verticalAlign: "baseline",
              }}
            >
              {w.word}
              {isActive ? (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: -8,
                    height: 5,
                    borderRadius: 3,
                    background: palette.secondary,
                    transform: `scaleX(${underlineProgress.toFixed(3)})`,
                    transformOrigin: "left center",
                    opacity: 0.85,
                  }}
                />
              ) : null}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ── Helpers ─────────────────────────────────────────────────────────────

interface VisibleWord extends CaptionWord {
  globalIdx: number;
}

/** Estimated width (px) of a single word at its target size. */
function wordWidth(word: string, isActive: boolean): number {
  const charPx = isActive ? AVG_CHAR_PX_ACTIVE : AVG_CHAR_PX_BODY;
  return word.length * charPx;
}

/**
 * Build the visible window. Pivot on the active word; alternately add
 * words to the right (upcoming) and left (spoken). Each word must FIT
 * entirely — no partial words.
 *
 * Returns a contiguous slice of `words` whose total measured width does
 * not exceed `maxContentWidth`.
 */
function buildVisibleWindow(
  words: CaptionWord[],
  activeIdx: number,
  maxWords: number,
  maxContentWidth: number,
): VisibleWord[] {
  if (words.length === 0 || activeIdx < 0 || activeIdx >= words.length) return [];

  const active = words[activeIdx]!;
  let usedWidth = wordWidth(active.word, true);
  let leftIdx = activeIdx;
  let rightIdx = activeIdx;

  // Try to add 1 upcoming + 1 spoken + 1 upcoming (or whatever fits).
  // Order: right first (matches natural reading flow / shows what's coming).
  let toggle: "right" | "left" = "right";
  while (rightIdx - leftIdx + 1 < maxWords) {
    if (toggle === "right" && rightIdx + 1 < words.length) {
      const candidate = words[rightIdx + 1]!;
      const cw = wordWidth(candidate.word, false) + WORD_GAP_PX;
      if (usedWidth + cw > maxContentWidth) break;
      rightIdx += 1;
      usedWidth += cw;
    } else if (toggle === "left" && leftIdx - 1 >= 0) {
      const candidate = words[leftIdx - 1]!;
      const cw = wordWidth(candidate.word, false) + WORD_GAP_PX;
      if (usedWidth + cw > maxContentWidth) break;
      leftIdx -= 1;
      usedWidth += cw;
    } else if (toggle === "right" && rightIdx + 1 >= words.length && leftIdx > 0) {
      // No more right candidates, try left this turn.
      toggle = "left";
      continue;
    } else if (toggle === "left" && leftIdx === 0 && rightIdx + 1 < words.length) {
      toggle = "right";
      continue;
    } else {
      break;
    }
    toggle = toggle === "right" ? "left" : "right";
  }

  return words.slice(leftIdx, rightIdx + 1).map((w, i) => ({
    ...w,
    globalIdx: leftIdx + i,
  }));
}

/**
 * Overshoot pop curve for the active word.
 * Frame 0  → 1.00 (starts at size)
 * Frame 2  → 1.12 (peak overshoot)
 * Frame 6  → 1.00 (settled)
 * After    → 1.00 + tiny breathe
 */
function activePopScale(ageFrames: number, durationFrames: number): number {
  if (ageFrames < 0) return 1;
  if (ageFrames >= durationFrames) {
    // Tiny breathe after the pop so the active word feels alive.
    const breathe = Math.sin((ageFrames - durationFrames) * 0.10) * 0.012;
    return 1 + breathe;
  }
  const t = ageFrames / durationFrames;
  // Quadratic up then settle: 0 → 1 (peak at t=0.3)
  const peak = 0.12;
  const settle = 1 + peak * Math.sin(t * Math.PI);
  return settle;
}
