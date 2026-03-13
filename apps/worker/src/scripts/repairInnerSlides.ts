/**
 * Repair script: Propagate cover image to inner slides.
 *
 * These items were formatted before the background-propagation fix
 * and have a cover slide with backgroundImage but inner slides without one.
 *
 * For each item, copies slide[0].backgroundImage to all inner slides
 * that are missing it, then writes back to Firestore.
 *
 * Usage: npx tsx src/scripts/repairInnerSlides.ts
 * Dry-run: npx tsx src/scripts/repairInnerSlides.ts --dry-run
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";
import { FieldValue } from "firebase-admin/firestore";

const db = getDb();
const DRY_RUN = process.argv.includes("--dry-run");
const ACTIVE_STATUSES = ["queued", "scheduled", "rendering", "scheduled_ready_for_manual"];

async function main() {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  REPAIR: Propagate cover images to inner slides`);
  console.log(`  Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`${"═".repeat(60)}\n`);

  const snap = await db.collection("ig_queue").get();
  const activeDocs = snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .filter((d: any) => ACTIVE_STATUSES.includes(d.status));

  console.log(`Active items in ig_queue: ${activeDocs.length}\n`);

  let repaired = 0;
  let skipped = 0;

  for (const doc of activeDocs) {
    const payload = doc.payload;
    if (!payload?.slides?.length) {
      skipped++;
      continue;
    }

    const slides: any[] = payload.slides;
    const coverImage = slides[0]?.backgroundImage;

    if (!coverImage) {
      // No cover image to propagate
      skipped++;
      continue;
    }

    // Find inner slides missing backgroundImage
    let patchCount = 0;
    for (let i = 1; i < slides.length; i++) {
      if (!slides[i].backgroundImage) {
        slides[i].backgroundImage = coverImage;
        patchCount++;
      }
    }

    if (patchCount === 0) {
      skipped++;
      continue;
    }

    // Patch Firestore
    const caption = (payload.caption ?? "").slice(0, 60);
    console.log(`🔧 ${doc.id} [${doc.status}] ${doc.igType}`);
    console.log(`   Caption: ${caption}...`);
    console.log(`   Patched ${patchCount}/${slides.length - 1} inner slides with cover image`);

    if (!DRY_RUN) {
      await db.collection("ig_queue").doc(doc.id).update({
        "payload.slides": slides,
        updatedAt: FieldValue.serverTimestamp(),
      });
      console.log(`   ✅ Written to Firestore`);
    } else {
      console.log(`   ⏭️  Would write (dry-run)`);
    }
    console.log();
    repaired++;
  }

  console.log(`${"═".repeat(60)}`);
  console.log(`  DONE: ${repaired} repaired, ${skipped} already OK`);
  console.log(`${"═".repeat(60)}\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Repair failed:", err);
  process.exit(1);
});
