/**
 * Sandra's voice configuration — single source of truth.
 *
 * Both the Sandra app (sandra.edlight.org) and the EdLight News Reels
 * worker import from here so that any future voice change automatically
 * propagates to every surface where Sandra speaks.
 *
 * Env overrides (all optional):
 *   SANDRA_TTS_MODEL  — defaults to "tts-1-hd"
 *   SANDRA_TTS_VOICE  — defaults to "nova"  (warm female, multilingual)
 *   SANDRA_TTS_SPEED  — defaults to "1.0"
 *
 * If you change the defaults below, update docs/SANDRA_VOICE_PROFILE.md
 * and notify the Sandra team — this is brand-defining audio.
 */

export type SandraTtsFormat = "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";

export interface SandraVoiceConfig {
  /** OpenAI TTS model — `tts-1` (faster) or `tts-1-hd` (higher quality). */
  readonly model: string;
  /** OpenAI voice id. `nova` is warm, multilingual, and works for FR/Kreyòl. */
  readonly voice: string;
  /** Playback speed multiplier (0.25 – 4.0). 1.0 = natural. */
  readonly speed: number;
  /** Output container/codec. Reels uses mp3 for ffmpeg compatibility. */
  readonly format: SandraTtsFormat;
}

export const SANDRA_VOICE: SandraVoiceConfig = Object.freeze({
  model: process.env.SANDRA_TTS_MODEL ?? "tts-1-hd",
  voice: process.env.SANDRA_TTS_VOICE ?? "nova",
  speed: Number(process.env.SANDRA_TTS_SPEED ?? "1.0"),
  format: "mp3",
});
