/**
 * Worker job: processIgScheduled
 *
 * Picks up scheduled IG posts that are due, renders assets, and publishes.
 * Runs as part of the /tick pipeline.
 */

import { igQueueRepo, itemsRepo, uploadCarouselSlides, deleteCarouselSlides } from "@edlight-news/firebase";
import { generateCarouselAssets } from "@edlight-news/renderer/ig-carousel.js";
import { publishIgPost } from "@edlight-news/publisher";
import type { IGQueueItem, IGPostType } from "@edlight-news/types";
import {
  validatePayloadForPublishing,
  type IGPublishIssue,
} from "../services/igPublishValidation.js";
import { generateContextualImage } from "../services/geminiImageGen.js";

// Must match the TTLs in scheduleIgPost.ts
const STALENESS_TTL_HOURS: Record<IGPostType, number> = {
  news: 20,        // daily news — stale after ~1 posting cycle
  taux: 6,         // exchange rate — only valid same-day
  utility: 72,
  histoire: 20,    // fact of the day — stale next day
  opportunity: 336,
  scholarship: 336,
};

/** Post types whose Storage slides should be deleted after posting (ephemeral). */
const EPHEMERAL_IG_TYPES = new Set<IGPostType>(["news", "taux", "histoire"]);

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

function isItemImageUsableForIG(item: Awaited<ReturnType<typeof itemsRepo.getItem>>): boolean {
  if (!item?.imageUrl) return false;

  const width = item.imageMeta?.width;
  const height = item.imageMeta?.height;

  if (item.imageSource === "branded" && (!width || !height)) {
    return false;
  }

  if (!width || !height) return true;
  if (Math.min(width, height) < 1080) return false;
  if (width / Math.max(height, 1) > 2.1) return false;

  return true;
}

function stripUnsafeSlideBackgrounds(
  slidePayload: IGQueueItem["payload"],
  itemImageUrl: string | undefined,
): number {
  if (!slidePayload || !itemImageUrl) return 0;

  let stripped = 0;
  for (const slide of slidePayload.slides) {
    if (slide.backgroundImage === itemImageUrl) {
      delete slide.backgroundImage;
      stripped++;
    }
  }

  return stripped;
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
      if (item.status === "scheduled_ready_for_manual") {
        continue;
      }

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

        const validation = validatePayloadForPublishing(item.payload, item.igType);
        const sourceItem = await itemsRepo.getItem(item.sourceContentId);
        const publishPayload = validation.payload;

        if (sourceItem?.imageUrl && !isItemImageUsableForIG(sourceItem)) {
          const strippedSlides = stripUnsafeSlideBackgrounds(publishPayload, sourceItem.imageUrl);
          if (strippedSlides > 0) {
            console.log(
              `[processIgScheduled] stripped ${strippedSlides} low-resolution background(s) for ${item.id}`,
            );
          }
        }

        const slidesNeedingImage = publishPayload.slides.filter((slide) => !slide.backgroundImage);
        if (slidesNeedingImage.length > 0 && sourceItem) {
          const coverImage = publishPayload.slides[0]?.backgroundImage;

          if (coverImage) {
            // Standard path: propagate cover image to any inner slides that need one.
            for (const slide of slidesNeedingImage) {
              slide.backgroundImage = coverImage;
            }
            console.log(
              `[processIgScheduled] propagated cover image to ${slidesNeedingImage.length} slide(s) for ${item.id}`,
            );
          } else {
            // Cover has no image. Check if inner (content) slides already have one.
            // When the formatter intentionally left the cover empty (e.g. histoire,
            // where the cover uses a clean branded gradient while content slides carry
            // the contextual image), propagate the first content slide's image to the
            // cover so all slides stay visually consistent \u2014 "use the rest's picture".
            const firstContentImage = publishPayload.slides
              .slice(1)
              .find((s) => s.backgroundImage)?.backgroundImage;

            if (firstContentImage) {
              // Apply the content image to the cover and any other empty slides.
              for (const slide of slidesNeedingImage) {
                slide.backgroundImage = firstContentImage;
              }
              console.log(
                `[processIgScheduled] propagated content image to cover + ${slidesNeedingImage.length} slide(s) for ${item.id}`,
              );
            } else {
              // No image anywhere \u2014 generate a contextual one for all empty slides.
              try {
                const generated = await generateContextualImage(sourceItem);
                if (generated?.url) {
                  for (const slide of slidesNeedingImage) {
                    slide.backgroundImage = generated.url;
                  }
                  console.log(
                    `[processIgScheduled] filled ${slidesNeedingImage.length} slide background(s) for ${item.id}`,
                  );
                }
              } catch (imageErr) {
                const msg = imageErr instanceof Error ? imageErr.message : String(imageErr);
                console.warn(`[processIgScheduled] contextual image fallback failed for ${item.id}: ${msg}`);
              }
            }
          }
        }

        if (validation.shouldHold) {
          await igQueueRepo.updateStatus(item.id, "scheduled_ready_for_manual", {
            payload: publishPayload,
            reasons: [
              ...item.reasons,
              ...validation.issues.map((issue: IGPublishIssue) => `Quality hold: ${issue.message}`),
            ],
          });
          console.warn(
            `[processIgScheduled] item ${item.id} held for manual review: ${validation.issues
              .map((issue: IGPublishIssue) => issue.message)
              .join("; ")}`,
          );
          continue;
        }

        // Render assets
        const assets = await generateCarouselAssets(item, publishPayload);

        // Upload rendered PNGs to Firebase Storage so the IG API can access them.
        // In dry-run mode (HTML files) we skip the upload and pass local paths.
        let slideUrls = assets.slidePaths;
        if (assets.mode === "rendered") {
          try {
            slideUrls = await uploadCarouselSlides(assets.slidePaths, item.id);
          } catch (uploadErr) {
            const uploadMsg = uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
            console.warn(`[processIgScheduled] Storage upload failed for ${item.id}: ${uploadMsg}`);
            // Billing-disabled errors won't resolve on retry — hold for manual
            // review instead of cycling back to "scheduled" every tick.
            const isBillingError =
              uploadMsg.includes("billing account") ||
              uploadMsg.includes("delinquent") ||
              uploadMsg.includes("billing is disabled") ||
              uploadMsg.includes("Cloud billing is disabled");
            if (isBillingError) {
              await igQueueRepo.updateStatus(item.id, "scheduled_ready_for_manual", {
                reasons: [...item.reasons, `Storage billing disabled — held for manual: ${uploadMsg}`],
              });
            } else {
              await igQueueRepo.updateStatus(item.id, "scheduled", {
                reasons: [...item.reasons, `Storage upload failed: ${uploadMsg}`],
              });
            }
            result.errors++;
            continue;
          }
        }

        // Publish (or dry-run)
        const publishResult = await publishIgPost(item, publishPayload, slideUrls);

        if (publishResult.posted) {
          await igQueueRepo.markPosted(item.id, publishResult.igPostId);
          result.posted++;
          // Delete slide PNGs from Storage for ephemeral post types to keep
          // storage lean. Scholarship/opportunity slides are kept (evergreen).
          if (EPHEMERAL_IG_TYPES.has(item.igType) && assets.mode === "rendered") {
            deleteCarouselSlides(item.id).catch((err) =>
              console.warn(`[processIgScheduled] slide cleanup failed for ${item.id}:`, err),
            );
          }
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
