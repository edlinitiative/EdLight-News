/**
 * buildReel — top-level orchestrator. Single entrypoint the worker calls.
 *
 * Pipeline:
 *   1. pickTemplate(topic, dayOfWeek, itemId)         deterministic
 *   2. generateReelScript(...)                        LLM (cost: ~$0.001)
 *   3. synthesizeVoice(script.voiceover, reelId)      OpenAI TTS
 *   4. transcribeForCaptions(audioPath)               OpenAI Whisper
 *   5. pickStockFootage(topic, query)                 Pexels / Wikimedia / fallback
 *   6. composeReel(...)                               Remotion render
 *   7. return ReelArtifact for queue insertion
 *
 * Cost ceiling: callers should check the running daily total before invoking.
 * The result includes `cost` so the queue writer can update the running total.
 *
 * Failures are surfaced as thrown Errors with stage context. Partial success
 * is not supported — a reel either fully renders or fails entirely.
 */

import { randomUUID } from "node:crypto";
import { pickTemplate } from "./pickTemplate.js";
import {
  generateReelScript,
  type GenerateReelScriptInput,
  type ReelScript,
} from "./generateReelScript.js";
import { synthesizeVoice } from "./synthesizeVoice.js";
import { transcribeForCaptions } from "./transcribeForCaptions.js";
import { pickStockFootage, type StockClip } from "./pickStockFootage.js";
import { composeReel } from "./composeReel.js";
import type {
  ReelArtifact,
  ReelCostBreakdown,
  ReelMetrics,
  ReelTemplate,
  ReelTopic,
} from "./types.js";

export interface BuildReelInput {
  topic: ReelTopic;
  /** Source item driving the reel — see GenerateReelScriptInput for shape. */
  item: GenerateReelScriptInput["item"];
  /**
   * Optional URL of the article's own hero photo. Strongly recommended for
   * news/opportunity items — used as the reel's background instead of
   * generic Pexels b-roll for the `HeadlinePhoto` template.
   */
  imageUrl?: string;
  /** Optional context items for the LLM. */
  contextItems?: GenerateReelScriptInput["contextItems"];
  /** Day-of-week 0-6 for deterministic template rotation. Defaults to today UTC. */
  dayOfWeek?: number;
  /** Override the picked template (admin re-roll). */
  templateOverride?: ReelTemplate;
  /** Optional override for the Remotion entrypoint passed to composeReel. */
  remotionEntry?: string;
}

export interface BuildReelResult {
  /** A pending-review artifact ready for the queue. */
  artifact: ReelArtifact;
  /** Local filesystem path to the composed MP4. */
  videoPath: string;
  /** Local filesystem path to the synthesized voiceover MP3. */
  audioPath: string;
  /** Stock clips that were used (provenance for credits). */
  clips: StockClip[];
}

/**
 * Build one reel end-to-end.
 *
 * The returned `artifact` is NOT yet persisted — the caller (the worker job)
 * is responsible for uploading the MP4 to GCS and writing the Firestore doc.
 * This separation keeps `@edlight-news/reels-generator` pure: no Firebase or
 * GCS coupling.
 */
