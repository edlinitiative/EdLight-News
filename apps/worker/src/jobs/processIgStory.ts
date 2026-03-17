/**
 * Worker job: processIgStory
 *
 * Picks up queued story items from ig_story_queue, renders the frames,
 * uploads to Firebase Storage, and publishes each frame as an IG Story.
 *
 * IG Stories are single-image posts (no carousel). To create a multi-frame
 * "story sequence", we publish multiple STORIES in rapid succession.
 * Instagram shows them in order, each for ~5 seconds.
 */

import { igStoryQueueRepo, uploadStorySlide } from "@edlight-news/firebase";
import { generateStoryAssets } from "@edlight-news/renderer/ig-story.js";
import { publishIgStory } from "@edlight-news/publisher";
import type { IGStoryQueueItem } from "@edlight-news/types";
import { validateStoryPayloadForPublishing } from "../services/igPublishValidation.js";
import type { IGPublishIssue } from "@edlight-news/generator/ig/index.js";

export interface ProcessIgStoryResult {
  processed: number;
  posted: number;
  dryRun: number;
  errors: number;
}

export const processIgStoryDeps = {
  listQueuedStories: (limit: number) => igStoryQueueRepo.listByStatus("queued", limit),
  updateStoryStatus: (
    id: string,
    status: IGStoryQueueItem["status"],
    data?: Record<string, unknown>,
  ) => igStoryQueueRepo.updateStatus(id, status, data),
  validateStoryPayloadForPublishing,
  generateStoryAssets,
  uploadStorySlide,
  publishIgStory,
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function summarizeStoryValidationIssues(messages: string[]): string {
  return messages.slice(0, 3).join(" | ");
}

export async function processIgStory(): Promise<ProcessIgStoryResult> {
  const result: ProcessIgStoryResult = {
    processed: 0,
    posted: 0,
    dryRun: 0,
    errors: 0,
  };

  try {
    const queued = await processIgStoryDeps.listQueuedStories(5);

    for (const storyItem of queued) {
      result.processed++;

      try {
        if (!storyItem.payload) {
          console.warn(`[processIgStory] item ${storyItem.id} has no payload, skipping`);
          await processIgStoryDeps.updateStoryStatus(storyItem.id, "skipped", {
            error: "No payload at render time",
          });
          result.errors++;
          continue;
        }

        const validation = processIgStoryDeps.validateStoryPayloadForPublishing(
          storyItem.payload,
        );
        if (validation.shouldHold) {
          const validationSummary = summarizeStoryValidationIssues(
            validation.issues.map((issue: IGPublishIssue) => issue.message),
          );
          console.warn(
            `[processIgStory] Validation hold for ${storyItem.id}: ${validationSummary}`,
          );
          await processIgStoryDeps.updateStoryStatus(storyItem.id, "failed", {
            error: `Story validation failed: ${validationSummary}`,
          });
          result.errors++;
          continue;
        }

        // Mark as rendering
        await processIgStoryDeps.updateStoryStatus(storyItem.id, "rendering");

        // Render story frames
        const assets = await processIgStoryDeps.generateStoryAssets(
          storyItem,
          validation.payload,
        );

        if (assets.mode === "rendered") {
          // Upload & publish each frame as a separate Story
          let allPosted = true;
          let lastMediaId: string | undefined;

          for (let i = 0; i < assets.slidePaths.length; i++) {
            try {
              // Upload frame to Firebase Storage
              const publicUrl = await processIgStoryDeps.uploadStorySlide(
                assets.slidePaths[i]!,
                storyItem.id,
                i,
              );

              // Publish to IG
              const publishResult = await processIgStoryDeps.publishIgStory(
                publicUrl,
                storyItem.id,
              );

              if (publishResult.posted) {
                lastMediaId = publishResult.igMediaId;
                console.log(`[processIgStory] Frame ${i + 1}/${assets.slidePaths.length} posted: ${publishResult.igMediaId}`);
              } else if (publishResult.dryRun) {
                result.dryRun++;
                allPosted = false;
              } else {
                console.warn(`[processIgStory] Frame ${i + 1} failed: ${publishResult.error}`);
                allPosted = false;
              }

              // Brief pause between frames so IG processes them in order
              if (i < assets.slidePaths.length - 1) {
                await processIgStoryDeps.sleep(3000);
              }
            } catch (err) {
              console.warn(`[processIgStory] Frame ${i + 1} error:`, err instanceof Error ? err.message : err);
              allPosted = false;
            }
          }

          if (allPosted && lastMediaId) {
            await processIgStoryDeps.updateStoryStatus(storyItem.id, "posted", {
              igMediaId: lastMediaId,
            });
            result.posted++;
          } else if (result.dryRun > 0) {
            // Dry-run mode — mark as queued so it retries when creds are set
            await processIgStoryDeps.updateStoryStatus(storyItem.id, "queued");
          } else {
            await processIgStoryDeps.updateStoryStatus(storyItem.id, "failed", {
              error: "Not all frames published successfully",
            });
            result.errors++;
          }
        } else {
          // Dry-run HTML mode — no IG credentials
          console.log(`[processIgStory] Dry-run: ${assets.slidePaths.length} frames → ${assets.exportDir}`);
          await processIgStoryDeps.updateStoryStatus(storyItem.id, "queued");
          result.dryRun++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[processIgStory] Error processing ${storyItem.id}:`, msg);
        await processIgStoryDeps.updateStoryStatus(storyItem.id, "failed", { error: msg });
        result.errors++;
      }
    }

    if (result.processed > 0) {
      console.log(
        `[processIgStory] processed=${result.processed} posted=${result.posted} dryRun=${result.dryRun} errors=${result.errors}`,
      );
    }
  } catch (err) {
    console.error("[processIgStory] fatal error:", err);
    result.errors++;
  }

  return result;
}
