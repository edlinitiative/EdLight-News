/**
 * transcribeForCaptions — runs Whisper on Sandra's voiceover and returns
 * word-level timestamps suitable for the karaoke `Captions` component.
 *
 * Uses raw fetch against OpenAI's audio.transcriptions endpoint with
 * `timestamp_granularities=["word"]` and `response_format=verbose_json`.
 * No SDK dependency — matches house style elsewhere.
 *
 * Pricing (whisper-1 as of 2025-01): $0.006 per minute of audio.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { CaptionWord } from "./templates/types.js";

export interface TranscribeResult {
  words: CaptionWord[];
  /** Total audio duration in seconds reported by Whisper. */
  durationSec: number;
  /** Estimated USD cost based on durationSec @ $0.006/min. */
  estimatedCostUsd: number;
  /** Model used. */
  model: string;
}

const OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions";
const PRICE_PER_MINUTE = 0.006; // whisper-1

/**
 * Transcribe an MP3 file and return word-level timing info.
 *
 * @param audioPath Absolute path to the audio file written by `synthesizeVoice`.
 * @param language  ISO-639-1 hint. Defaults to "fr". Sandra speaks French.
 */
export async function transcribeForCaptions(
  audioPath: string,
  language: string = "fr",
): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("transcribeForCaptions: OPENAI_API_KEY is not set.");
  }

  const audio = await fs.readFile(audioPath);
  const filename = path.basename(audioPath);

  // Build multipart form data manually — fetch's FormData works in Node 18+.
  const form = new FormData();
  form.append("file", new Blob([audio], { type: "audio/mpeg" }), filename);
  form.append("model", "whisper-1");
  form.append("language", language);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");

  const res = await fetch(OPENAI_TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`transcribeForCaptions: Whisper ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as WhisperVerboseResponse;

  const words: CaptionWord[] = (data.words ?? []).map((w) => ({
    word: w.word,
    start: w.start,
    end: w.end,
  }));

  if (words.length === 0) {
    // Fallback: split the transcript into approx-even chunks so captions still
    // render even if the API didn't return word timings (rare but possible).
    const text = data.text ?? "";
    const tokens = text.split(/\s+/).filter(Boolean);
    const dur = data.duration ?? Math.max(1, tokens.length * 0.35);
    const per = dur / Math.max(1, tokens.length);
    tokens.forEach((tok, i) => {
      words.push({ word: tok, start: i * per, end: (i + 1) * per });
    });
  }

  const durationSec = data.duration ?? words[words.length - 1]?.end ?? 0;
  const estimatedCostUsd = Number(((durationSec / 60) * PRICE_PER_MINUTE).toFixed(6));

  return {
    words,
    durationSec,
    estimatedCostUsd,
    model: "whisper-1",
  };
}

interface WhisperVerboseResponse {
  text?: string;
  duration?: number;
  words?: Array<{ word: string; start: number; end: number }>;
}
