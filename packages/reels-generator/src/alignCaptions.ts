/**
 * alignCaptions — produce word-level caption timings whose tokens are the
 * GROUND-TRUTH script (never a STT guess) but whose timestamps come from
 * Google Cloud Speech-to-Text forced-alignment of Sandra's voiceover.
 *
 * Why this exists: v1 ran Google STT (described in code as Whisper for legacy
 * reasons) on Sandra's synthesized audio and burned the recognizer's words
 * into the video. That produced visible errors: "sisters in public house"
 * instead of "Sisters in Public Health", "2026 montant mon précisé" gibberish.
 *
 * Fix: the script Sandra reads is fully known upstream. We don't need the
 * recognizer to recover the words — we only need it to tell us WHEN each
 * word is spoken. We feed the ground-truth script as the recognition
 * `prompt` (which biases the recognizer toward the supplied text), then we
 * THROW AWAY the returned `word` strings and re-pair the timestamps with the
 * ground-truth tokens positionally.
 *
 * If the recognizer returns a wildly different word count (off by more than
 * ±2 tokens) we fall back to time-proportional splitting — each token gets a
 * duration proportional to its character length, summed across the audio.
 *
 * The Reel never displays a word that wasn't in the original script.
 *
 * Output shape is identical to the legacy `transcribeForCaptions` so existing
 * callers (`composeReel`, `buildReel`) consume it with no API change.
 */

import { promises as fs } from "node:fs";
import type { CaptionWord } from "./templates/types.js";

export interface AlignCaptionsInput {
  audioPath: string;
  /** The full ground-truth voiceover Sandra reads. Required. */
  scriptText: string;
  /** BCP-47 language hint. Defaults to "fr-FR". */
  language?: string;
  /**
   * Optional explicit total duration in seconds, used by the proportional
   * fallback when the recognizer returns no timestamps. If omitted we probe
   * the audio file via ffprobe; if that fails, we estimate from token count.
   */
  audioDurationSec?: number;
}

export interface AlignCaptionsResult {
  /** Word timings whose `.word` field is always a ground-truth token. */
  words: CaptionWord[];
  /** Total audio duration (seconds) derived from the alignment. */
  durationSec: number;
  /** Estimated USD cost based on durationSec @ STT pricing. */
  estimatedCostUsd: number;
  /** Recognizer model. */
  model: string;
  /** Diagnostic — which alignment path produced these timings. */
  alignment: AlignmentDiagnostic;
}

export interface AlignmentDiagnostic {
  method: "stt-prompt" | "proportional-fallback";
  scriptTokens: number;
  /** Token count returned by the recognizer, before re-pairing. */
  recognizerTokens: number;
  /** |scriptTokens - recognizerTokens|. */
  mismatch: number;
  /** True iff we used `prompt` to bias the recognizer. */
  promptApplied: boolean;
}

const STT_ENDPOINT = "https://speech.googleapis.com/v1/speech:recognize";
const PRICE_PER_MINUTE = 0.024; // STT v1 standard
const STT_MODEL = "latest_long";
/** Re-paired word count tolerance — beyond this we fall back to proportional. */
const MISMATCH_TOLERANCE = 2;

function resolveApiKey(): string | undefined {
  return (
    process.env.GOOGLE_STT_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    process.env.GOOGLE_VISION_API_KEY ??
    process.env.GOOGLE_TTS_API_KEY
  );
}

/**
 * Forced-alignment caption pipeline. See module-level docstring.
 */
