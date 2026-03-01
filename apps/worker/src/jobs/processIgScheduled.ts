/**
 * Worker job: processIgScheduled
 *
 * Picks up scheduled IG posts that are due, renders assets, and publishes.
 * Runs as part of the /tick pipeline.
 */

import { igQueueRepo, itemsRepo, uploadCarouselSlides } from "@edlight-news/firebase";
import { generateCarouselAssets } from "@edlight-news/renderer/ig-carousel.js";
import { publishIgPost } from "@edlight-news/publisher";
import type { IGQueueItem } from "@edlight-news/types";

export interface ProcessIgScheduledResult {
  processed: number;
  posted: number;
  dryRun: number;
  errors: number;
}

export async function processIgScheduled(): Promise<ProcessIgScheduledResult> {
  const result: ProcessIgScheduledResult = {
    processed: 0,
    posted: 0,
    dryRun: 0,
    errors: 0,
  };

  try {
    // Get scheduled items that are due
    const scheduled = await igQueueRepo.listScheduled(10);
    const now = new Date();

    for (const item of scheduled) {
      // Only process items that are due
      if (item.scheduledFor && new Date(item.scheduledFor) > now) {
        continue;
      }

      result.processed++;

      try {
        // Mark as rendering
        await igQueueRepo.updateStatus(item.id, "rendering");

        // Get the payload (should already exist from buildIgQueue)
        if (!item.payload) {
          console.warn(`[processIgScheduled] item ${item.id} has no payload, skipping`);
          await igQueueRepo.updateStatus(item.id, "skipped", {
            reasons: [...item.reasons, "No payload available at render time"],
          });
          result.errors++;
          continue;
        }

        // Render assets
        const assets = await generateCarouselAssets(item, item.payload);

        // Upload rendered PNGs to Firebase Storage so the IG API can access them.
        // In dry-run mode (HTML files) we skip the upload and pass local paths.
        let slideUrls = assets.slidePaths;
        if (assets.mode === "rendered") {
          try {
            slideUrls = await uploadCarouselSlides(assets.slidePaths, item.id);
          } catch (uploadErr) {
            console.warn(`[processIgScheduled] Storage upload failed, using local paths:`, uploadErr);
          }
        }

        // Publish (or dry-run)
        const publishResult = await publishIgPost(item, item.payload, slideUrls);

        if (publishResult.posted) {
          await igQueueRepo.markPosted(item.id, publishResult.igPostId);
          result.posted++;
        } else if (publishResult.dryRun) {
          await igQueueRepo.updateStatus(item.id, "scheduled_ready_for_manual", {
            dryRunPath: publishResult.dryRunPath,
          });
          result.dryRun++;
        } else {
          await igQueueRepo.updateStatus(item.id, "scheduled", {
            reasons: [...item.reasons, `Publish error: ${publishResult.error}`],
          });
          result.errors++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[processIgScheduled] error processing ${item.id}:`, msg);
        await igQueueRepo.updateStatus(item.id, "scheduled", {
          reasons: [...item.reasons, `Processing error: ${msg}`],
        });
        result.errors++;
      }
    }

    if (result.processed > 0) {
      console.log(`[processIgScheduled] processed=${result.processed} posted=${result.posted} dryRun=${result.dryRun} errors=${result.errors}`);
    }
  } catch (err) {
    console.error("[processIgScheduled] fatal error:", err);
    result.errors++;
  }

  return result;
}
