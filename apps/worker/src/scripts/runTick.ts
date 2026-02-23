/**
 * Run the full tick pipeline directly (without starting Express).
 * Usage: npx tsx src/scripts/runTick.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { ingest } from "../services/ingest.js";
import { processRawItems } from "../services/process.js";
import { generateForItems } from "../services/generate.js";
import { runSynthesis } from "../services/synthesis.js";
import { generateImages } from "../jobs/generateImages.js";
import { runUtilityEngine } from "../services/utility.js";
import { runDatasetRefresh } from "../services/datasets.js";
import { contentVersionsRepo } from "@edlight-news/firebase";

async function main() {
  const startMs = Date.now();

  console.log("=== Step 1: Ingest ===");
  const ingestResult = await ingest();
  console.log(JSON.stringify(ingestResult, null, 2));

  console.log("\n=== Step 2: Process ===");
  const processResult = await processRawItems();
  console.log(JSON.stringify(processResult, null, 2));

  console.log("\n=== Step 3: Generate ===");
  const generateResult = await generateForItems();
  console.log(JSON.stringify(generateResult, null, 2));

  console.log("\n=== Step 4: Publish eligible drafts ===");
  const published = await contentVersionsRepo.publishEligibleDrafts();
  console.log(`Published ${published} eligible drafts`);

  console.log("\n=== Step 5: Synthesis ===");
  try {
    const synthesisResult = await runSynthesis();
    console.log(JSON.stringify(synthesisResult, null, 2));
  } catch (err) {
    console.warn("[synthesis] error:", err instanceof Error ? err.message : err);
  }

  console.log("\n=== Step 6: Image Generation ===");
  try {
    const imageResult = await generateImages();
    console.log(JSON.stringify(imageResult, null, 2));
  } catch (err) {
    console.warn("[images] error:", err instanceof Error ? err.message : err);
  }

  console.log("\n=== Step 7: Utility Engine ===");
  try {
    const utilityResult = await runUtilityEngine();
    console.log(JSON.stringify(utilityResult, null, 2));
  } catch (err) {
    console.warn("[utility] error:", err instanceof Error ? err.message : err);
  }

  console.log("\n=== Step 8: Dataset Refresh ===");
  try {
    const datasetResult = await runDatasetRefresh();
    console.log(JSON.stringify(datasetResult, null, 2));
  } catch (err) {
    console.warn("[datasets] error:", err instanceof Error ? err.message : err);
  }

  const durationMs = Date.now() - startMs;
  console.log(`\n=== Tick complete in ${durationMs}ms ===`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
