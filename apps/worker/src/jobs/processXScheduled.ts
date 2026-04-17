/**
 * Worker job: processXScheduled
 *
 * Runs on every tick. Picks X (Twitter) queue items whose scheduledFor
 * time has passed, sends them via the X API v2 (or dry-run), and
 * updates their status.
 *
 * Modeled on processWaScheduled — same claim-send-update pattern.
 */

import { xQueueRepo } from "@edlight-news/firebase";
import { publishToX } from "@edlight-news/publisher";
import type { XQueueItem, XMessagePayload } from "@edlight-news/types";

/** Max send retries before marking as failed. */
const MAX_SEND_RETRIES = 3;

export interface ProcessXScheduledResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  dryRun: number;
}

export async function processXScheduled(): Promise<ProcessXScheduledResult> {
  const result: ProcessXScheduledResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    dryRun: 0,
  };

  try {
    const scheduled = await xQueueRepo.listScheduled(20);
    const now = new Date();

    const due = scheduled.filter((item) => {
      if (!item.scheduledFor) return false;
      return new Date(item.scheduledFor) <= now;
    });

    if (due.length === 0) {
      console.log("[processXScheduled] No X items due");
      return result;
    }

    console.log(`[processXScheduled] ${due.length} X item(s) due for sending`);

    for (const item of due) {
      result.processed++;

      try {
        const claimed = await xQueueRepo.claimForSending(item.id);
        if (!claimed) {
          console.log(`[processXScheduled] ${item.id} already claimed — skipping`);
          result.skipped++;
          continue;
        }

        if ((item.sendRetries ?? 0) >= MAX_SEND_RETRIES) {
          console.warn(`[processXScheduled] ${item.id} exceeded retry limit — marking failed`);
          await xQueueRepo.updateStatus(item.id, "failed", {
            error: `Exceeded max retries (${MAX_SEND_RETRIES})`,
          });
          result.failed++;
          continue;
        }

        if (!item.payload?.text) {
          console.warn(`[processXScheduled] ${item.id} has no payload text — marking failed`);
          await xQueueRepo.updateStatus(item.id, "failed", {
            error: "Missing payload text",
          });
          result.failed++;
          continue;
        }

        const publishResult = await publishToX(
          item as XQueueItem,
          item.payload as XMessagePayload,
        );

        if (publishResult.dryRun) {
          await xQueueRepo.markSent(item.id, undefined, { dryRun: true });
          result.dryRun++;
          console.log(`[processXScheduled] ${item.id} dry-run complete`);
          continue;
        }

        if (publishResult.posted && publishResult.xTweetId) {
          await xQueueRepo.markSent(item.id, publishResult.xTweetId);
          result.sent++;
          console.log(`[processXScheduled] ${item.id} sent: ${publishResult.xTweetId}`);
        } else {
          const retries = (item.sendRetries ?? 0) + 1;
          await xQueueRepo.updateStatus(item.id, "scheduled", {
            sendRetries: retries,
            error: publishResult.error ?? "Unknown error",
          });
          result.failed++;
          console.warn(
            `[processXScheduled] ${item.id} failed (retry ${retries}/${MAX_SEND_RETRIES}): ${publishResult.error}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[processXScheduled] Error processing ${item.id}:`, msg);

        try {
          const retries = (item.sendRetries ?? 0) + 1;
          await xQueueRepo.updateStatus(item.id, "scheduled", {
            sendRetries: retries,
            error: msg,
          });
        } catch {
          // Best effort
        }
        result.failed++;
      }
    }

    console.log("[processXScheduled] Done:", result);
    return result;
  } catch (err) {
    console.error("[processXScheduled] Fatal error:", err);
    return result;
  }
}
