/**
 * One-off script: delete slide PNGs from Firebase Storage for already-posted
 * IG queue items whose type is ephemeral (news, taux, histoire).
 *
 * Scholarship / opportunity / utility slides are kept (still relevant).
 *
 * Usage: npx tsx src/scripts/purgeIgStorage.ts
 * Add --dry-run to preview without deleting.
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";
import { deleteCarouselSlides } from "@edlight-news/firebase";

const DRY_RUN = process.argv.includes("--dry-run");
const EPHEMERAL_TYPES = new Set(["news", "taux", "histoire"]);

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN ===" : "=== LIVE DELETE ===");

  const db = getDb();

  // Get all posted + expired items of ephemeral types
  const snap = await db
    .collection("ig_queue")
    .where("status", "in", ["posted", "expired"])
    .get();

  console.log(`Found ${snap.size} posted/expired items total.`);

  let deleted = 0;
  let skipped = 0;
  let notFound = 0;

  for (const doc of snap.docs) {
    const igType = doc.data().igType as string;

    if (!EPHEMERAL_TYPES.has(igType)) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry] would delete slides for ${doc.id} (${igType})`);
      deleted++;
      continue;
    }

    try {
      await deleteCarouselSlides(doc.id);
      deleted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("No such object") || msg.includes("Not Found")) {
        notFound++; // Already deleted or never uploaded — fine
      } else {
        console.warn(`  WARN ${doc.id}: ${msg}`);
      }
    }
  }

  console.log(`\nDone: deleted=${deleted} skipped=${skipped} not_found=${notFound}`);
  if (DRY_RUN) console.log("Re-run without --dry-run to actually delete.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
