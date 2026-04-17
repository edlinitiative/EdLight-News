import { Router, type Request, type Response } from "express";
import { ingest } from "../services/ingest.js";
import { processRawItems } from "../services/process.js";
import { generateForItems } from "../services/generate.js";
import { runSynthesis } from "../services/synthesis.js";
import { generateImages } from "../jobs/generateImages.js";
import { runUtilityEngine } from "../services/utility.js";
import { runDatasetRefresh } from "../services/datasets.js";
import { runHistoryDailyPublisher } from "../services/historyPublisher.js";
import { buildIgQueue } from "../jobs/buildIgQueue.js";
import { buildIgTaux } from "../jobs/buildIgTaux.js";
import { buildIgStory } from "../jobs/buildIgStory.js";
import { scheduleIgPost } from "../jobs/scheduleIgPost.js";
import { processIgScheduled } from "../jobs/processIgScheduled.js";
import { processIgStory } from "../jobs/processIgStory.js";
import { buildWaQueue } from "../jobs/buildWaQueue.js";
import { scheduleWaPost } from "../jobs/scheduleWaPost.js";
import { processWaScheduled } from "../jobs/processWaScheduled.js";
import { buildFbQueue } from "../jobs/buildFbQueue.js";
import { scheduleFbPost } from "../jobs/scheduleFbPost.js";
import { processFbScheduled } from "../jobs/processFbScheduled.js";
import { buildThQueue } from "../jobs/buildThQueue.js";
import { scheduleThPost } from "../jobs/scheduleThPost.js";
import { processThScheduled } from "../jobs/processThScheduled.js";
import { buildXQueue } from "../jobs/buildXQueue.js";
import { scheduleXPost } from "../jobs/scheduleXPost.js";
import { processXScheduled } from "../jobs/processXScheduled.js";
import { contentVersionsRepo } from "@edlight-news/firebase";
import { pingSearchEngines } from "../services/pingSearchEngines.js";

export const tickRouter = Router();

