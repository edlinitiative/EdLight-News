/**
 * One-time Firestore migration: recompute dedupeGroupId for ALL items.
 *
 * The old formula was sha256(normalizedTitle + "::" + publisherDomain),
 * which meant same-story articles from different publishers got different
 * group IDs — making synthesis impossible.
 *
 * The new formula is sha256(normalizedTitle) only, so cross-publisher
 * clusters can form.
 *
 * Usage:
 *   pnpm backfill:dedupe                          # live writes
 *   BACKFILL_DRY_RUN=true pnpm backfill:dedupe    # log-only, no writes
 *
 * Safe to re-run — idempotent (same title always produces same hash).
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";
import type { Item } from "@edlight-news/types";
import { computeDedupeGroupId } from "../services/scoring.js";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.BACKFILL_DRY_RUN === "true";
const BATCH_SIZE = 300;

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n🔄 Backfill dedupeGroupId — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE MODE"}\n`,
  );

  const db = getDb();
  const col = db.collection("items");

  let totalScanned = 0;
  let totalUpdated = 0;
  let totalUnchanged = 0;
  let totalSkipped = 0;
  let lastDocSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  let hasMore = true;

  while (hasMore) {
    let query = col.orderBy("createdAt", "asc").limit(BATCH_SIZE);

    if (lastDocSnap) {
      query = query.startAfter(lastDocSnap);
    }

    const snap = await query.get();

    if (snap.empty) {
      hasMore = false;
      break;
    }

    lastDocSnap = snap.docs[snap.docs.length - 1];

    // Process with BulkWriter for concurrency
    const writer = DRY_RUN ? null : db.bulkWriter();
    if (writer) {
      writer.onWriteError((error) => {
        console.error(
          `  ❌ Write error for ${error.documentRef.path}: ${error.message}`,
        );
        return false;
      });
    }

    let batchUpdated = 0;
    let batchUnchanged = 0;

    for (const doc of snap.docs) {
      totalScanned++;
      const item = { id: doc.id, ...doc.data() } as Item;

      // Skip synthesis items — they already have the right clusterId
      if (item.itemType === "synthesis") continue;

      try {
        const newGroupId = computeDedupeGroupId(item.title);
        const oldGroupId = item.dedupeGroupId;

        if (oldGroupId === newGroupId) {
          batchUnchanged++;
          totalUnchanged++;
          continue;
        }

        if (DRY_RUN) {
          console.log(
            `  [DRY] ${item.id} "${item.title.slice(0, 50)}…"` +
              `  old=${oldGroupId?.slice(0, 8) ?? "none"}…` +
              ` → new=${newGroupId.slice(0, 8)}…`,
          );
        } else {
          writer!.update(doc.ref, { dedupeGroupId: newGroupId });
        }

        batchUpdated++;
        totalUpdated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ⚠ Error processing ${item.id}: ${msg}`);
        totalSkipped++;
      }
    }

    if (writer) {
      await writer.close();
    }

    console.log(
      `  📦 Batch: ${snap.docs.length} scanned, ${batchUpdated} updated, ${batchUnchanged} unchanged`,
    );

    if (snap.docs.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`\n✅ Backfill dedupeGroupId complete`);
  console.log(`   Scanned:    ${totalScanned}`);
  console.log(`   Updated:    ${totalUpdated}`);
  console.log(`   Unchanged:  ${totalUnchanged}`);
  console.log(`   Skipped:    ${totalSkipped}`);
  console.log(`   Mode:       ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
