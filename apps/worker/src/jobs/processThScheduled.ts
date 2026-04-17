/**
 * Worker job: processThScheduled
 *
 * Runs on every tick. Picks Threads queue items whose scheduledFor time
 * has passed, sends them via the Threads Publishing API (or dry-run),
 * and updates their status.
 *
 * Modeled on processWaScheduled — same claim-send-update pattern.
 */

import { thQueueRepo } from "@edlight-news/firebase";
import { publishToThreads } from "@edlight-news/publisher";
import type { ThQueueItem, ThMessagePayload } from "@edlight-news/types";

/** Max send retries before marking as failed. */
const MAX_SEND_RETRIES = 3;

export interface ProcessThScheduledResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  dryRun: number;
}

export async function processThScheduled(): Promise<ProcessThScheduledResult> {
  const result: ProcessThScheduledResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    dryRun: 0,
  };

  try {
    const scheduled = await thQueueRepo.listScheduled(20);
    const now = new Date();

    const due = scheduled.filter((item) => {
      if (!item.scheduledFor) return false;
      return new Date(item.scheduledFor) <= now;
    });

    if (due.length === 0) {
      console.log("[processThScheduled] No Threads items due");
      return result;
    }

    console.log(`[processThScheduled] ${due.length} Threads item(s) due for sending`);

    for (const item of due) {
      result.processed++;

      try {
        const claimed = await thQueueRepo.claimForSending(item.id);
        if (!claimed) {
          console.log(`[processThScheduled] ${item.id} already claimed — skipping`);
          result.skipped++;
          continue;
        }

        if ((item.sendRetries ?? 0) >= MAX_SEND_RETRIES) {
          console.warn(`[processThScheduled] ${item.id} exceeded retry limit — marking failed`);
          await thQueueRepo.updateStatus(item.id, "failed", {
            error: `Exceeded max retries (${MAX_SEND_RETRIES})`,
          });
          result.failed++;
          continue;
        }

        if (!item.payload?.text) {
          console.warn(`[processThScheduled] ${item.id} has no payload text — marking failed`);
          await thQueueRepo.updateStatus(item.id, "failed", {
            error: "Missing payload text",
          });
          result.failed++;
          continue;
        }

        const publishResult = await publishToThreads(
          item as ThQueueItem,
          item.payload as ThMessagePayload,
        );

        if (publishResult.dryRun) {
          await thQueueRepo.markSent(item.id, undefined, { dryRun: true });
          result.dryRun++;
          console.log(`[processThScheduled] ${item.id} dry-run complete`);
          continue;
        }

        if (publishResult.posted && publishResult.thPostId) {
          await thQueueRepo.markSent(item.id, publishResult.thPostId);
          result.sent++;
          console.log(`[processThScheduled] ${item.id} sent: ${publishResult.thPostId}`);
        } else {
          const retries = (item.sendRetries ?? 0) + 1;
          await thQueueRepo.updateStatus(item.id, "scheduled", {
            sendRetries: retries,
            error: publishResult.error ?? "Unknown error",
          });
          result.failed++;
          console.warn(
            `[processThScheduled] ${item.id} failed (retry ${retries}/${MAX_SEND_RETRIES}): ${publishResult.error}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[processThScheduled] Error processing ${item.id}:`, msg);

        try {
          const retries = (item.sendRetries ?? 0) + 1;
          await thQueueRepo.updateStatus(item.id, "scheduled", {
            sendRetries: retries,
            error: msg,
          });
        } catch {
          // Best effort
        }
        result.failed++;
      }
    }

    console.log("[processThScheduled] Done:", result);
    return result;
  } catch (err) {
    console.error("[processThScheduled] Fatal error:", err);
    return result;
  }
}