tickRouter.post("/tick", async (_req: Request, res: Response) => {
  const startMs = Date.now();

  try {
    // Step 1: Ingest new entries from sources → raw_items
    const ingestResult = await ingest();

    // Step 2: Process raw_items(new) → items (extract, normalise)
    const processResult = await processRawItems();

    // Step 3: Generate content_versions (FR + HT) via Gemini for items w/o versions
    const generateResult = await generateForItems();

    // Step 4: Publish eligible drafts (those that passed all quality gates)
    const published = await contentVersionsRepo.publishEligibleDrafts();
    if (published > 0) {
      console.log(`[tick] published ${published} eligible drafts`);
    }

    // Step 5: Synthesis — create/update multi-source living articles
    let synthesisResult = { synthesized: 0, updated: 0, skipped: 0, errors: 0 };
    try {
      synthesisResult = await runSynthesis();
    } catch (err) {
      // Synthesis is non-critical — log and continue
      console.warn("[tick] synthesis error:", err instanceof Error ? err.message : err);
    }

    // Step 6: Generate images for items that don't have one yet
    let imageResult = { publisher: 0, wikidata: 0, branded: 0, screenshotted: 0, failed: 0 };
    try {
      imageResult = await generateImages();
    } catch (err) {
      // Image generation is non-critical — log and continue
      console.warn("[tick] image generation error:", err instanceof Error ? err.message : err);
    }

    // Step 7: Utility Engine — generate student-focused original content
    let utilityResult = { seeded: 0, processed: 0, published: 0, needsReview: 0, errors: 0 };
    try {
      utilityResult = await runUtilityEngine();
    } catch (err) {
      // Utility engine is non-critical — log and continue
      console.warn("[tick] utility engine error:", err instanceof Error ? err.message : err);
    }

    // Step 8: Dataset refresh — verify / update structured datasets
    let datasetResult = { enqueued: 0, processed: 0, errors: 0 };
    try {
      datasetResult = await runDatasetRefresh();
    } catch (err) {
      // Dataset refresh is non-critical — log and continue
      console.warn("[tick] dataset refresh error:", err instanceof Error ? err.message : err);
    }

    // Step 9: Haiti History Daily Publisher — template-based history post
    let historyResult: { published: boolean; skipped: boolean; reason: string; itemId?: string } = { published: false, skipped: false, reason: "not-run" };
    try {
      historyResult = await runHistoryDailyPublisher();
      // Warn on actionable skips so they stand out in logs (not buried in the
      // final summary object).  Normal skips (outside window, already done)
      // are silently logged in the summary only.
      const normalHistoireReasons = /^(Outside publish hours|Already published today)/;
      if (historyResult.skipped && !normalHistoireReasons.test(historyResult.reason)) {
        console.warn(`[tick] histoire SKIPPED — ${historyResult.reason}`);
      } else if (!historyResult.published && !historyResult.skipped) {
        // published:false AND skipped:false means a pipeline error (validation, LLM fail, etc.)
        console.warn(`[tick] histoire FAILED (not published, not skipped) — ${historyResult.reason}`);
      }
    } catch (err) {
      // History publisher is non-critical — log and continue
      console.warn("[tick] history publisher error:", err instanceof Error ? err.message : err);
    }

    // Step 10: Instagram pipeline — build queue, taux post, stories, schedule, and process
    let igResult: { buildQueue: any; taux: any; story: any; schedule: any; process: any; storyProcess: any } = { buildQueue: { evaluated: 0, queued: 0, skipped: 0, alreadyExists: 0, errors: 0 }, taux: { queued: false, skipped: "" }, story: { queued: false, skipped: "" }, schedule: { scheduled: 0, skipped: "" }, process: { processed: 0, posted: 0, dryRun: 0, errors: 0 }, storyProcess: { processed: 0, posted: 0, dryRun: 0, errors: 0 } };

    // ── Phase A: Build the carousel queue + taux ─────────────────────
    try {
      igResult.buildQueue = await buildIgQueue();
    } catch (err) {
      console.error("[tick] buildIgQueue error:", err);
      igResult.buildQueue = { error: String(err) };
    }

    try {
      igResult.taux = await buildIgTaux();
      // Warn on actionable taux skip reasons so they appear as warnings in logs.
      // brh-date-stale is expected early in the morning (BRH posts mid-day) but
      // still worth surfacing so we know a retry tick is needed.
      // brh-fetch-failed means a network error — always warn.
      const actionableTauxSkips = new Set(["brh-date-stale", "brh-fetch-failed"]);
      if (igResult.taux.skipped && actionableTauxSkips.has(igResult.taux.skipped)) {
        console.warn(`[tick] taux SKIPPED — ${igResult.taux.skipped} (a later tick will retry)`);
      }
    } catch (err) {
      console.error("[tick] buildIgTaux error:", err);
      igResult.taux = { error: String(err) };
    }

    // ── Phase B: Schedule + post staple carousels FIRST ─────────────
    // Taux, histoire, and utility must land in the feed before the
    // story goes out, so followers can find the full content.
    try {
      igResult.schedule = await scheduleIgPost();
    } catch (err) {
      console.error("[tick] scheduleIgPost error:", err);
      igResult.schedule = { error: String(err) };
    }

    try {
      igResult.process = await processIgScheduled();
    } catch (err) {
      console.error("[tick] processIgScheduled error:", err);
      igResult.process = { error: String(err) };
    }

    // ── Phase C: Build + post story (gated on staples being posted) ─
    try {
      igResult.story = await buildIgStory();
    } catch (err) {
      console.error("[tick] buildIgStory error:", err);
      igResult.story = { error: String(err) };
    }

    try {
      igResult.storyProcess = await processIgStory();
    } catch (err) {
      console.error("[tick] processIgStory error:", err);
      igResult.storyProcess = { error: String(err) };
    }

    // Step 11: WhatsApp pipeline — build queue, schedule, and send
    let waResult: { buildQueue: any; schedule: any; process: any } = {
      buildQueue: { evaluated: 0, queued: 0, skipped: 0, alreadyExists: 0, errors: 0 },
      schedule: { scheduled: 0, skippedCap: 0 },
      process: { processed: 0, sent: 0, failed: 0, skipped: 0, dryRun: 0 },
    };

    try {
      waResult.buildQueue = await buildWaQueue();
    } catch (err) {
      console.error("[tick] buildWaQueue error:", err);
      waResult.buildQueue = { error: String(err) };
    }

    try {
      waResult.schedule = await scheduleWaPost();
    } catch (err) {
      console.error("[tick] scheduleWaPost error:", err);
      waResult.schedule = { error: String(err) };
    }

    try {
      waResult.process = await processWaScheduled();
    } catch (err) {
      console.error("[tick] processWaScheduled error:", err);
      waResult.process = { error: String(err) };
    }

    // Step 12: Facebook pipeline — build queue, schedule, and send
    let fbResult: { buildQueue: any; schedule: any; process: any } = {
      buildQueue: { evaluated: 0, queued: 0, skipped: 0, alreadyExists: 0, errors: 0 },
      schedule: { scheduled: 0, skippedCap: 0 },
      process: { processed: 0, sent: 0, failed: 0, skipped: 0, dryRun: 0 },
    };

    try {
      fbResult.buildQueue = await buildFbQueue();
    } catch (err) {
      console.error("[tick] buildFbQueue error:", err);
      fbResult.buildQueue = { error: String(err) };
    }

    try {
      fbResult.schedule = await scheduleFbPost();
    } catch (err) {
      console.error("[tick] scheduleFbPost error:", err);
      fbResult.schedule = { error: String(err) };
    }

    try {
      fbResult.process = await processFbScheduled();
    } catch (err) {
      console.error("[tick] processFbScheduled error:", err);
      fbResult.process = { error: String(err) };
    }

    // Step 13: Threads pipeline — build queue, schedule, and send
    let thResult: { buildQueue: any; schedule: any; process: any } = {
      buildQueue: { evaluated: 0, queued: 0, skipped: 0, alreadyExists: 0, errors: 0 },
      schedule: { scheduled: 0, skippedCap: 0 },
      process: { processed: 0, sent: 0, failed: 0, skipped: 0, dryRun: 0 },
    };

    try {
      thResult.buildQueue = await buildThQueue();
    } catch (err) {
      console.error("[tick] buildThQueue error:", err);
      thResult.buildQueue = { error: String(err) };
    }

    try {
      thResult.schedule = await scheduleThPost();
    } catch (err) {
      console.error("[tick] scheduleThPost error:", err);
      thResult.schedule = { error: String(err) };
    }

    try {
      thResult.process = await processThScheduled();
    } catch (err) {
      console.error("[tick] processThScheduled error:", err);
      thResult.process = { error: String(err) };
    }

    // Step 14: X (Twitter) pipeline — build queue, schedule, and send
    let xResult: { buildQueue: any; schedule: any; process: any } = {
      buildQueue: { evaluated: 0, queued: 0, skipped: 0, alreadyExists: 0, errors: 0 },
      schedule: { scheduled: 0, skippedCap: 0 },
      process: { processed: 0, sent: 0, failed: 0, skipped: 0, dryRun: 0 },
    };

    try {
      xResult.buildQueue = await buildXQueue();
    } catch (err) {
      console.error("[tick] buildXQueue error:", err);
      xResult.buildQueue = { error: String(err) };
    }

    try {
      xResult.schedule = await scheduleXPost();
    } catch (err) {
      console.error("[tick] scheduleXPost error:", err);
      xResult.schedule = { error: String(err) };
    }

    try {
      xResult.process = await processXScheduled();
    } catch (err) {
      console.error("[tick] processXScheduled error:", err);
      xResult.process = { error: String(err) };
    }

    // Ping Google if any content was published this tick
    const anyPublished =
      published > 0 ||
      utilityResult.published > 0 ||
      historyResult.published;
    if (anyPublished) {
      await pingSearchEngines();
    }

    const durationMs = Date.now() - startMs;
    console.log(`[tick] done in ${durationMs}ms`, { ingestResult, processResult, generateResult, published, synthesisResult, imageResult, utilityResult, datasetResult, historyResult, igResult, waResult, fbResult, thResult, xResult });

    res.json({
      ok: true,
      durationMs,
      results: {
        ingest: ingestResult,
        process: processResult,
        generate: generateResult,
        published,
        synthesis: synthesisResult,
        images: imageResult,
        utility: utilityResult,
        datasets: datasetResult,
        history: historyResult,
        instagram: igResult,
        whatsapp: waResult,
        facebook: fbResult,
        threads: thResult,
        x: xResult,
      },
    });
  } catch (err) {
    console.error("[tick] fatal error:", err);
    res.status(500).json({
      ok: false,
      durationMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
