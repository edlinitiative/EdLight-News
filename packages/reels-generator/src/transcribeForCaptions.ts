/**
 * transcribeForCaptions — runs Google Cloud Speech-to-Text v1 sync
 * recognize on Sandra's voiceover and returns word-level timestamps
 * suitable for the karaoke `Captions` component.
 *
 * Uses raw fetch against `speech.googleapis.com/v1/speech:recognize`
 * with `enableWordTimeOffsets: true`. No SDK dependency — matches
 * house style.
 *
 * Why sync recognize: Reels are capped at 30 s of voiceover (well under
 * the 60 s sync recognize limit). Long-running async recognize would add
 * polling complexity for no benefit at this length.
 *
 * Pricing (Google Cloud STT v1 standard models, as of 2025-01):
 *   $0.024 per minute (rounded up to the next 15-second increment).
 *   Free tier: 60 min / month.
 *   For a 30 s reel that's ~$0.012/reel — well inside the $1/day cap.
 */

import { promises as fs } from "node:fs";
import type { CaptionWord } from "./templates/types.js";

export interface TranscribeResult {
  words: CaptionWord[];
  /** Total audio duration in seconds (computed from last word offset). */
  durationSec: number;
  /** Estimated USD cost based on durationSec @ $0.024/min (15-s increments). */
  estimatedCostUsd: number;
  /** Model used. */
  model: string;
}

const STT_ENDPOINT = "https://speech.googleapis.com/v1/speech:recognize";
const PRICE_PER_MINUTE = 0.024; // STT v1 standard
const STT_MODEL = "latest_long"; // good general-purpose model w/ punctuation

function resolveApiKey(): string | undefined {
  return (
    process.env.GOOGLE_STT_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GOOGLE_VISION_API_KEY ??
    process.env.GOOGLE_TTS_API_KEY
  );
}

/**
 * Transcribe an MP3 file and return word-level timing info via Google
 * Cloud Speech-to-Text.
 *
 * @param audioPath Absolute path to the audio file written by `synthesizeVoice`.
 * @param language  BCP-47 hint. Defaults to "fr-FR". Sandra speaks French.
 */
export async function transcribeForCaptions(
  audioPath: string,
  language: string = "fr-FR",
): Promise<TranscribeResult> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      "transcribeForCaptions: no Google STT API key found. Set GOOGLE_STT_API_KEY (or GOOGLE_API_KEY).",
    );
  }

  const audio = await fs.readFile(audioPath);
  const audioBase64 = audio.toString("base64");

  const url = `${STT_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      config: {
        encoding: "MP3",
        languageCode: language,
        enableWordTimeOffsets: true,
        enableAutomaticPunctuation: true,
        model: STT_MODEL,
      },
      audio: { content: audioBase64 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `transcribeForCaptions: Google STT ${res.status}: ${body.slice(0, 300)}`,
    );
  }

  const data = (await res.json()) as GoogleSttResponse;

  // Flatten all word lists across all results (typically just one).
  const words: CaptionWord[] = [];
  let transcriptText = "";
  for (const result of data.results ?? []) {
    const alt = result.alternatives?.[0];
    if (!alt) continue;
    if (alt.transcript) transcriptText += `${alt.transcript} `;
    for (const w of alt.words ?? []) {
      words.push({
        word: w.word,
        start: parseDurationSec(w.startTime),
        end: parseDurationSec(w.endTime),
      });
    }
  }

  if (words.length === 0) {
    // Fallback: split the transcript into approx-even chunks so captions
    // still render even if Google didn't return word timings (rare but
    // possible — e.g. very short audio that under-recognized).
    const tokens = transcriptText.trim().split(/\s+/).filter(Boolean);
    const dur = Math.max(1, tokens.length * 0.35);
    const per = dur / Math.max(1, tokens.length);
    tokens.forEach((tok, i) => {
      words.push({ word: tok, start: i * per, end: (i + 1) * per });
    });
  }

  const durationSec =
    words[words.length - 1]?.end ?? 0;

  // Google bills in 15-second increments, rounded up.
  const billedSec = Math.ceil(durationSec / 15) * 15;
  const estimatedCostUsd = Number(
    ((billedSec / 60) * PRICE_PER_MINUTE).toFixed(6),
  );

  return {
    words,
    durationSec,
    estimatedCostUsd,
    model: STT_MODEL,
  };
}

/**
 * Google returns durations as a string like `"1.234s"` (or sometimes a
 * proto-style `{seconds, nanos}` object). Parse to seconds (float).
 */
function parseDurationSec(d: string | { seconds?: string | number; nanos?: number } | undefined): number {
  if (d === undefined || d === null) return 0;
  if (typeof d === "string") {
    // "1.234s" or "1s"
    const m = d.match(/^([0-9.]+)s$/);
    return m ? Number(m[1]) : 0;
  }
  const sec = Number(d.seconds ?? 0);
  const nanos = Number(d.nanos ?? 0);
  return sec + nanos / 1e9;
}

interface GoogleSttResponse {
  results?: Array<{
    alternatives?: Array<{
      transcript?: string;
      confidence?: number;
      words?: Array<{
        word: string;
        startTime?: string | { seconds?: string | number; nanos?: number };
        endTime?: string | { seconds?: string | number; nanos?: number };
      }>;
    }>;
  }>;
}
