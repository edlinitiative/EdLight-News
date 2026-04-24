/**
 * Run the full tick pipeline directly (without starting Express).
 * Usage: npx tsx src/scripts/runTick.ts
 *
 * Mirrors ALL steps from routes/tick.ts so GHA cron produces identical
 * results to the Cloud Scheduler → Cloud Run path.
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
import { discoverScholarships } from "../services/discoverScholarships.js";
import { runHistoryDailyPublisher } from "../services/historyPublisher.js";
import { buildIgQueue } from "../jobs/buildIgQueue.js";
import { buildIgTaux } from "../jobs/buildIgTaux.js";
import { buildIgStory } from "../jobs/buildIgStory.js";
import { scheduleIgPost } from "../jobs/scheduleIgPost.js";
import { processIgScheduled } from "../jobs/processIgScheduled.js";
import { processIgStory } from "../jobs/processIgStory.js";
import { contentVersionsRepo } from "@edlight-news/firebase";
import { pingSearchEngines } from "../services/pingSearchEngines.js";

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

  console.log("\n=== Step 8b: Scholarship Discovery ===");
  try {
    const discoverResult = await discoverScholarships();
    console.log(JSON.stringify(discoverResult, null, 2));
  } catch (err) {
    console.warn("[discoverScholarships] error:", err instanceof Error ? err.message : err);
  }

  console.log("\n=== Step 9: Haiti History Daily Publisher ===");
  try {
    const historyResult = await runHistoryDailyPublisher();
    console.log(JSON.stringify(historyResult, null, 2));
  } catch (err) {
    console.warn("[history] error:", err instanceof Error ? err.message : err);
  }

  console.log("\n=== Step 10: Instagram Pipeline ===");
  try {
    const igBuildQueue = await buildIgQueue();
    console.log("[ig] buildQueue:", JSON.stringify(igBuildQueue, null, 2));

    const igTaux = await buildIgTaux();
    console.log("[ig] taux:", JSON.stringify(igTaux, null, 2));

    const igStory = await buildIgStory();
    console.log("[ig] story:", JSON.stringify(igStory, null, 2));

    const igSchedule = await scheduleIgPost();
    console.log("[ig] schedule:", JSON.stringify(igSchedule, null, 2));

    const igProcess = await processIgScheduled();
    console.log("[ig] process:", JSON.stringify(igProcess, null, 2));

    const igStoryProcess = await processIgStory();
    console.log("[ig] storyProcess:", JSON.stringify(igStoryProcess, null, 2));
  } catch (err) {
    console.warn("[ig] error:", err instanceof Error ? err.message : err);
  }

  // Ping Google if any content was published
  if (published > 0) {
    console.log("\n=== Ping Google Sitemap ===");
    await pingSearchEngines();
  }

  const durationMs = Date.now() - startMs;
  console.log(`\n=== Tick complete in ${durationMs}ms ===`);
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
