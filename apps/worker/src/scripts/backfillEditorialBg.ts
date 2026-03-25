/**
 * Script: backfillEditorialBg
 *
 * Patches all active (queued / scheduled / rendering) opportunity and utility
 * IG queue items so every slide uses the shared premium editorial background.
 *
 * Usage:
 *   pnpm --filter @edlight-news/worker ig:backfill-editorial-bg
 *   pnpm --filter @edlight-news/worker ig:backfill-editorial-bg -- --dry-run
 */

import "dotenv/config";
import { getDb } from "@edlight-news/firebase";
import { ensureOpportunityBackground } from "../services/geminiImageGen.js";
import { FieldValue } from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry-run");
const ACTIVE_STATUSES = ["queued", "scheduled", "rendering", "scheduled_ready_for_manual"];
const TARGET_TYPES = ["opportunity", "utility"];

async function main() {
  console.log(`=== Backfill editorial background (dry-run=${DRY_RUN}) ===\n`);

  // 1. Fetch the branded background URL (generate if needed)
  console.log("Fetching branded background URL...");
  const bgUrl = await ensureOpportunityBackground();
  if (!bgUrl) {
    console.error("✗ Could not get branded background URL — aborting");
    process.exit(1);
  }
  console.log(`✓ Background URL: ${bgUrl.slice(0, 80)}...\n`);

  // 2. Query all active opportunity + utility queue items
  const db = getDb();
  const snap = await db
    .collection("ig_queue")
    .where("status", "in", ACTIVE_STATUSES)
    .where("igType", "in", TARGET_TYPES)
    .get();

  if (snap.empty) {
    console.log("No active opportunity/utility items found.");
    return;
  }

  console.log(`Found ${snap.size} items to patch:\n`);

  let patched = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const igType: string = data.igType ?? "?";
    const status: string = data.status ?? "?";
    const payload = data.payload as { slides?: Array<{ backgroundImage?: string; [k: string]: unknown }> } | undefined;

    if (!payload?.slides?.length) {
      console.log(`  SKIP ${doc.id} (${igType}/${status}) — no payload`);
      skipped++;
      continue;
    }

    // Check if any slide already uses the correct bg (exact URL match)
    const alreadyPatched = payload.slides.every((s) => s.backgroundImage === bgUrl);
    if (alreadyPatched) {
      console.log(`  SKIP ${doc.id} (${igType}/${status}) — already has branded bg`);
      skipped++;
      continue;
    }

    // Patch every slide's backgroundImage
    const updatedSlides = payload.slides.map((slide) => ({
      ...slide,
      backgroundImage: bgUrl,
    }));

    const updatedPayload = { ...payload, slides: updatedSlides };

    console.log(`  PATCH ${doc.id} (${igType}/${status}) — ${updatedSlides.length} slide(s)`);

    if (!DRY_RUN) {
      await db.collection("ig_queue").doc(doc.id).update({
        payload: updatedPayload,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    patched++;
  }

  console.log(`\n=== Done ===`);
  console.log(`  Patched : ${patched}`);
  console.log(`  Skipped : ${skipped}`);
  if (DRY_RUN) console.log(`  (dry-run — no writes made)`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
