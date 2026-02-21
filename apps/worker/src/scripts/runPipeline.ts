/**
 * Run the full pipeline: ingest → process → generate → publish.
 * Usage: npx tsx src/scripts/runPipeline.ts
 *
 * Env vars are read from:
 *  1. process.env (set by GitHub Actions secrets or shell)
 *  2. .env file at monorepo root (local dev fallback)
 */
import path from "path";
import dotenv from "dotenv";
// Load .env if present — silently ignored in CI where env vars come from secrets
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { ingest } from "../services/ingest.js";
import { processRawItems } from "../services/process.js";
import { generateForItems } from "../services/generate.js";
import { generateImages } from "../jobs/generateImages.js";
import { contentVersionsRepo } from "@edlight-news/firebase";

async function main() {
  console.log("=== Ingest Step ===");
  const ingestResult = await ingest();
  console.log(JSON.stringify(ingestResult, null, 2));

  console.log("\n=== Process Step ===");
  const processResult = await processRawItems();
  console.log(JSON.stringify(processResult, null, 2));

  console.log("\n=== Generate Step ===");
  const genResult = await generateForItems();
  console.log(JSON.stringify(genResult, null, 2));

  console.log("\n=== Publish Step ===");
  const published = await contentVersionsRepo.publishEligibleDrafts();
  console.log(`Published ${published} eligible drafts`);

  console.log("\n=== Image Generation Step ===");
  try {
    const imageResult = await generateImages();
    console.log(JSON.stringify(imageResult, null, 2));
  } catch (err) {
    // Non-critical — Chromium may not be available in all environments
    console.warn("Image generation skipped:", err instanceof Error ? err.message : err);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
