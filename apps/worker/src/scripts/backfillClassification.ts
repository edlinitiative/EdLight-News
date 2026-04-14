#!/usr/bin/env npx tsx
/**
 * Backfill / re-classify existing items using the zero-shot ML classifier.
 *
 * Scans all items, runs the HuggingFace zero-shot classifier on each,
 * and updates the category on BOTH the `items` doc AND its
 * `content_versions` docs when the ML model disagrees with the current
 * category with high confidence.
 *
 * Usage:
 *   cd apps/worker
 *   npx tsx src/scripts/backfillClassification.ts                     # dry-run (log only)
 *   npx tsx src/scripts/backfillClassification.ts --confirm           # live writes
 *   npx tsx src/scripts/backfillClassification.ts --confirm --limit=50  # first 50 only
 *
 * Env:
 *   BACKFILL_DRY_RUN=true   — same as omitting --confirm
 *
 * Safe to re-run — idempotent. Items whose category doesn't change are skipped.
 * Adds `classificationBackfillAt` timestamp to prevent re-processing.
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";
import type { Item, ItemCategory } from "@edlight-news/types";
import {
  classifyWithZeroShot,
  resolveCategory,
  warmUpClassifier,
} from "../services/zeroShotClassifier.js";
import { classifyItem } from "../services/classify.js";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const CONFIRM = process.argv.includes("--confirm");
const DRY_RUN = !CONFIRM;
const BATCH_SIZE = 200;

// Parse --limit=N
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

// Rate-limit: ~200ms per inference, no need for extra delay
const DELAY_MS = 50;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n🤖 Backfill classification — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE MODE"}` +
    (LIMIT < Infinity ? ` — limit=${LIMIT}` : "") +
    `\n`,
  );

  // Warm up the model before starting
  console.log("Loading zero-shot classifier model…\n");
  await warmUpClassifier();

  const db = getDb();
  const itemsCol = db.collection("items");
  const cvsCol = db.collection("content_versions");

  let totalScanned = 0;
  let totalReclassified = 0;
  let totalAgreed = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let lastDocSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  const reclassifications: Array<{
    id: string;
    title: string;
    from: string;
    to: string;
    score: number;
    source: string;
  }> = [];

  let hasMore = true;

  while (hasMore && totalScanned < LIMIT) {
    let query = itemsCol
      .orderBy("createdAt", "desc")
      .limit(Math.min(BATCH_SIZE, LIMIT - totalScanned));

    if (lastDocSnap) {
      query = query.startAfter(lastDocSnap);
    }

    const snap = await query.get();

    if (snap.empty) {
      hasMore = false;
      break;
    }

    lastDocSnap = snap.docs[snap.docs.length - 1];

    const writer = DRY_RUN ? null : db.bulkWriter();
    if (writer) {
      writer.onWriteError((error) => {
        console.error(
          `  ❌ Write error for ${error.documentRef.path}: ${error.message}`,
        );
        return false;
      });
    }

    let batchReclassified = 0;

    for (const doc of snap.docs) {
      if (totalScanned >= LIMIT) break;
      totalScanned++;

      const item = { id: doc.id, ...doc.data() } as Item;
      const currentCategory = item.category;

      // Skip items without a title or body — nothing to classify
      if (!item.title) {
        totalSkipped++;
        continue;
      }

      // Skip items already backfilled (idempotency guard)
      if ((item as any).classificationBackfillAt) {
        totalSkipped++;
        continue;
      }

      try {
        // Use extractedText or title+summary as classifier input
        const textForClassification =
          item.extractedText || `${item.title}\n\n${item.summary ?? ""}`;

        // Run zero-shot classifier
        const zeroShotResult = await classifyWithZeroShot(
          item.title,
          textForClassification,
        );

        // Run deterministic classifier for opportunity detection
        const deterministicResult = classifyItem(
          item.title,
          item.summary ?? "",
          item.extractedText ?? "",
        );

        // Resolve: which category wins?
        const resolved = resolveCategory(
          currentCategory,
          zeroShotResult,
          deterministicResult.isOpportunity,
        );

        const newCategory = resolved.category as ItemCategory;

        // ── Infer vertical (runs for ALL items, not just reclassified) ──
        const OPP_CATS = new Set([
          "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
        ]);
        const effectiveCategory = newCategory;
        let inferredVertical: string | undefined;
        if (OPP_CATS.has(effectiveCategory) || deterministicResult.isOpportunity) {
          inferredVertical = "opportunites";
        } else {
          const textForV = `${item.title} ${item.summary ?? ""}`.toLowerCase();
          if (/\b(international|géopolitique|diplomatie|onu|nations unies|monde|world|global|entènasyonal)\b/i.test(textForV)) {
            inferredVertical = "world";
          } else if (/\b(université|education|éducation|enseignement|étudiant|lycée|school|inivèsite|edikasyon|recherche)\b/i.test(textForV)) {
            inferredVertical = "education";
          } else if (/\b(économie|economy|business|entreprise|startup|finance|investissement|marché|entrepreneurship|ekonomi|biznis)\b/i.test(textForV)) {
            inferredVertical = "business";
          }
        }

        if (newCategory === currentCategory) {
          totalAgreed++;
          if (totalScanned % 50 === 0) {
            process.stdout.write(
              `\r  Progress: ${totalScanned} scanned, ${totalReclassified} reclassified, ${totalAgreed} agreed`,
            );
          }
          // Mark as backfilled + set vertical even when category is unchanged
          if (!DRY_RUN && writer) {
            writer.update(doc.ref, {
              ...(inferredVertical && !item.vertical ? { vertical: inferredVertical } : {}),
              classificationBackfillAt:
                FirebaseFirestore.FieldValue.serverTimestamp(),
            });
          }
          await sleep(DELAY_MS);
          continue;
        }

        // Category changed!
        const titlePreview = item.title.slice(0, 60);
        console.log(
          `\n  🔄 ${item.id} "${titlePreview}…"` +
          `\n     ${currentCategory} → ${newCategory} (${resolved.source}: ${resolved.reason})` +
          `\n     ZS: ${zeroShotResult.label}@${(zeroShotResult.score * 100).toFixed(0)}%, latency=${zeroShotResult.latencyMs}ms`,
        );

        reclassifications.push({
          id: item.id,
          title: titlePreview,
          from: currentCategory,
          to: newCategory,
          score: zeroShotResult.score,
          source: resolved.source,
        });

        if (!DRY_RUN && writer) {
          // Update the item — category + vertical + backfill marker
          writer.update(doc.ref, {
            category: newCategory,
            ...(inferredVertical ? { vertical: inferredVertical } : {}),
            classificationBackfillAt:
              FirebaseFirestore.FieldValue.serverTimestamp(),
          });

          // Also update all content_versions for this item
          const cvsSnap = await cvsCol
            .where("itemId", "==", item.id)
            .get();
          for (const cvDoc of cvsSnap.docs) {
            writer.update(cvDoc.ref, {
              category: newCategory,
            });
          }
        }

        batchReclassified++;
        totalReclassified++;
      } catch (err) {
        console.error(`\n  ❌ Error classifying ${item.id}:`, err);
        totalErrors++;
      }

      await sleep(DELAY_MS);
    }

    if (writer) {
      await writer.close();
    }

    console.log(
      `\n  📦 Batch: ${snap.docs.length} scanned, ${batchReclassified} reclassified`,
    );

    if (snap.docs.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`✅ Backfill classification complete`);
  console.log(`   Scanned:        ${totalScanned}`);
  console.log(`   Reclassified:   ${totalReclassified}`);
  console.log(`   Agreed:         ${totalAgreed}`);
  console.log(`   Skipped:        ${totalSkipped}`);
  console.log(`   Errors:         ${totalErrors}`);
  console.log(`   Mode:           ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  if (reclassifications.length > 0) {
    console.log(`\n   Reclassification breakdown:`);
    const fromTo: Record<string, number> = {};
    for (const r of reclassifications) {
      const key = `${r.from} → ${r.to}`;
      fromTo[key] = (fromTo[key] ?? 0) + 1;
    }
    for (const [transition, count] of Object.entries(fromTo).sort(
      (a, b) => b[1] - a[1],
    )) {
      console.log(`     ${transition}: ${count}`);
    }
  }

  console.log(`${"═".repeat(60)}\n`);
}

// Need this import for FieldValue in the backfill
import * as FirebaseFirestore from "firebase-admin/firestore";

main().catch((err) => {
  console.error("💥 Fatal error:", err);
  process.exit(1);
});