export async function buildReel(input: BuildReelInput): Promise<BuildReelResult> {
  const reelId = `reel_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const dow = input.dayOfWeek ?? new Date().getUTCDay();
  const template =
    input.templateOverride ?? pickTemplate(input.topic, dow, input.item.id);

  // ── 1+2. Script ──────────────────────────────────────────────────────────
  const scriptStart = Date.now();
  const script = await runStage("generateReelScript", () =>
    generateReelScript({
      topic: input.topic,
      template,
      item: input.item,
      contextItems: input.contextItems,
    }),
  );
  const scriptCostUsd = estimateScriptCost(script);
  const scriptMs = Date.now() - scriptStart;

  // ── 3+5. Voice and footage in parallel ───────────────────────────────
  // Voice synthesis (TTS network call, ~2-4s) and stock footage search
  // (Pexels API, ~1-3s) are independent of each other once the script is
  // ready. Running them concurrently saves the smaller of the two stages
  // (≈30% of pre-render wall time).
  const footageQuery = buildFootageQuery(input.topic, script);
  const [voice, clips] = await Promise.all([
    runStage("synthesizeVoice", () =>
      synthesizeVoice(script.voiceover, reelId),
    ),
    runStage("pickStockFootage", () =>
      pickStockFootage({ topic: input.topic, query: footageQuery, count: 3 }),
    ),
  ]);

  // ── 4. Captions (depends on voice) ───────────────────────────────────
  const transcript = await runStage("transcribeForCaptions", () =>
    transcribeForCaptions(voice.audioPath, "fr-FR"),
  );

  // ── 6. Compose ───────────────────────────────────────────────────────────
  const composed = await runStage("composeReel", () =>
    composeReel({
      reelId,
      topic: input.topic,
      template,
      script,
      audioPath: voice.audioPath,
      audioDurationSec: transcript.durationSec,
      clips,
      captions: transcript.words,      heroImageUrl: input.imageUrl,      remotionEntry: input.remotionEntry,
    }),
  );

  // ── 7. Cost breakdown ────────────────────────────────────────────────────
  const cost: ReelCostBreakdown = {
    scriptUsd: scriptCostUsd,
    voiceUsd: voice.estimatedCostUsd,
    transcriptionUsd: transcript.estimatedCostUsd,
    footageUsd: 0, // Pexels / Wikimedia are free; fallback is free.
    renderUsd: 0, // Self-rendered; only worker CPU time, not billable per-reel.
    totalUsd: Number(
      (
        scriptCostUsd +
        voice.estimatedCostUsd +
        transcript.estimatedCostUsd
      ).toFixed(6),
    ),
  };

  // Initial metrics — zeroed; populated later by pullSocialMetrics.
  const metrics: ReelMetrics = {
    plays: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    avgWatchTimeSec: 0,
    completionRate: 0,
  };

  const artifact: ReelArtifact = {
    id: reelId,
    topic: input.topic,
    template,
    status: "pending_review",
    language: "fr",
    sourceItemId: input.item.id,
    sourceItemTitle: input.item.title,
    sourceUrl: input.item.url,
    script,
    captionWords: transcript.words,
    clips: clips.map((c) => ({
      url: c.url,
      kind: c.kind,
      provider: c.provider,
      credit: c.credit,
      sourceUrl: c.sourceUrl,
    })),
    durationSec: composed.durationSec,
    videoBytes: composed.outputBytes,
    voiceTier: voice.voiceTier,
    voiceVoice: voice.voice,
    cost,
    metrics,
    timings: {
      scriptMs,
      totalMs: Date.now() - scriptStart,
    },
    createdAt: new Date().toISOString(),
    // The queue writer fills in `videoUrl` after uploading to GCS.
    videoUrl: undefined,
    captionDraft: script.caption,
  };

  return {
    artifact,
    videoPath: composed.outputPath,
    audioPath: voice.audioPath,
    clips,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Wrap a stage in a try/catch that prepends the stage name to the error.
 * Makes the worker logs trivially scannable when a reel fails to build.
 */
async function runStage<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`buildReel stage "${name}" failed: ${msg}`);
  }
}

/** Compose a 3-5 keyword footage query from the topic and the chosen script. */
function buildFootageQuery(topic: ReelTopic, script: ReelScript): string {
  // Prefer the most concrete display field; fall back to caption keywords.
  const candidates = [
    script.headline,
    script.hook,
    script.framing,
    script.attribution,
    topic === "histoire" ? "Haiti history" : "Haiti",
  ].filter(Boolean) as string[];

  const head = candidates[0] ?? script.caption.slice(0, 60);

  // Drop French stop-words and short tokens — they dilute the Pexels match.
  const STOP = new Set([
    "pour", "avec", "sans", "dans", "chez", "vers", "sous", "sur", "par",
    "les", "des", "une", "deux", "trois", "cette", "cet", "ces",
    "qui", "que", "quoi", "dont", "mais", "donc", "car", "ainsi",
    "nouvelle", "nouveau", "nouvelles", "nouveaux",
    "the", "and", "for", "with", "from", "this", "that", "these", "those",
  ]);

  const tokens = head
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOP.has(t))
    .slice(0, 4);

  // Append topic English keyword — Pexels has weak French coverage, so a
  // bilingual query ("bourse étudiants Haïti scholarship") catches both.
  const topicEn: Record<ReelTopic, string> = {
    scholarship: "scholarship student",
    opportunity: "opportunity youth career",
    education: "classroom education",
    news: "Haiti",
    histoire: "Haiti history archive",
    taux: "Haiti statistics chart",
    fact: "Haiti education",
  };
  const enHint = topicEn[topic] ?? "Haiti";

  return [...tokens, enHint].join(" ").trim();
}

/**
 * Rough cost estimate for the script generation call. Gemini Flash Lite is
 * the default ($0.10 in / $0.40 out per 1M tokens). We assume ~800 in + ~400
 * out per reel script — well under $0.001.
 */
function estimateScriptCost(_script: ReelScript): number {
  // Hardcoded conservative estimate; the real provider may differ.
  return 0.001;
}
