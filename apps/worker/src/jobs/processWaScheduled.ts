/**
 * Worker job: processWaScheduled
 *
 * Runs on every tick. Picks WA queue items whose scheduledFor time
 * has passed, sends them via the WhatsApp Business API (or dry-run),
 * and updates their status.
 *
 * Much simpler than processIgScheduled — no rendering step, no image
 * generation, no slide validation. Just text + optional image URL.
 */

import { waQueueRepo } from "@edlight-news/firebase";
import { publishToWhatsApp } from "@edlight-news/publisher";
import type { WaQueueItem, WaMessagePayload } from "@edlight-news/types";

/** Max send retries before marking as failed. */
const MAX_SEND_RETRIES = 3;

export interface ProcessWaScheduledResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  dryRun: number;
}

export async function processWaScheduled(): Promise<ProcessWaScheduledResult> {
  const result: ProcessWaScheduledResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    dryRun: 0,
  };

  try {
    // Get scheduled items
    const scheduled = await waQueueRepo.listScheduled(20);
    const now = new Date();

    // Filter to items that are due
    const due = scheduled.filter((item) => {
      if (!item.scheduledFor) return false;
      return new Date(item.scheduledFor) <= now;
    });

    if (due.length === 0) {
      console.log("[processWaScheduled] No WA items due");
      return result;
    }

    console.log(`[processWaScheduled] ${due.length} WA item(s) due for sending`);

    for (const item of due) {
      result.processed++;

      try {
        // Atomically claim the item
        const claimed = await waQueueRepo.claimForSending(item.id);
        if (!claimed) {
          console.log(`[processWaScheduled] ${item.id} already claimed — skipping`);
          result.skipped++;
          continue;
        }

        // Check retry limit
        if ((item.sendRetries ?? 0) >= MAX_SEND_RETRIES) {
          console.warn(`[processWaScheduled] ${item.id} exceeded retry limit — marking failed`);
          await waQueueRepo.updateStatus(item.id, "failed", {
            error: `Exceeded max retries (${MAX_SEND_RETRIES})`,
          });
          result.failed++;
          continue;
        }

        // Validate payload
        if (!item.payload?.text) {
          console.warn(`[processWaScheduled] ${item.id} has no payload text — marking failed`);
          await waQueueRepo.updateStatus(item.id, "failed", {
            error: "Missing payload text",
          });
          result.failed++;
          continue;
        }

        // Send via publisher
        const publishResult = await publishToWhatsApp(
          item as WaQueueItem,
          item.payload as WaMessagePayload,
        );

        if (publishResult.dryRun) {
          // Dry-run mode — mark as sent (simulated)
          await waQueueRepo.markSent(item.id, undefined, {
            dryRun: true,
          });
          result.dryRun++;
          console.log(`[processWaScheduled] ${item.id} dry-run complete`);
          continue;
        }

        if (publishResult.sent && publishResult.waMessageId) {
          // Success
          await waQueueRepo.markSent(item.id, publishResult.waMessageId);
          result.sent++;
          console.log(`[processWaScheduled] ${item.id} sent: ${publishResult.waMessageId}`);
        } else {
          // Failed — increment retry count
          const retries = (item.sendRetries ?? 0) + 1;
          await waQueueRepo.updateStatus(item.id, "scheduled", {
            sendRetries: retries,
            error: publishResult.error ?? "Unknown error",
          });
          result.failed++;
          console.warn(
            `[processWaScheduled] ${item.id} failed (retry ${retries}/${MAX_SEND_RETRIES}): ${publishResult.error}`,
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[processWaScheduled] Error processing ${item.id}:`, msg);

        // Put back to scheduled with incremented retry count
        try {
          const retries = (item.sendRetries ?? 0) + 1;
          await waQueueRepo.updateStatus(item.id, "scheduled", {
            sendRetries: retries,
            error: msg,
          });
        } catch {
          // Best effort
        }
        result.failed++;
      }
    }

    console.log("[processWaScheduled] Done:", result);
    return result;
  } catch (err) {
    console.error("[processWaScheduled] Fatal error:", err);
    return result;
  }
}
