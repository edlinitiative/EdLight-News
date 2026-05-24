/**
 * buildReelV2 — format-driven Reel orchestrator.
 *
 * Pipeline (v2):
 *   1. classifyReelFormat(...)             editorial routing
 *   2. generateStoryboard(...)             LLM → scenes + caption + hashtags
 *   3. collectReelAssets(...)              fill scene assetUrls (best-effort)
 *   4. buildReel(scriptOverride: ...)      delegate render to v1 chain
 *   5. scoreReelQuality(...)               heuristic editorial QA
 *   6. assemble GeneratedReel              for Slack review
 *
 * The MP4 itself is rendered by the existing Remotion templates: we map the
 * format onto a v1 ReelTopic + ReelTemplate and synthesize a v1 ReelScript
 * from the storyboard so the renderer needs no changes. This keeps the
 * refactor surgical — the v1 pipeline keeps working untouched.
 *
 * Auto-publish is intentionally NOT here. The worker is responsible for
 * uploading the MP4, persisting the v2 fields, and pushing the package
 * to Slack for human review.
 */

import { randomUUID } from "node:crypto";
import { buildReel, type BuildReelResult } from "../buildReel.js";
import type { ReelScript } from "../generateReelScript.js";
import type { ReelTemplate, ReelTopic } from "../types.js";
import {
  classifyReelFormat,
  type ClassifyReelFormatInput,
} from "./classifyReelFormat.js";
import {
  generateStoryboard,
  type GenerateStoryboardResult,
  type StoryboardSourceItem,
} from "./generateStoryboard.js";
import { collectReelAssets } from "./collectReelAssets.js";
import { scoreReelQuality } from "./scoreReelQuality.js";
import {
  FORMAT_TO_TEMPLATE,
  FORMAT_TO_TOPIC,
  type GeneratedReel,
  type ReelFormat,
  type ReelLanguageV2,
  type ReelScene,
} from "./types.js";

export interface BuildReelV2Input {
  /** Primary source item. Required for all formats. */
  primary: StoryboardSourceItem & {
    /** Editorial signals used by the classifier. */
    category?: string;
    vertical?: string;
    countries?: string[];
    /** Optional hero image url; reused by the renderer for HeadlinePhoto. */
    imageUrl?: string;
  };
  /** Additional items used to bundle a `weekly_opportunity_roundup`. */
  roundup?: StoryboardSourceItem[];
  /** Override classifier (admin / scheduled-roundup mode). */
  formatOverride?: ReelFormat;
  /** Spoken language. Defaults to "fr" per editorial policy. */
  language?: ReelLanguageV2;
  /** Forwarded to buildReel for Remotion entry override (tests). */
  remotionEntry?: string;
}

