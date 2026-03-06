/**
 * ig:reset — Wipe the ig_queue collection and regenerate from scratch.
 *
 * Usage: pnpm --filter @edlight-news/worker ig:reset
 *
 * Steps:
 *  1. Delete all documents in ig_queue
 *  2. Re-run buildIgQueue() with fresh selection + formatting logic
 */

import dotenv from "dotenv";
import path from "node:path";

const envPath = path.resolve(__dirname, "../../../..", ".env");
console.log(`  Loading .env from: ${envPath}`);
dotenv.config({ path: envPath });

import { getDb } from "@edlight-news/firebase";
import { buildIgQueue } from "../jobs/buildIgQueue.js";

async function deleteCollection(collectionName: string, batchSize = 200): Promise<number> {
  const db = getDb();
  const collRef = db.collection(collectionName);
  let totalDeleted = 0;

  while (true) {
    const snap = await collRef.limit(batchSize).get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    totalDeleted += snap.size;
    console.log(`  Deleted ${totalDeleted} ig_queue docs so far…`);
  }

  return totalDeleted;
}

async function main() {
  console.log("\n🗑️  Step 1: Clearing ig_queue collection…");
  const deleted = await deleteCollection("ig_queue");
  console.log(`  ✅ Deleted ${deleted} documents from ig_queue.\n`);

  console.log("🔄  Step 2: Rebuilding ig_queue with updated quality logic…");
  const result = await buildIgQueue();
  console.log(`\n  ✅ Done!`);
  console.log(`     Evaluated: ${result.evaluated}`);
  console.log(`     Queued:    ${result.queued}`);
  console.log(`     Skipped:   ${result.skipped}`);
  console.log(`     Existing:  ${result.alreadyExists}`);
  console.log(`     Errors:    ${result.errors}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
