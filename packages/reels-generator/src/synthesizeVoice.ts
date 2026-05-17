/**
 * synthesizeVoice — thin wrapper around `@edlight-news/sandra-voice` that
 * adds:
 *  - Cost tracking (returns input chars + estimated USD)
 *  - File output (writes to a tmp path so Remotion's renderMedia can mount it)
 *  - Defensive cleanup of trailing whitespace / SSML-like artifacts
 *
 * Sandra TTS pricing (Google Cloud Text-to-Speech as of 2025-01):
 *   Neural2 / WaveNet voices: $16 per 1M characters (free tier: 1M / month)
 *   Studio voices:            $160 per 1M characters
 *   Standard voices:          $4 per 1M characters
 * We surface the resolved voice in the cost breakdown so the daily
 * ceiling check in `pullSocialMetrics` stays accurate.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { speakAsSandra, SANDRA_VOICE } from "@edlight-news/sandra-voice";

export interface SynthesizeVoiceResult {
  /** Absolute path to the rendered MP3 file. */
  audioPath: string;
  /** Raw audio bytes (also written to `audioPath`). */
  audioBytes: number;
  /** Number of input characters billed. */
  charactersBilled: number;
  /** Estimated USD cost. */
  estimatedCostUsd: number;
  /** Resolved voice tier (e.g. "neural2", "wavenet", "studio", "standard"). */
  voiceTier: string;
  /** Resolved voice name. */
  voice: string;
}

/**
 * Per-million-character pricing by Google Cloud TTS voice tier.
 * Tier is inferred from the voice name (e.g. `fr-FR-Neural2-C`).
 */
const PRICE_PER_MILLION_CHARS: Record<string, number> = {
  standard: 4.0,
  wavenet: 16.0,
  neural2: 16.0,
  polyglot: 16.0,
  news: 16.0,
  studio: 160.0,
  chirp: 16.0, // Chirp HD pricing TBD; treat as Neural2-equivalent.
};

function inferVoiceTier(voiceName: string): string {
  const lower = voiceName.toLowerCase();
  if (lower.includes("studio")) return "studio";
  // Chirp HD / Chirp 3 — must come before generic 'chirp' check.
  if (lower.includes("chirp3") || lower.includes("chirp-hd") || lower.includes("chirp_hd")) return "chirp";
  if (lower.includes("neural2")) return "neural2";
  if (lower.includes("wavenet")) return "wavenet";
  if (lower.includes("polyglot")) return "polyglot";
  if (lower.includes("news")) return "news";
  if (lower.includes("chirp")) return "chirp";
  return "standard";
}

/**
 * Synthesize Sandra's voiceover and persist it to a tmp file.
 *
 * @param text   The voiceover script. Stripped of leading/trailing ws.
 * @param reelId Used to namespace the tmp file so concurrent reels don't clash.
 *
 * Speaking rate: controlled globally by `SANDRA_TTS_SPEAKING_RATE` (default 1.0)
 * or overridden for Reels specifically via `REELS_SANDRA_SPEAKING_RATE` (default
 * 1.1 when set). Reels target 12–16 s; at 1.1× Sandra delivers ~55 words in 13s.
 * Set `REELS_SANDRA_SPEAKING_RATE=1.1` in the worker Cloud Run service to activate.
 */
export async function synthesizeVoice(
  text: string,
  reelId: string,
): Promise<SynthesizeVoiceResult> {
  const cleaned = sanitizeForTts(text);
  if (cleaned.length === 0) {
    throw new Error("synthesizeVoice: empty text after cleanup.");
  }

  // Task 6: Reels-specific speaking rate override.
  // `REELS_SANDRA_SPEAKING_RATE` takes precedence over the global Sandra rate.
  // When not set we use the default SANDRA_VOICE.speakingRate from config.ts.
  const reelsRate = process.env.REELS_SANDRA_SPEAKING_RATE;
  const speakingRateOverride = reelsRate !== undefined
    ? { speakingRate: Number(reelsRate) }
    : undefined;

  const audio = await speakAsSandra(cleaned, {
    ...(speakingRateOverride ? { voiceOverride: speakingRateOverride } : {}),
  });

  // Write to OS tmp dir under a reels subdir we own.
  const dir = path.join(os.tmpdir(), "edlight-reels", reelId);
  await fs.mkdir(dir, { recursive: true });
  const audioPath = path.join(dir, "voiceover.mp3");
  await fs.writeFile(audioPath, audio);

  const voice = SANDRA_VOICE.voice;
  const voiceTier = inferVoiceTier(voice);
  const pricePerMillion = PRICE_PER_MILLION_CHARS[voiceTier] ?? 16.0;
  const estimatedCostUsd = (cleaned.length / 1_000_000) * pricePerMillion;

  return {
    audioPath,
    audioBytes: audio.length,
    charactersBilled: cleaned.length,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    voiceTier,
    voice,
  };
}

/**
 * Strip artifacts that confuse TTS:
 *  - SSML-like tags (Sandra's voice config doesn't use SSML)
 *  - Markdown emphasis markers
 *  - Hashtags (those go in the caption, not the voiceover)
 *  - Excess whitespace
 */
function sanitizeForTts(text: string): string {
  return text
    .replace(/<[^>]+>/g, "") // SSML / HTML tags
    .replace(/[*_`]+/g, "") // markdown emphasis
    .replace(/#\w+/g, "") // hashtags
    .replace(/\s+/g, " ")
    .trim();
}
