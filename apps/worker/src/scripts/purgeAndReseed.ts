/**
 * Purge all data from Firestore collections (raw_items, items, content_versions)
 * and re-seed sources. Use this to reset the pipeline for a clean re-run.
 *
 * Usage: npx tsx src/scripts/purgeAndReseed.ts
 */
import path from "path";
import dotenv from "dotenv";

// Resolve .env from monorepo root — works whether run from apps/worker or root
const envPath = path.resolve(process.cwd(), ".env").includes("apps/worker")
  ? path.resolve(process.cwd(), "../..", ".env")
  : path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

import { getDb } from "@edlight-news/firebase";

const COLLECTIONS_TO_PURGE = [
  "raw_items",
  "items",
  "content_versions",
  "assets",
  "publish_queue",
  "metrics",
];

async function deleteCollection(name: string): Promise<number> {
  const db = getDb();
  const coll = db.collection(name);
  let deleted = 0;

  // Firestore batch delete limit is 500
  while (true) {
    const snap = await coll.limit(500).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
  }

  return deleted;
}

async function main() {
  console.log("=== Purging pipeline data ===");

  for (const name of COLLECTIONS_TO_PURGE) {
    const count = await deleteCollection(name);
    console.log(`  🗑️  ${name}: deleted ${count} docs`);
  }

  console.log("\n=== Done! Now run: pnpm seed:sources ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
