/**
 * synthesizeVoice — thin wrapper around `@edlight-news/sandra-voice` that
 * adds:
 *  - Cost tracking (returns input chars + estimated USD)
 *  - File output (writes to a tmp path so Remotion's renderMedia can mount it)
 *  - Defensive cleanup of trailing whitespace / SSML-like artifacts
 *
 * Sandra TTS pricing (OpenAI tts-1-hd as of 2025-01): $30 per 1M characters.
 * tts-1 (non-HD) is $15 per 1M. We surface the model in the cost breakdown
 * so the daily ceiling check in `pullSocialMetrics` can stay accurate.
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
  /** Resolved model used. */
  model: string;
  /** Resolved voice used. */
  voice: string;
}

const PRICE_PER_MILLION_CHARS: Record<string, number> = {
  "tts-1": 15.0,
  "tts-1-hd": 30.0,
  // gpt-4o-mini-tts pricing TBD; default to tts-1-hd for safety until known.
};

/**
 * Synthesize Sandra's voiceover and persist it to a tmp file.
 *
 * @param text   The voiceover script. Stripped of leading/trailing ws.
 * @param reelId Used to namespace the tmp file so concurrent reels don't clash.
 */
export async function synthesizeVoice(
  text: string,
  reelId: string,
): Promise<SynthesizeVoiceResult> {
  const cleaned = sanitizeForTts(text);
  if (cleaned.length === 0) {
    throw new Error("synthesizeVoice: empty text after cleanup.");
  }

  const audio = await speakAsSandra(cleaned);

  // Write to OS tmp dir under a reels subdir we own.
  const dir = path.join(os.tmpdir(), "edlight-reels", reelId);
  await fs.mkdir(dir, { recursive: true });
  const audioPath = path.join(dir, "voiceover.mp3");
  await fs.writeFile(audioPath, audio);

  const model = SANDRA_VOICE.model;
  const pricePerMillion = PRICE_PER_MILLION_CHARS[model] ?? 30.0;
  const estimatedCostUsd = (cleaned.length / 1_000_000) * pricePerMillion;

  return {
    audioPath,
    audioBytes: audio.length,
    charactersBilled: cleaned.length,
    estimatedCostUsd: Number(estimatedCostUsd.toFixed(6)),
    model,
    voice: SANDRA_VOICE.voice,
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
