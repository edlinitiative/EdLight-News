/**
 * Worker job: processFbScheduled
 *
 * Runs on every tick. Picks FB queue items whose scheduledFor time
 * has passed, sends them via the Facebook Graph API (or dry-run),
 * and updates their status.
 *
 * Modeled on processWaScheduled — same claim-send-update pattern.
 */

import { fbQueueRepo } from "@edlight-news/firebase";
import { publishToFacebook } from "@edlight-news/publisher";
import type { FbQueueItem, FbMessagePayload } from "@edlight-news/types";

/** Max send retries before marking as failed. */
const MAX_SEND_RETRIES = 3;

export interface ProcessFbScheduledResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  dryRun: number;
}

export async function processFbScheduled(): Promise<ProcessFbScheduledResult> {
  const result: ProcessFbScheduledResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    dryRun: 0,
  };

  try {
    const scheduled = await fbQueueRepo.listScheduled(20);
    const now = new Date();

    const due = scheduled.filter((item) => {
      if (!item.scheduledFor) return false;
      return new Date(item.scheduledFor) <= now;
    });

    if (due.length === 0) {
      console.log("[processFbScheduled] No FB items due");
      return result;
    }

    console.log(`[processFbScheduled] ${due.length} FB item(s) due for sending`);

    for (const item of due) {
      result.processed++;

      try {
        const claimed = await fbQueueRepo.claimForSending(item.id);
        if (!claimed) {
          console.log(`[processFbScheduled] ${item.id} already claimed — skipping`);
          result.skipped++;
          continue;
        }

        if ((item.sendRetries ?? 0) >= MAX_SEND_RETRIES) {
          console.warn(`[processFbScheduled] ${item.id} exceeded retry limit — marking failed`);
          await fbQueueRepo.updateStatus(item.id, "failed", {
            error: `Exceeded max retries (${MAX_SEND_RETRIES})`,
          });
          result.failed++;
          continue;
        }

        if (!item.payload?.text) {
          console.warn(`[processFbScheduled] ${item.id} has no payload text — marking failed`);
          await fbQueueRepo.updateStatus(item.id, "failed", {
            error: "Missing payload text",
          });
          result.failed++;
          continue;
        }

        const publishResult = await publishToFacebook(
          item as FbQueueItem,
          item.payload as FbMessagePayload,
        );

        if (publishResult.dryRun) {
          await fbQueueRepo.markSent(item.id, undefined, { dryRun: true });
          result.dryRun++;
          console.log(`[processFbScheduled] ${item.id} dry-run complete`);
          continue;
        }

        if (publishResult.posted && publishResult.fbPostId) {
          await fbQueueRepo.markSent(item.id, publishResult.fbPostId);
          result.sent++;
          console.log(`[processFbScheduled] ${item.id} sent: ${publishResult.fbPostId}`);
        } else {
          const retries = (item.sendRetries ?? 0) + 1;
          await fbQueueRepo.updateStatus(item.id, "scheduled", {
            sendRetries: retries,
            error: publishResult.error ?? "Unknown error",
          });
          result.failed++;
          console.warn(
            `[processFbScheduled] ${item.id} failed (retry ${retries}/${MAX_SEND_RETRIES}): ${publishResult.error}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[processFbScheduled] Error processing ${item.id}:`, msg);

        try {
          const retries = (item.sendRetries ?? 0) + 1;
          await fbQueueRepo.updateStatus(item.id, "scheduled", {
            sendRetries: retries,
            error: msg,
          });
        } catch {
          // Best effort
        }
        result.failed++;
      }
    }

    console.log("[processFbScheduled] Done:", result);
    return result;
  } catch (err) {
    console.error("[processFbScheduled] Fatal error:", err);
    return result;
  }
}
