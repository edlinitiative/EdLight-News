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
import { pickTemplateWithDowngrade, TEMPLATE_PREFERENCE } from "./pickTemplate.js";
import {
  generateReelScript,
  TemplateRequirementError,
  type GenerateReelScriptInput,
  type ReelScript,
} from "./generateReelScript.js";
import { synthesizeVoice } from "./synthesizeVoice.js";
import { alignCaptions } from "./alignCaptions.js";
import { pickStockFootage, type StockClip } from "./pickStockFootage.js";
import { composeReel } from "./composeReel.js";
import { isDeadlinePast } from "@edlight-news/generator";
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
  /**
   * v1.6 — Canonical clickable URL where the viewer can actually act
   * (apply, register, read full article). For aggregated content this is
   * the ORIGINAL publisher URL (e.g. royalsociety.org), NOT the
   * edlight.news article page. Rendered on the CTA scene as the destination
   * handoff. Falls back to `item.url` when omitted.
   */
  sourceUrl?: string;
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

  // ── 1+2. Script ──────────────────────────────────────────────────────────
  //
  // We walk the topic's TEMPLATE_PREFERENCE list, starting at the picked
  // template, and retry up to `list.length` times. Each retry is triggered
  // only by TemplateRequirementError (the LLM honestly couldn't fill the
  // template-specific fields, e.g. PullQuote on an article with no quote).
  // Any other error — JSON, network, LLM provider — is fatal and rethrown
  // immediately so we don't burn $N retries on a transient outage.
  //
  // A caller-supplied templateOverride short-circuits all fallbacks so
  // admin re-rolls remain authoritative.
  const scriptStart = Date.now();
  const pickResult = input.templateOverride
    ? {
        template: input.templateOverride,
        downgraded: false as const,
        heroNumber: null,
      }
    : pickTemplateWithDowngrade(input.topic, dow, input.item.id, {
        title: input.item.title,
        summary: input.item.summary,
        structured: input.item.structured,
      });
  if (pickResult.downgraded) {
    console.warn(
      `[buildReel] templateDowngraded { from: "${pickResult.from}", to: "${pickResult.template}", reason: "${pickResult.reason}", itemId: "${input.item.id}" }`,
    );
  }
  const initialTemplate = pickResult.template;
  const candidateList = input.templateOverride
    ? [input.templateOverride]
    : buildFallbackOrder(input.topic, initialTemplate);

  let template = initialTemplate;
  let script: ReelScript | undefined;
  let lastError: unknown;
  for (const candidate of candidateList) {
    template = candidate;
    try {
      script = await runStage("generateReelScript", () =>
        generateReelScript({
          topic: input.topic,
          template,
          item: input.item,
          contextItems: input.contextItems,
          heroNumber: pickResult.heroNumber ?? undefined,
        }),
      );
      break;
    } catch (err) {
      lastError = err;
      const cause = unwrapStageError(err);
      if (!(cause instanceof TemplateRequirementError)) {
        throw err;
      }
      // Try the next candidate, if any.
      const next = candidateList[candidateList.indexOf(candidate) + 1];
      if (next) {
        console.warn(
          `[buildReel] template "${cause.template}" missing ${cause.missingFields.join(", ")} for item ${input.item.id} — retrying with "${next}"`,
        );
      } else {
        console.warn(
          `[buildReel] template "${cause.template}" missing ${cause.missingFields.join(", ")} for item ${input.item.id} — no more fallbacks`,
        );
      }
    }
  }
  if (!script) {
    throw lastError instanceof Error
      ? lastError
      : new Error("buildReel: exhausted all template fallbacks");
  }
  const scriptCostUsd = estimateScriptCost(script);
  const scriptMs = Date.now() - scriptStart;

  // ── Task 4 (v1.3): Log scene-cut plan or fallback ────────────────────
  // When the LLM returns a structured `scenes` array (one entry per scene
  // in the template director), log `reelSceneCutPlanned` so we can verify
  // scene-boundary audio alignment in prod. When absent, the director
  // allocates audio proportionally across scenes and we log the fallback.
  if (script.scenes && script.scenes.length > 0) {
    console.log(JSON.stringify({
      event: "reelSceneCutPlanned",
      reelId,
      sceneCount: script.scenes.length,
      scenes: script.scenes.map((s) => ({
        id: s.sceneId, targetSec: s.targetDurationSec,
        words: s.text.trim().split(/\s+/).length,
      })),
    }));
  } else {
    console.log(JSON.stringify({
      event: "reelSceneCutPlanned",
      reelId,
      scriptStructureFallback: true,
      note: "LLM did not return structured scenes — director uses proportional audio allocation",
    }));
  }

  // ── v1.7: strip expired keyFacts.deadline ──────────────────────────
  // The LLM extracts `keyFacts.deadline` verbatim from the article body,
  // which may already be in the past for archived items. The picker
  // already filters items whose `opportunity.deadline` parses as past
  // (see buildReelsQueue / runBuildReelsQueueOnce), but defence-in-depth
  // here ensures the urgent-deadline card (HeadlinePhotoTemplate) and any
  // future surface never displays a stale date.
  if (script.keyFacts?.deadline) {
    if (isDeadlinePast(script.keyFacts.deadline)) {
      console.log(JSON.stringify({
        event: "reelKeyFactDeadlineStripped",
        reelId,
        originalDeadline: script.keyFacts.deadline,
        reason: "expired",
      }));
      script = { ...script, keyFacts: { ...script.keyFacts, deadline: undefined } };
    }
  }

  // ── v1.5: script observability ───────────────────────────────────────
  // Log the per-reel word count + keyFact count so the dashboard can spot
  // model drift (e.g. Gemini suddenly returning 20-word scripts and tripping
  // the duration gate). These are the inputs to the v1.5 retry logic in
  // generateReelScript().
  const voiceoverWords = script.voiceover.trim().split(/\s+/).filter(Boolean).length;
  const keyFactCount = script.keyFacts
    ? Object.values(script.keyFacts).filter(Boolean).length
    : 0;
  console.log(JSON.stringify({
    event: "reelScriptGenerated",
    reelId,
    template,
    voiceoverWords,
    keyFactCount,
    hasScenes: Boolean(script.scenes && script.scenes.length > 0),
  }));

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

  // ── 4. Captions (depends on voice + script) ──────────────────────────
  //
  // alignCaptions feeds the ground-truth script as a recognizer prompt and
  // re-pairs the returned timestamps with the script tokens, so the burned
  // overlay never contains an STT mistranscription (v1 bug: "sisters in
  // public house"). The Result shape matches the legacy transcribeForCaptions.
  const transcript = await runStage("alignCaptions", () =>
    alignCaptions({
      audioPath: voice.audioPath,
      scriptText: script.voiceover,
      language: "fr-FR",
    }),
  );

  // ── 6. Compose ───────────────────────────────────────────────────────────
  // v1.6: derive the canonical action URL. Prefer the caller-supplied
  // sourceUrl (the original publisher URL where the viewer can act); fall
  // back to item.url. extractSourceDomain() handles Google News redirect
  // wrappers and strips www/m. prefixes.
  const resolvedSourceUrl = input.sourceUrl ?? input.item.url;
  const sourceDomain = extractSourceDomain(resolvedSourceUrl);
  const composed = await runStage("composeReel", () =>
    composeReel({
      reelId,
      topic: input.topic,
      template,
      script,
      audioPath: voice.audioPath,
      audioDurationSec: transcript.durationSec,
      clips,
      captions: transcript.words,
      heroImageUrl: input.imageUrl,
      remotionEntry: input.remotionEntry,
      sourceUrl: resolvedSourceUrl,
      sourceDomain,
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
    // Preserve the original error on `.cause` so callers can branch on the
    // typed subclass (e.g. TemplateRequirementError) for recoverable retries.
    throw new Error(`buildReel stage "${name}" failed: ${msg}`, { cause: err });
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

/**
 * Unwrap the `runStage` wrapper to expose the original cause. `runStage`
 * rethrows as `new Error("buildReel stage \"x\" failed: ...")` which loses
 * the prototype — keep the message but also stash the original on `.cause`
 * so we can branch on `instanceof TemplateRequirementError`.
 */
function unwrapStageError(err: unknown): unknown {
  if (err && typeof err === "object" && "cause" in err) {
    return (err as { cause: unknown }).cause;
  }
  return err;
}

/**
 * Build the candidate template list for fallback retries. Starts with the
 * picked template, then appends the remaining templates from the topic's
 * preference list (in order, no duplicates). If the picked template isn't
 * in the preference list (shouldn't happen, but defensive), we still try
 * the whole preference list after it.
 */
function buildFallbackOrder(
  topic: ReelTopic,
  picked: ReelTemplate,
): ReelTemplate[] {
  const list = TEMPLATE_PREFERENCE[topic] ?? [];
  const tail = list.filter((t) => t !== picked);
  return [picked, ...tail];
}

/**
 * Extract a display-ready domain (e.g. "royalsociety.org") from any URL.
 * Strips protocol, www./m. prefixes, and trailing paths. Returns undefined
 * for empty/invalid input so callers can degrade gracefully.
 *
 * Special-cases Google News redirect URLs (news.google.com/articles/...?url=…)
 * by unwrapping the `url` query parameter when present.
 */
export function extractSourceDomain(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let candidate = raw;
  try {
    const u = new URL(raw);
    if (u.hostname.endsWith("news.google.com")) {
      const inner = u.searchParams.get("url");
      if (inner) candidate = inner;
    }
  } catch {
    // Not a parseable URL — fall through to regex below.
  }
  try {
    const u = new URL(candidate);
    return u.hostname.replace(/^(www|m)\./i, "");
  } catch {
    const m = candidate.match(/^(?:https?:\/\/)?(?:www\.|m\.)?([^\/?#]+)/i);
    return m?.[1];
  }
}
