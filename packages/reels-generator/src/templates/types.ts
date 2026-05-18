/**
 * Shared composition props passed into every template.
 *
 * `audioSrc` is the URL of Sandra's MP3 voiceover. The composition mounts
 * a single <Audio> tag with this src, then layers SFX on top via
 * <SfxLayer />. Templates do NOT mount audio themselves — they only render
 * visuals. Mixing happens at the Composition level.
 */

import type { ReelTopic, ReelLanguage } from "../types.js";

export interface CaptionWord {
  word: string;
  /** Start time in seconds, from the start of the voiceover. */
  start: number;
  /** End time in seconds. */
  end: number;
}

/**
 * Stock footage clip — picked by `pickStockFootage()` and resolved to an
 * accessible URL before render. Templates that use clips treat them as a
 * looping background; all clips are pre-trimmed to portrait orientation.
 */
export interface ResolvedClip {
  url: string;
  /** Duration in seconds — informational only; we always loop. */
  durationSec: number;
  /** Source attribution text rendered in the corner credit. */
  credit: string;
}

/**
 * Common props every template receives. Template-specific props extend
 * this and are documented in each template file.
 */
export interface BaseTemplateProps {
  topic: ReelTopic;
  language: ReelLanguage;
  /** Sandra's voiceover audio URL (mp3). */
  audioSrc: string;
  /** Total voiceover duration in seconds — drives composition length. */
  durationSec: number;
  /** Word-level captions from Whisper. */
  captions: CaptionWord[];
  /** Pre-resolved stock clips (templates use 0..N depending on layout). */
  clips: ResolvedClip[];
  /** Today's date in the source language — rendered on intro/outro. */
  dateLabel: string;
  /** Source publication / author for credit footer. */
  sourceLabel?: string;
  /**
   * v1.6 — Canonical clickable URL where the viewer can actually act
   * (apply, register, read full article). For aggregated content this is
   * the ORIGINAL publisher URL (e.g. royalsociety.org), NOT edlight.news.
   * Rendered on the CTA scene as the destination handoff.
   */
  sourceUrl?: string;
  /**
   * v1.6 — Display-ready source domain (e.g. "royalsociety.org") derived
   * from sourceUrl. Used by CtaScene + source-attribution chips so the
   * viewer always knows where the information came from. When absent,
   * scenes degrade gracefully (omit the chip, fall back to edlight.news
   * on the CTA).
   */
  sourceDomain?: string;
  /**
   * v1.6 — Actual body length in frames (after the composer scales it to
   * the audio length). Directors use this with `scaleSceneDurations()` to
   * absorb the audio overhang into the CTA scene instead of leaving a
   * solid-color void at the tail.
   */
  bodyDurationFrames?: number;
}

// ── v1.6: shared scene-duration scaler ─────────────────────────────────
//
// Every body director sums its baseline scene durations to ~390 frames
// (13 s). When the actual audio is longer (up to MAX_REEL_SEC = 20 s) the
// composer extends `bodyFrames` to match — but if the director keeps its
// fixed 390 f scene list, the final 3 s render onto the parent wrapper's
// default backgroundColor (solid `palette.primary`) producing the
// "blue void" tail. This helper proportionally absorbs the extra (or
// shortfall) into the chosen padding scene (the CTA by default), keeping
// the carefully-tuned shorter scenes intact.

/**
 * Scale a baseline DirectorSpec to exactly `totalFrames` by absorbing the
 * delta into `padIndex` (defaults to the last scene = CTA). When total
 * is shorter than the baseline, scales all scenes down proportionally.
 */
export function scaleSceneDurations(
  baseline: DirectorSpec,
  totalFrames: number,
  padIndex: number = baseline.length - 1,
): SceneSpec[] {
  const baseTotal = baseline.reduce((s, x) => s + x.durationFrames, 0);
  if (totalFrames <= 0 || baseTotal <= 0) {
    return baseline.map((s) => ({ ...s }));
  }
  const delta = totalFrames - baseTotal;
  if (delta === 0) return baseline.map((s) => ({ ...s }));

  if (delta > 0) {
    // Audio longer than baseline — pad the CTA scene with the slack so the
    // viewer dwells on the actionable info, not a blue wrapper.
    return baseline.map((s, i) => ({
      ...s,
      durationFrames: i === padIndex ? s.durationFrames + delta : s.durationFrames,
    }));
  }

  // Audio shorter than baseline — proportional scale, but every scene gets
  // at least 30 frames (1 s) so transitions remain perceptible.
  const ratio = totalFrames / baseTotal;
  const MIN_FRAMES = 30;
  const scaled = baseline.map((s) => ({
    ...s,
    durationFrames: Math.max(MIN_FRAMES, Math.round(s.durationFrames * ratio)),
  }));
  // Trim/extend the pad scene to land exactly on totalFrames.
  const sum = scaled.reduce((acc, x) => acc + x.durationFrames, 0);
  const drift = totalFrames - sum;
  if (drift !== 0 && scaled[padIndex]) {
    scaled[padIndex] = {
      ...scaled[padIndex]!,
      durationFrames: Math.max(MIN_FRAMES, scaled[padIndex]!.durationFrames + drift),
    };
  }
  return scaled;
}

// ── Scene-cut architecture (v1.3) ─────────────────────────────────────────
//
// Every body template is now a "director" that arranges short scene
// components separated by hard cuts. The CaptionBar lives outside all
// Sequences so karaoke captions flow continuously across cuts.

/**
 * One scene in a director's cut plan.
 *
 * `durationFrames` is authoritative — the director sums these to determine
 * total body duration. All four directors target 360–480 frames (12–16s
 * at 30fps) so Sandra's voiced script has enough room.
 */
export interface SceneSpec {
  /** Unique stable key (used as Sequence key prop). */
  id: string;
  /** Duration in frames at FRAME.fps (30). */
  durationFrames: number;
}

/**
 * A director maps a template's render props onto a list of SceneSpecs.
 * The durations are the ONLY thing the director controls; the parent
 * template wires the actual scene components.
 *
 * Usage pattern in each template:
 *   ```tsx
 *   const SCENES: SceneSpec[] = [
 *     { id: "hook",    durationFrames: 90  },
 *     { id: "hero",    durationFrames: 120 },
 *     { id: "context", durationFrames: 120 },
 *     { id: "cta",     durationFrames: 60  },  // 390f total
 *   ];
 *   ```
 *
 * The parent template renders each scene inside a Remotion `<Sequence>`
 * positioned at the cumulative frame offset. `useCurrentFrame()` inside
 * the scene returns the sequence-local frame (0 → durationFrames-1).
 */
export type DirectorSpec = readonly SceneSpec[];
