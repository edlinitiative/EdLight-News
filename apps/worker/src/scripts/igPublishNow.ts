/**
 * IG Publish Now — one-shot script to trigger IG posting immediately.
 *
 * Bypasses all time-gating and scheduling. Grabs the top queued item,
 * renders it, and publishes directly.
 *
 * Usage:  cd apps/worker && npx tsx src/scripts/igPublishNow.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { buildIgQueue } from "../jobs/buildIgQueue.js";
import { igQueueRepo, itemsRepo, uploadCarouselSlides } from "@edlight-news/firebase";
import { generateCarouselAssets } from "@edlight-news/renderer/ig-carousel.js";
import { publishIgPost } from "@edlight-news/publisher";
import { generateContextualImage } from "../services/geminiImageGen.js";

async function main() {
  console.log("=== IG Publish Now ===\n");

  // Check credentials
  const hasToken = !!process.env.IG_ACCESS_TOKEN;
  const hasUser = !!process.env.IG_USER_ID;
  console.log(`IG_ACCESS_TOKEN: ${hasToken ? "✓ set" : "✗ MISSING"}`);
  console.log(`IG_USER_ID: ${hasUser ? "✓ set" : "✗ MISSING"}`);
  console.log(`PLAYWRIGHT_CHROMIUM_PATH: ${process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "(auto-detect)"}\n`);

  if (!hasToken || !hasUser) {
    console.error("Missing IG credentials. Set IG_ACCESS_TOKEN and IG_USER_ID in .env");
    process.exit(1);
  }

  // Step 1: Ensure there are items in the queue
  console.log("--- Step 1: Build IG Queue ---");
  const buildResult = await buildIgQueue();
  console.log(JSON.stringify(buildResult, null, 2));

  // Step 2: Grab top queued items directly (bypass scheduleIgPost entirely)
  // Ensure type diversity: include at least one news item if available
  console.log("\n--- Step 2: Grab top queued items (with type diversity) ---");
  const allQueued = await igQueueRepo.listQueuedByScore(30);
  console.log(`Found ${allQueued.length} total queued items`);

  if (allQueued.length === 0) {
    console.log("Nothing to publish. Checking all statuses...");
    for (const status of ["scheduled", "rendering", "posted", "skipped"] as const) {
      try {
        const items = await igQueueRepo.listByStatus(status, 3);
        console.log(`  ${status}: ${items.length} items`);
      } catch { /* ignore index errors */ }
    }
    process.exit(0);
  }

  // Build a diverse selection: top item + top news item (if the top isn't already news)
  const queued: typeof allQueued = [];
  const topItem = allQueued[0]!;
  queued.push(topItem);

  if (topItem.igType !== "news") {
    const topNews = allQueued.find((q) => q.igType === "news");
    if (topNews) {
      queued.push(topNews);
      console.log(`  → Added news item for type diversity: ${topNews.id} (score=${topNews.score})`);
    }
  }

  // If we only have 1, try to add a second of a different type
  if (queued.length < 2) {
    const second = allQueued.find((q) => q.id !== topItem.id);
    if (second) queued.push(second);
  }

  console.log(`Publishing ${queued.length} items (types: ${queued.map((q) => q.igType).join(", ")})`);

  // Step 3: Render and publish top item
  for (const item of queued.slice(0, 2)) {
    console.log(`\n--- Publishing: ${item.id} (score=${item.score}, type=${item.igType}) ---`);

    if (!item.payload) {
      console.warn(`  No payload, skipping`);
      continue;
    }

    try {
      // Mark as rendering
      await igQueueRepo.updateStatus(item.id, "rendering");

      // Bloomberg style: every slide needs a background image.
      // Generate one via Gemini if any slides are missing images.
      const slidesNeedingImage = item.payload.slides.filter((s) => !s.backgroundImage);
      if (slidesNeedingImage.length > 0) {
        console.log(`  ${slidesNeedingImage.length}/${item.payload.slides.length} slides need images — trying Gemini...`);
        try {
          const sourceItem = await itemsRepo.getItem(item.sourceContentId);
          if (sourceItem) {
            const generated = await generateContextualImage(sourceItem);
            if (generated) {
              // Apply the same image to all slides that need one
              for (const slide of slidesNeedingImage) {
                slide.backgroundImage = generated.url;
              }
              console.log(`  ✓ Applied generated image to ${slidesNeedingImage.length} slides`);
              await igQueueRepo.setPayload(item.id, item.payload);
            } else {
              console.log("  ⚠ Gemini image gen returned null — dark template fallback");
            }
          }
        } catch (imgErr) {
          console.warn("  ⚠ Image gen failed:", imgErr instanceof Error ? imgErr.message : imgErr);
        }
      }

      // Render carousel
      console.log("  Rendering carousel...");
      const assets = await generateCarouselAssets(item, item.payload);
      console.log(`  Rendered ${assets.slidePaths.length} slides (mode=${assets.mode})`);

      // Upload slides to Firebase Storage
      let slideUrls = assets.slidePaths;
      if (assets.mode === "rendered") {
        try {
          console.log("  Uploading to Firebase Storage...");
          slideUrls = await uploadCarouselSlides(assets.slidePaths, item.id);
          console.log(`  Uploaded ${slideUrls.length} slides`);
        } catch (uploadErr) {
          console.warn("  Storage upload failed, using local paths:", uploadErr);
        }
      }

      // Publish
      console.log("  Publishing to Instagram...");
      const publishResult = await publishIgPost(item, item.payload, slideUrls);
      console.log("  Result:", JSON.stringify(publishResult, null, 2));

      if (publishResult.posted) {
        await igQueueRepo.markPosted(item.id, publishResult.igPostId);
        console.log(`  ✓ POSTED: ${publishResult.igPostId}`);
      } else if (publishResult.dryRun) {
        console.log(`  ⚠ DRY RUN: ${publishResult.dryRunPath}`);
      } else {
        console.error(`  ✗ FAILED: ${publishResult.error}`);
        await igQueueRepo.updateStatus(item.id, "queued");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ ERROR: ${msg}`);
      await igQueueRepo.updateStatus(item.id, "queued");
    }
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
