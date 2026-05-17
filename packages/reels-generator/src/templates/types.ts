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
