/**
 * POST /process-ig-now
 *
 * Fast-path endpoint that runs processIgScheduled() + processIgStory().
 * Called by the admin "Publish Now" action to avoid waiting for the full
 * /tick pipeline (ingest → process → generate → … → IG) which takes 5-10 min.
 *
 * Also runs processIgStory so stories publish within 3 minutes of all
 * staple carousel posts being posted, instead of waiting up to 15 min
 * for the next /tick.
 *
 * Completes in seconds instead of minutes.
 */

import { Router, type Request, type Response } from "express";
import { processIgScheduled } from "../jobs/processIgScheduled.js";
import { processIgStory } from "../jobs/processIgStory.js";

export const processIgNowRouter = Router();

processIgNowRouter.post("/process-ig-now", async (_req: Request, res: Response) => {
  // Auth is handled by the global middleware in index.ts
  const startMs = Date.now();

  try {
    const result = await processIgScheduled();
    const storyResult = await processIgStory();
    const durationMs = Date.now() - startMs;

    console.log(
      `[process-ig-now] done in ${durationMs}ms — processed=${result.processed} posted=${result.posted} dryRun=${result.dryRun} errors=${result.errors}` +
      ` | story: processed=${storyResult.processed} posted=${storyResult.posted}` +
      (storyResult.waitingForStaples ? ` waitingFor=[${storyResult.waitingForStaples.join(",")}]` : ""),
    );

    res.json({ ok: true, durationMs, result, storyResult });
  } catch (err) {
    console.error("[process-ig-now] error:", err);
    res.status(500).json({
      ok: false,
      durationMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});
