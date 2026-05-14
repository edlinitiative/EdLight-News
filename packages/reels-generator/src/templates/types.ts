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
