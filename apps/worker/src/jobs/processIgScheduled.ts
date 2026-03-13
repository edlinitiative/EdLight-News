/**
 * Worker job: processIgScheduled
 *
 * Picks up scheduled IG posts that are due, renders assets, and publishes.
 * Runs as part of the /tick pipeline.
 */

import { igQueueRepo, uploadCarouselSlides } from "@edlight-news/firebase";
import { generateCarouselAssets } from "@edlight-news/renderer/ig-carousel.js";
import { publishIgPost } from "@edlight-news/publisher";
import type { IGQueueItem, IGPostType } from "@edlight-news/types";

// Must match the TTLs in scheduleIgPost.ts
const STALENESS_TTL_HOURS: Record<IGPostType, number> = {
  news: 48,
  taux: 24,
  utility: 72,
  histoire: 24,
  opportunity: 336,
  scholarship: 336,
};

/** Check if an IG queue item is too old to post. */
function isStale(item: { igType: IGPostType; createdAt: any }): boolean {
  const ttlHours = STALENESS_TTL_HOURS[item.igType] ?? 72;
  const createdMs =
    item.createdAt && typeof item.createdAt === "object" && "seconds" in item.createdAt
      ? (item.createdAt as { seconds: number }).seconds * 1000
      : item.createdAt instanceof Date
        ? item.createdAt.getTime()
        : 0;
  if (createdMs === 0) return false;
  return Date.now() - createdMs > ttlHours * 60 * 60 * 1000;
}

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
        // ── Final freshness check ────────────────────────────────────────
        // An item may have been queued days ago and only now reached its
        // scheduled slot.  Don't post stale content.
        if (isStale(item)) {
          console.log(`[processIgScheduled] item ${item.id} (${item.igType}) is stale — expiring instead of posting`);
          await igQueueRepo.updateStatus(item.id, "expired", {
            reasons: [...item.reasons, `Expired at post time: exceeded ${STALENESS_TTL_HOURS[item.igType]}h TTL`],
          });
          continue;
        }

        // Atomically claim the item — prevents double-processing when both
        // GHA and Cloud Run runners hit processIgScheduled at the same time.
        const claimed = await igQueueRepo.claimForProcessing(item.id);
        if (!claimed) {
          console.log(`[processIgScheduled] item ${item.id} already claimed by another runner, skipping`);
          continue;
        }

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
