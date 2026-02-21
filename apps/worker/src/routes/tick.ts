import { Router, type Request, type Response } from "express";
import { ingest } from "../services/ingest.js";
import { processRawItems } from "../services/process.js";
import { generateForItems } from "../services/generate.js";
import { generateImages } from "../jobs/generateImages.js";
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

    // Step 5: Generate branded card images for items that don't have one yet
    let imageResult = { generated: 0, failed: 0 };
    try {
      imageResult = await generateImages();
    } catch (err) {
      // Image generation is non-critical — log and continue
      console.warn("[tick] image generation error:", err instanceof Error ? err.message : err);
    }

    const durationMs = Date.now() - startMs;
    console.log(`[tick] done in ${durationMs}ms`, { ingestResult, processResult, generateResult, published, imageResult });

    res.json({
      ok: true,
      durationMs,
      results: {
        ingest: ingestResult,
        process: processResult,
        generate: generateResult,
        published,
        images: imageResult,
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
