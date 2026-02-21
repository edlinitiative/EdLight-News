/**
 * One-time Firestore migration: backfill v2 fields for legacy items.
 *
 * Queries items where audienceFitScore is missing and computes:
 *   - audienceFitScore (0..1)
 *   - geoTag ("HT"|"Diaspora"|"Global")
 *   - dedupeGroupId (sha256 of normalizedTitle + domain)
 *   - qualityFlags.offMission / weakSource / missingDeadline
 *   - source (ItemSource from canonicalUrl + citations)
 *
 * Uses the same deterministic rules as the live worker pipeline.
 *
 * Usage:
 *   pnpm backfill:items                          # live writes
 *   BACKFILL_DRY_RUN=true pnpm backfill:items    # log-only, no writes
 *
 * Safe to re-run — only touches items still missing audienceFitScore.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";
import type { Item } from "@edlight-news/types";
import {
  computeScoring,
  computeDedupeGroupId,
  buildItemSource,
} from "../services/scoring.js";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.BACKFILL_DRY_RUN === "true";
const BATCH_SIZE = 200; // Firestore query page size
const WRITE_CONCURRENCY = 50; // BulkWriter max concurrent writes

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔄 Backfill legacy items — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE MODE"}\n`);

  const db = getDb();
  const col = db.collection("items");

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let lastDocSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  // Paginate through all items missing audienceFitScore
  // Firestore doesn't support "where field does not exist" natively,
  // so we query all items ordered by createdAt and filter in-app.
  // We use a cursor-based approach for efficient pagination.
  let hasMore = true;

  while (hasMore) {
    let query = col
      .orderBy("createdAt", "asc")
      .limit(BATCH_SIZE);

    if (lastDocSnap) {
      query = query.startAfter(lastDocSnap);
    }

    const snap = await query.get();

    if (snap.empty) {
      hasMore = false;
      break;
    }

    // Filter to legacy items (missing audienceFitScore)
    const legacyDocs = snap.docs.filter((doc) => {
      const data = doc.data();
      return data.audienceFitScore === undefined || data.audienceFitScore === null;
    });

    // Track cursor for next page
    lastDocSnap = snap.docs[snap.docs.length - 1];

    if (legacyDocs.length === 0) {
      // No legacy in this page, but there may be more pages
      if (snap.docs.length < BATCH_SIZE) {
        hasMore = false;
      }
      continue;
    }

    // Process legacy items with BulkWriter for concurrency control
    const writer = DRY_RUN ? null : db.bulkWriter();
    if (writer) {
      writer.onWriteError((error) => {
        console.error(`  ❌ Write error for ${error.documentRef.path}: ${error.message}`);
        return false; // don't retry
      });
    }

    for (const doc of legacyDocs) {
      const item = { id: doc.id, ...doc.data() } as Item;
      totalProcessed++;

      try {
        // Compute scoring from title + available text
        const textForScoring = `${item.title} ${item.extractedText || item.summary || ""}`;
        const scoring = computeScoring(item.title, textForScoring, item.category);

        // Compute dedupeGroupId
        const dedupeGroupId = computeDedupeGroupId(item.title, item.canonicalUrl);

        // Build source object from existing data
        const sourceName = item.citations?.[0]?.sourceName ?? "Unknown";
        const sourceUrl = item.citations?.[0]?.sourceUrl ?? item.canonicalUrl;
        const { source: itemSource, weakSource } = buildItemSource(sourceName, sourceUrl);

        // Determine missingDeadline for scholarship/opportunity
        const isScholarshipLike =
          item.category === "scholarship" || item.category === "opportunity";
        const missingDeadline = isScholarshipLike && !item.deadline;

        // Build update payload
        const update: Record<string, unknown> = {
          audienceFitScore: scoring.audienceFitScore,
          geoTag: scoring.geoTag,
          dedupeGroupId,
          source: itemSource,
          "qualityFlags.offMission": scoring.offMission,
          "qualityFlags.weakSource": weakSource,
          "qualityFlags.missingDeadline": missingDeadline,
        };

        if (DRY_RUN) {
          console.log(
            `  [DRY] ${item.id} "${item.title.slice(0, 50)}…"` +
            ` → score=${scoring.audienceFitScore} geo=${scoring.geoTag}` +
            ` dedupe=${dedupeGroupId.slice(0, 8)}…` +
            ` offMission=${scoring.offMission} weak=${weakSource} missingDL=${missingDeadline}`,
          );
        } else {
          writer!.update(doc.ref, update);
        }

        totalUpdated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ⚠ Error processing ${item.id}: ${msg}`);
        totalSkipped++;
      }
    }

    // Flush batch writes
    if (writer) {
      await writer.close();
    }

    console.log(
      `  📦 Batch: ${legacyDocs.length} legacy items processed` +
      ` (page had ${snap.docs.length} total)`,
    );

    // If this page was smaller than BATCH_SIZE, we're done
    if (snap.docs.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`\n✅ Backfill complete`);
  console.log(`   Total scanned:  items processed through filter`);
  console.log(`   Legacy found:   ${totalProcessed}`);
  console.log(`   Updated:        ${totalUpdated}`);
  console.log(`   Skipped/errors: ${totalSkipped}`);
  console.log(`   Mode:           ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);
}

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
