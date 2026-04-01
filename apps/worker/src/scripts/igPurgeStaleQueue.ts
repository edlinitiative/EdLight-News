/**
 * Purge stale ig_queue documents.
 *
 * Deletes:
 *  1. ALL docs with status "skipped"  — legacy entries written by the old
 *     buildIgQueue before the quota fix (never post, just waste reads/storage)
 *  2. Docs with status "queued" or "expired" older than 30 days
 *
 * Safe to re-run. Does NOT touch "posted", "scheduled", or "rendering" docs.
 *
 * Usage: cd apps/worker && npx tsx src/scripts/igPurgeStaleQueue.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";
import { Timestamp } from "firebase-admin/firestore";

const BATCH_SIZE = 400;

async function deleteInBatches(
  db: FirebaseFirestore.Firestore,
  query: FirebaseFirestore.Query,
  label: string,
): Promise<number> {
  let deleted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const snap = await query.limit(BATCH_SIZE).get();
    if (snap.empty) break;
    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += snap.docs.length;
    process.stdout.write(`\r    ${deleted} ${label} docs deleted...`);
    if (snap.docs.length < BATCH_SIZE) break;
  }
  if (deleted > 0) process.stdout.write("\n");
  return deleted;
}

async function main() {
  const db = getDb();
  const col = db.collection("ig_queue");

  console.log("\n🧹  Purging stale ig_queue documents…\n");

  // Count before
  const beforeCount = (await col.count().get()).data().count;
  console.log(`  Collection size before: ${beforeCount} docs\n`);

  // ── Step 1: Delete all "skipped" docs ─────────────────────────────────────
  console.log("  [1/2] Deleting legacy 'skipped' docs…");
  const skippedQuery = col.where("status", "==", "skipped");
  const deletedSkipped = await deleteInBatches(db, skippedQuery, "skipped");
  console.log(`  ✓ Deleted ${deletedSkipped} skipped docs\n`);

  // ── Step 2: Delete stale "queued" / "expired" docs (> 30 days old) ────────
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffTs = Timestamp.fromDate(cutoff);
  console.log(`  [2/2] Deleting stale queued/expired docs (older than ${cutoff.toDateString()})…`);
  const staleQuery = col
    .where("status", "in", ["queued", "expired"])
    .where("createdAt", "<", cutoffTs);
  const deletedStale = await deleteInBatches(db, staleQuery, "stale queued/expired");
  console.log(`  ✓ Deleted ${deletedStale} stale queued/expired docs\n`);

  // Count after
  const afterCount = (await col.count().get()).data().count;
  console.log(`  Collection size after:  ${afterCount} docs`);
  console.log(`  Freed:                  ${beforeCount - afterCount} docs\n`);
  console.log("✅  Done.\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
