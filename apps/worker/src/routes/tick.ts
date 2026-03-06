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
import { scheduleIgPost } from "../jobs/scheduleIgPost.js";
import { processIgScheduled } from "../jobs/processIgScheduled.js";
import { contentVersionsRepo } from "@edlight-news/firebase";

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
    } catch (err) {
      // History publisher is non-critical — log and continue
      console.warn("[tick] history publisher error:", err instanceof Error ? err.message : err);
    }

    // Step 10: Instagram pipeline — build queue, taux post, schedule, and process
    let igResult = { buildQueue: { evaluated: 0, queued: 0, skipped: 0, alreadyExists: 0, errors: 0 }, taux: { queued: false, skipped: "" }, schedule: { scheduled: 0, skipped: "" }, process: { processed: 0, posted: 0, dryRun: 0, errors: 0 } };
    try {
      igResult.buildQueue = await buildIgQueue();
      igResult.taux = await buildIgTaux();
      igResult.schedule = await scheduleIgPost();
      igResult.process = await processIgScheduled();
    } catch (err) {
      // IG pipeline is non-critical — log and continue
      console.warn("[tick] IG pipeline error:", err instanceof Error ? err.message : err);
    }

    const durationMs = Date.now() - startMs;
    console.log(`[tick] done in ${durationMs}ms`, { ingestResult, processResult, generateResult, published, synthesisResult, imageResult, utilityResult, datasetResult, historyResult, igResult });

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
