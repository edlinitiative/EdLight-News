/**
 * Sandra's voice configuration — single source of truth.
 *
 * Both the Sandra app (sandra.edlight.org) and the EdLight News Reels
 * worker import from here so that any future voice change automatically
 * propagates to every surface where Sandra speaks.
 *
 * Provider: **Google Cloud Text-to-Speech**.
 * Why Google: we already use Gemini + Google Vision; one billing
 * account; Neural2 French voices are excellent and price-competitive
 * ($16 / 1M chars) versus OpenAI tts-1-hd ($30 / 1M).
 *
 * Env overrides (all optional):
 *   SANDRA_TTS_VOICE          — defaults to "fr-FR-Neural2-C" (warm female FR)
 *   SANDRA_TTS_LANGUAGE_CODE  — defaults to "fr-FR"
 *   SANDRA_TTS_SPEAKING_RATE  — defaults to "1.0" (range 0.25–4.0)
 *   SANDRA_TTS_PITCH          — defaults to "0.0" (range -20.0–20.0 semitones)
 *   SANDRA_TTS_AUDIO_ENCODING — defaults to "MP3" (Reels needs MP3 for ffmpeg)
 *
 * If you change the defaults below, update docs/SANDRA_VOICE_PROFILE.md
 * and notify the Sandra team — this is brand-defining audio.
 */

export type SandraTtsAudioEncoding =
  | "MP3"
  | "OGG_OPUS"
  | "LINEAR16"
  | "MULAW"
  | "ALAW";

export interface SandraVoiceConfig {
  /**
   * Google Cloud TTS voice name.
   * `fr-FR-Neural2-C` = warm, mid-range female, French (France).
   * Browse: https://cloud.google.com/text-to-speech/docs/voices
   */
  readonly voice: string;
  /** BCP-47 language code. Must match the voice region. */
  readonly languageCode: string;
  /** Speaking rate (0.25 – 4.0). 1.0 = natural. */
  readonly speakingRate: number;
  /** Pitch in semitones (-20.0 – 20.0). 0 = natural. */
  readonly pitch: number;
  /** Audio container/codec. Reels uses MP3 for ffmpeg compatibility. */
  readonly audioEncoding: SandraTtsAudioEncoding;
}

export const SANDRA_VOICE: SandraVoiceConfig = Object.freeze({
  voice: process.env.SANDRA_TTS_VOICE ?? "fr-FR-Neural2-C",
  languageCode: process.env.SANDRA_TTS_LANGUAGE_CODE ?? "fr-FR",
  speakingRate: Number(process.env.SANDRA_TTS_SPEAKING_RATE ?? "1.0"),
  pitch: Number(process.env.SANDRA_TTS_PITCH ?? "0.0"),
  audioEncoding:
    (process.env.SANDRA_TTS_AUDIO_ENCODING as SandraTtsAudioEncoding) ?? "MP3",
});
