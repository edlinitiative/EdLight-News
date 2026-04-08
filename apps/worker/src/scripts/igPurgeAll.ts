/**
 * Purge ALL ig_queue documents from Firestore and their Storage slides.
 * This is the "start fresh" nuclear option.
 *
 * Usage:  npx tsx src/scripts/igPurgeAll.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { igQueueRepo, deleteCarouselSlides } from "@edlight-news/firebase";

async function main() {
  console.log("🗑️  Purging ALL ig_queue documents + Storage slides…\n");

  // 1. Grab all doc IDs so we can clean Storage
  const allItems = await igQueueRepo.listAll(5000);
  console.log(`   Found ${allItems.length} queue items.`);

  if (allItems.length === 0) {
    console.log("   Nothing to purge — queue is already empty. ✓");
    return;
  }

  // 2. Delete Storage slides (best-effort, in parallel batches of 20)
  const ids = allItems.map((item) => item.id);
  let storageOk = 0;
  let storageFail = 0;
  const BATCH = 20;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((id) => deleteCarouselSlides(id)),
    );
    storageOk += results.filter((r) => r.status === "fulfilled").length;
    storageFail += results.filter((r) => r.status === "rejected").length;
    process.stdout.write(`   Storage: ${storageOk + storageFail}/${ids.length}\r`);
  }
  console.log(`\n   Storage cleanup: ${storageOk} ok, ${storageFail} failed`);

  // 3. Purge Firestore docs
  const docsDeleted = await igQueueRepo.purgeAll();

  console.log(`\n✅ Purged ${docsDeleted} queue items. Fresh start! 🚀\n`);
}

main().catch((err) => {
  console.error("Purge failed:", err);
  process.exit(1);
});
