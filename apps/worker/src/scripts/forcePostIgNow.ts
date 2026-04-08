/**
 * forcePostIgNow.ts — immediately render + publish a scheduled IG item.
 *
 * Moves a scheduled item's scheduledFor to 1 minute ago so processIgScheduled
 * treats it as due, then runs the post step.
 *
 * Usage:
 *   npx tsx src/scripts/forcePostIgNow.ts <itemId>
 *   npx tsx src/scripts/forcePostIgNow.ts          ← picks best scheduled item
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { igQueueRepo } from "@edlight-news/firebase";
import { processIgScheduled } from "../jobs/processIgScheduled.js";

const [, , itemId] = process.argv;

async function main() {
  // Find the item to force-post
  let id = itemId?.trim();

  if (!id) {
    // Pick the best (lowest-future) scheduled item
    const scheduled = await igQueueRepo.listScheduled(10);
    const candidates = scheduled.filter(
      (i) => i.status === "scheduled" && i.scheduledFor,
    );
    if (candidates.length === 0) {
      console.log("No scheduled items found — run scheduleIgPost first.");
      process.exit(1);
    }
    // sort by scheduledFor ascending, pick the first (nearest in future)
    candidates.sort((a, b) => (a.scheduledFor! < b.scheduledFor! ? -1 : 1));
    id = candidates[0]!.id;
    console.log(
      `[forcePostIgNow] no item specified — picked ${id} (${candidates[0]!.igType}, scheduled ${candidates[0]!.scheduledFor})`,
    );
  }

  // Verify item exists
  const item = await igQueueRepo.getIGQueueItem(id);
  if (!item) {
    console.error(`[forcePostIgNow] item ${id} not found`);
    process.exit(1);
  }
  console.log(
    `[forcePostIgNow] forcing item: ${id} (type=${item.igType}, status=${item.status}, scheduledFor=${item.scheduledFor})`,
  );

  // Reschedule to 1 min ago so processIgScheduled sees it as due
  const nowMinus1 = new Date(Date.now() - 60_000).toISOString();
  await igQueueRepo.setScheduled(id, nowMinus1);
  console.log(`[forcePostIgNow] rescheduled to ${nowMinus1}`);

  // Run the processing step
  const result = await processIgScheduled();
  console.log("[forcePostIgNow] result:", result);

  if (result.posted > 0) {
    console.log(`\n✅ Successfully posted ${result.posted} item(s)!`);
  } else if (result.errors > 0) {
    console.log(`\n❌ ${result.errors} error(s) — check logs above`);
  } else {
    console.log("\n⚠️  Nothing posted (may have been expired or dry-run)");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