export interface BuildReelV2Result {
  reel: GeneratedReel;
  /** Local filesystem path to the composed MP4 (caller uploads). */
  videoPath: string;
  /** Local filesystem path to the synthesized voiceover MP3. */
  audioPath: string;
  /** Underlying v1 artifact for back-compat persistence (cost, clips, …). */
  v1: BuildReelResult["artifact"];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Synthesize a v1 ReelScript from the v2 storyboard, filling each template's
 * required fields from the most semantically-appropriate scene.
 *
 * We MUST produce all fields a given template requires, otherwise
 * buildReel's scriptOverride path will fail rendering. The mapping below
 * covers the four v1 templates conservatively.
 */
function storyboardToV1Script(args: {
  format: ReelFormat;
  template: ReelTemplate;
  storyboard: ReelScene[];
  caption: string;
  hashtags: string[];
  sourceName?: string;
  title: string;
}): ReelScript {
  const { storyboard, caption, hashtags, sourceName, title, template } = args;
  const voiceover = storyboard.map((s) => s.voiceover).join(" ");
  const firstText = storyboard[0]?.onScreenText || title;
  const lastText = storyboard[storyboard.length - 1]?.onScreenText || "";
  const deadlineScene = storyboard.find((s) => s.visualType === "deadline_card");
  const checklistScene = storyboard.find((s) => s.visualType === "checklist");

  const points = storyboard
    .filter((s) =>
      ["roundup_item", "checklist", "b_roll", "image_card"].includes(s.visualType),
    )
    .map((s) => s.onScreenText || s.voiceover)
    .map((t) => t.slice(0, 110))
    .slice(0, 5);

  // Template-specific required fields.
  switch (template) {
    case "BigStatistic":
      return {
        voiceover,
        hook: firstText.slice(0, 60),
        hero: deadlineScene?.onScreenText.slice(0, 40) || title.slice(0, 40),
        context: (storyboard[1]?.onScreenText || lastText).slice(0, 120),
        caption,
        hashtags,
        sourceLabel: sourceName?.slice(0, 60),
      };
    case "PullQuote": {
      const quoteScene = storyboard.find((s) => s.visualType === "quote_card");
      return {
        voiceover,
        quote: (quoteScene?.voiceover || storyboard[1]?.voiceover || firstText).slice(0, 180),
        attribution: sourceName?.slice(0, 80) || "EdLight News",
        caption,
        hashtags,
        sourceLabel: sourceName?.slice(0, 60),
      };
    }
    case "HeadlinePhoto":
      return {
        voiceover,
        headline: title.slice(0, 90),
        caption,
        hashtags,
        sourceLabel: sourceName?.slice(0, 60),
      };
    case "NumberedPoints":
      return {
        voiceover,
        framing: (checklistScene?.onScreenText || title).slice(0, 60),
        points: points.length >= 2 ? points : [title.slice(0, 110), caption.slice(0, 110)],
        caption,
        hashtags,
        sourceLabel: sourceName?.slice(0, 60),
      };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function buildReelV2(input: BuildReelV2Input): Promise<BuildReelV2Result> {
  const language: ReelLanguageV2 = input.language ?? "fr";
  const reelId = `reel_${Date.now()}_${randomUUID().slice(0, 8)}`;

  // ── 1. Classify ────────────────────────────────────────────────────────
  const classifierInput: ClassifyReelFormatInput = {
    category: input.primary.category,
    vertical: input.primary.vertical,
    title: input.primary.title,
    summary: input.primary.summary,
    countries: input.primary.countries,
    opportunityBundleSize: input.roundup?.length ?? 0,
  };
  const format: ReelFormat = input.formatOverride ?? classifyReelFormat(classifierInput);
  console.log(JSON.stringify({ event: "reelFormatClassified", reelId, format }));

  // ── 2. Storyboard ──────────────────────────────────────────────────────
  const story: GenerateStoryboardResult = await generateStoryboard({
    format,
    language,
    primary: input.primary,
    roundup: input.roundup,
  });

  const topic: ReelTopic = FORMAT_TO_TOPIC[format];
  const template: ReelTemplate = FORMAT_TO_TEMPLATE[format];

  // ── 3. Assets (best-effort) ────────────────────────────────────────────
  const storyboardWithAssets = await collectReelAssets({
    topic,
    fallbackQuery: story.title,
    storyboard: story.storyboard,
  });

  // ── 4. Delegate render to v1 buildReel ─────────────────────────────────
  const v1Script = storyboardToV1Script({
    format,
    template,
    storyboard: storyboardWithAssets,
    caption: story.caption,
    hashtags: story.hashtags,
    sourceName: input.primary.sourceName,
    title: story.title,
  });

  const built = await buildReel({
    topic,
    templateOverride: template,
    scriptOverride: v1Script,
    language,
    item: {
      id: input.primary.id,
      title: input.primary.title,
      summary: input.primary.summary,
      url: input.primary.url,
      sourceName: input.primary.sourceName,
    },
    imageUrl: input.primary.imageUrl,
    remotionEntry: input.remotionEntry,
  });

  const durationSec = built.artifact.durationSec;

  // Re-anchor scene timing to actual render duration. The TTS may compress
  // or stretch slightly vs. our word-rate estimate; rescale proportionally
  // so the Slack reviewer sees timings that match the MP4.
  const estimatedTotal = storyboardWithAssets[storyboardWithAssets.length - 1]?.endSec ?? 0;
  const rescaled: ReelScene[] =
    estimatedTotal > 0
      ? (() => {
          const k = durationSec / estimatedTotal;
          let cursor = 0;
          return storyboardWithAssets.map((s) => {
            const dur = (s.endSec - s.startSec) * k;
            const startSec = Number(cursor.toFixed(2));
            const endSec = Number((cursor + dur).toFixed(2));
            cursor = endSec;
            return { ...s, startSec, endSec };
          });
        })()
      : storyboardWithAssets;

  // ── 5. Quality score ───────────────────────────────────────────────────
  const qualityScore = scoreReelQuality({
    format,
    storyboard: rescaled,
    caption: story.caption,
    hashtags: story.hashtags,
    voiceover: story.voiceover,
    durationSec,
  });
  console.log(
    JSON.stringify({
      event: "reelQualityScored",
      reelId,
      total: qualityScore.total,
      passed: qualityScore.passed,
      notes: qualityScore.notes,
    }),
  );

  // ── 6. Assemble final package ──────────────────────────────────────────
  const now = new Date();
  const reel: GeneratedReel = {
    id: reelId,
    sourceItemId: input.primary.id,
    sourceItemIds:
      input.roundup && input.roundup.length > 0
        ? [input.primary.id, ...input.roundup.map((r) => r.id)]
        : undefined,
    format,
    language,
    title: story.title,
    hook: storyboardWithAssets[0]?.voiceover ?? "",
    script: story.voiceover,
    storyboard: rescaled,
    caption: story.caption,
    hashtags: story.hashtags,
    durationSec,
    qualityScore,
    status: "pending_review",
    createdAt: now,
    updatedAt: now,
  };

  return {
    reel,
    videoPath: built.videoPath,
    audioPath: built.audioPath,
    v1: built.artifact,
  };
}