export async function alignCaptions(
  input: AlignCaptionsInput,
): Promise<AlignCaptionsResult> {
  const language = input.language ?? "fr-FR";
  const scriptTokens = tokenizeScript(input.scriptText);

  if (scriptTokens.length === 0) {
    throw new Error("alignCaptions: empty scriptText — cannot align captions.");
  }

  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new Error(
      "alignCaptions: no Google STT API key found. Set GOOGLE_STT_API_KEY (or GOOGLE_API_KEY).",
    );
  }

  const audio = await fs.readFile(input.audioPath);
  const audioBase64 = audio.toString("base64");

  const url = `${STT_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;

  // `speechContexts.phrases` is Google STT's equivalent of Whisper's `prompt`.
  // It biases recognition toward the supplied phrases and dramatically reduces
  // errors on proper nouns ("Sisters in Public Health") and rare phrases.
  const speechContexts = buildSpeechContexts(input.scriptText, scriptTokens);

  let recognizerWords: RecognizerWord[] = [];
  let recognizerOk = false;
  try {
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
          speechContexts,
        },
        audio: { content: audioBase64 },
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as GoogleSttResponse;
      recognizerWords = flattenSttWords(data);
      recognizerOk = true;
    } else {
      const body = await res.text().catch(() => "");
      console.warn(
        `[alignCaptions] STT ${res.status} — falling back to proportional split. ${body.slice(0, 200)}`,
      );
    }
  } catch (err) {
    console.warn(
      `[alignCaptions] STT request failed — falling back to proportional split: ${(err as Error).message}`,
    );
  }

  const mismatch = Math.abs(recognizerWords.length - scriptTokens.length);
  const audioDurationSec =
    input.audioDurationSec ??
    (recognizerWords.length > 0
      ? recognizerWords[recognizerWords.length - 1]!.end
      : estimateDurationFromTokens(scriptTokens.length));

  let words: CaptionWord[];
  let method: AlignmentDiagnostic["method"];

  if (recognizerOk && recognizerWords.length > 0 && mismatch <= MISMATCH_TOLERANCE) {
    // ── Happy path: re-pair recognizer timestamps with ground-truth tokens.
    //
    // When the counts are within ±2 we pair them positionally up to the
    // shorter length, then stretch/clamp the last token to cover the audio
    // tail. We never copy the recognizer's `word` string — only `start`/`end`.
    words = repairTimestampsWithGroundTruth(scriptTokens, recognizerWords);
    method = "stt-prompt";
  } else {
    // ── Fallback: proportional split by character length.
    words = proportionalSplit(scriptTokens, audioDurationSec);
    method = "proportional-fallback";
  }

  // Pricing — Google STT bills in 15-second increments, rounded up.
  const billedSec = Math.ceil(Math.max(audioDurationSec, 1) / 15) * 15;
  const estimatedCostUsd = Number(
    ((billedSec / 60) * PRICE_PER_MINUTE).toFixed(6),
  );

  const alignment: AlignmentDiagnostic = {
    method,
    scriptTokens: scriptTokens.length,
    recognizerTokens: recognizerWords.length,
    mismatch,
    promptApplied: recognizerOk,
  };

  // Structured one-line log for observability.
  console.info(
    `[alignCaptions] captionAlignment ${JSON.stringify({ method, scriptTokens: alignment.scriptTokens, recognizerTokens: alignment.recognizerTokens, mismatch: alignment.mismatch })}`,
  );

  return {
    words,
    durationSec: words[words.length - 1]?.end ?? audioDurationSec,
    estimatedCostUsd,
    model: STT_MODEL,
    alignment,
  };
}

// ── Token helpers ──────────────────────────────────────────────────────

/**
 * Split a French script into caption tokens. We keep trailing punctuation
 * attached to the preceding word (e.g. "rate," "demain.") because that's how
 * the caption bar reads naturally — separating punctuation would create
 * orphan tokens that flicker on screen.
 */
export function tokenizeScript(script: string): string[] {
  return script
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function buildSpeechContexts(
  scriptText: string,
  tokens: string[],
): Array<{ phrases: string[]; boost?: number }> {
  // Google STT speech contexts cap at ~5000 chars across phrases. We supply:
  //  1. the full script as one phrase (boost 20 — strongly biases recognition),
  //  2. proper-noun tokens (capitalized words longer than 3 chars) as separate
  //     phrases with a higher individual boost so the recognizer prefers them
  //     over phonetically-similar alternatives.
  const properNouns = Array.from(
    new Set(
      tokens
        .filter((t) => /^[A-ZÀ-ÖØ-Þ][\p{L}-]{2,}/u.test(t))
        .map((t) => t.replace(/[^\p{L}-]/gu, "")),
    ),
  ).slice(0, 32);

  // Google STT limits each individual phrase to 100 characters.
  // Split the script at word boundaries into ≤100-char chunks.
  const words = scriptText.split(/\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > 100) {
      if (current) chunks.push(current);
      current = w.slice(0, 100);
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return [
    { phrases: chunks.slice(0, 50), boost: 20 },
    ...(properNouns.length > 0 ? [{ phrases: properNouns, boost: 15 }] : []),
  ];
}

interface RecognizerWord {
  start: number;
  end: number;
}

function flattenSttWords(data: GoogleSttResponse): RecognizerWord[] {
  const out: RecognizerWord[] = [];
  for (const result of data.results ?? []) {
    const alt = result.alternatives?.[0];
    if (!alt?.words) continue;
    for (const w of alt.words) {
      out.push({
        start: parseDurationSec(w.startTime),
        end: parseDurationSec(w.endTime),
      });
    }
  }
  return out;
}

function repairTimestampsWithGroundTruth(
  scriptTokens: string[],
  recognizer: RecognizerWord[],
): CaptionWord[] {
  const out: CaptionWord[] = [];
  const audioEnd = recognizer[recognizer.length - 1]?.end ?? 0;
  for (let i = 0; i < scriptTokens.length; i++) {
    const rw = recognizer[i];
    if (rw) {
      out.push({ word: scriptTokens[i]!, start: rw.start, end: rw.end });
      continue;
    }
    // Script has more tokens than recognizer returned — stretch remaining
    // tokens evenly across whatever audio time is left after the last word.
    const lastEnd = out[out.length - 1]?.end ?? 0;
    const remainingTokens = scriptTokens.length - i;
    const remainingTime = Math.max(0.1, audioEnd - lastEnd);
    const per = remainingTime / remainingTokens;
    for (let j = 0; j < remainingTokens; j++) {
      const start = lastEnd + j * per;
      out.push({
        word: scriptTokens[i + j]!,
        start,
        end: start + per,
      });
    }
    break;
  }
  return out;
}

function proportionalSplit(tokens: string[], audioDurationSec: number): CaptionWord[] {
  const safeDur = Math.max(audioDurationSec, tokens.length * 0.15);
  const totalChars = tokens.reduce((sum, t) => sum + Math.max(1, t.length), 0);
  let cursor = 0;
  return tokens.map((t) => {
    const share = Math.max(1, t.length) / totalChars;
    const dur = safeDur * share;
    const start = cursor;
    cursor += dur;
    return { word: t, start, end: cursor };
  });
}

function estimateDurationFromTokens(tokenCount: number): number {
  // Sandra cadence ≈ 2.5 words/sec → ~0.4 s per word. Conservative floor 1s.
  return Math.max(1, tokenCount * 0.4);
}

function parseDurationSec(
  d: string | { seconds?: string | number; nanos?: number } | undefined,
): number {
  if (d === undefined || d === null) return 0;
  if (typeof d === "string") {
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
