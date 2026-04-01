/**
 * Diagnostic script: dump today's IG queue state and check staple coverage.
 * Run with: pnpm tsx src/scripts/_diagIgQueue.ts
 */
import { igQueueRepo } from "@edlight-news/firebase";

async function main() {
  const posted = await igQueueRepo.countPostedToday();
  const scheduled = await igQueueRepo.countScheduledToday();
  const todayItems = await igQueueRepo.listPostedAndScheduledToday();

  console.log("=== TODAY ===");
  console.log("posted:", posted, "  scheduled:", scheduled);
  console.log("today items:", JSON.stringify(todayItems, null, 2));

  const sched = await igQueueRepo.listScheduled(10);
  console.log("\n=== SCHEDULED ITEMS ===");
  sched.forEach((i) =>
    console.log(" ", i.id, i.igType, i.status, i.scheduledFor, "targetPostDate:", i.targetPostDate),
  );

  const queued = await igQueueRepo.listQueuedByScore(50);
  const types: Record<string, number> = {};
  queued.forEach((i) => {
    types[i.igType ?? "undefined"] = (types[i.igType ?? "undefined"] ?? 0) + 1;
  });
  console.log("\n=== QUEUED BY TYPE ===", types);

  const taux = queued.find((i) => i.igType === "taux");
  const histoire = queued.find((i) => i.igType === "histoire");
  const utility = queued.find((i) => i.igType === "utility");
  console.log("taux in queue:", !!taux, taux?.targetPostDate);
  console.log("histoire in queue:", !!histoire, histoire?.targetPostDate);
  console.log("utility in queue:", !!utility, utility?.targetPostDate);

  const allSched = await igQueueRepo.listAllScheduled(20);
  console.log("\n=== ALL SCHEDULED ===", allSched.length, "items");
  allSched.forEach((i) =>
    console.log(" ", i.id, i.igType, i.scheduledFor, "targetPostDate:", i.targetPostDate),
  );
}

main().catch(console.error);
