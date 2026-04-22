#!/usr/bin/env npx tsx
/**
 * One-shot backfill: fix items mis-classified as "bourses" (scholarship)
 * when the article is actually about the **stock market**.
 *
 * Background
 * ──────────
 * "Bourse" in French is ambiguous:
 *   • bourse d'études      → scholarship  ✅ what we want
 *   • Bourse de New York   → stock exchange ❌ false positive
 *
 * Until the disambiguation patch (services/classify.ts → isStockMarketFalsePositive),
 * any finance article mentioning "Bourse de …" was tagged
 *   category: "bourses", vertical: "opportunites"
 * and surfaced on Facebook with the embarrassing hook
 *   "Bourse à surveiller : <stock-market headline>"
 *
 * What this script does
 * ─────────────────────
 * For each `items` doc with `category == "bourses"`:
 *   1. Re-evaluate via `isStockMarketFalsePositive(title + summary + extractedText)`.
 *   2. If false-positive:
 *        • items: clear `vertical: "opportunites"`, clear `opportunity` map,
 *          set `category` to `local_news` (geoTag === "HT") or `news`.
 *        • content_versions (same itemId): patch `category` to the new value.
 *        • fb_queue: cancel any `queued` / `scheduled` rows
 *          (status → `skipped`) so they don't post with the wrong hook.
 *
 * Idempotent — items that don't match the false-positive rule are left untouched.
 * Marks fixed items with `boursesFixupAt` to make repeat runs cheap to audit.
 *
 * Usage
 * ─────
 *   cd apps/worker
 *   pnpm backfill:bourses-fix                   # DRY-RUN (default)
 *   pnpm backfill:bourses-fix --confirm         # live writes
 *   pnpm backfill:bourses-fix --confirm --limit=50
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { FieldValue } from "firebase-admin/firestore";

import { getDb } from "@edlight-news/firebase";
import type { Item } from "@edlight-news/types";
import { isStockMarketFalsePositive } from "../services/classify.js";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const CONFIRM = process.argv.includes("--confirm");
const DRY_RUN = !CONFIRM;
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1] ?? "", 10) : Infinity;
const BATCH_SIZE = 200;

interface FixSummary {
  itemId: string;
  title: string;
  fromCategory: string;
  toCategory: "news" | "local_news";
  contentVersionsUpdated: number;
  fbQueueCancelled: number;
}

async function main() {
  console.log(
    `\n🔧 Backfill: bourses → news (stock-market false positives) — ${
      DRY_RUN ? "DRY RUN (no writes)" : "LIVE MODE"
    }${LIMIT < Infinity ? ` — limit=${LIMIT}` : ""}\n`,
  );

  const db = getDb();
  const itemsCol = db.collection("items");
  const cvsCol = db.collection("content_versions");
  const fbQueueCol = db.collection("fb_queue");

  let totalScanned = 0;
  let totalFixed = 0;
  let totalCleanBourses = 0;
  let totalErrors = 0;
  const fixes: FixSummary[] = [];

  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let hasMore = true;

  while (hasMore && totalScanned < LIMIT) {
    // No orderBy — avoids the need for a composite (category + createdAt) index.
    // Firestore implicitly orders by __name__, which is fine for a one-shot pass.
    let query = itemsCol
      .where("category", "==", "bourses")
      .limit(Math.min(BATCH_SIZE, LIMIT - totalScanned));

    if (lastDoc) query = query.startAfter(lastDoc);

    const snap = await query.get();
    if (snap.empty) {
      hasMore = false;
      break;
    }
    lastDoc = snap.docs[snap.docs.length - 1];

    for (const doc of snap.docs) {
      if (totalScanned >= LIMIT) break;
      totalScanned++;

      const item = { id: doc.id, ...doc.data() } as Item;
      const combinedText = `${item.title ?? ""} ${item.summary ?? ""} ${
        item.extractedText ?? ""
      }`.trim();

      if (!combinedText) continue;

      try {
        if (!isStockMarketFalsePositive(combinedText)) {
          totalCleanBourses++;
          continue;
        }

        // It's a stock-market false positive → reclassify
        const newCategory: "news" | "local_news" =
          item.geoTag === "HT" ? "local_news" : "news";

        const titlePreview = (item.title ?? "(untitled)").slice(0, 70);
        console.log(
          `\n  🔄 ${item.id}  "${titlePreview}…"` +
            `\n     bourses → ${newCategory}` +
            (item.vertical ? `  (clearing vertical=${item.vertical})` : ""),
        );

        // ── Find content_versions to patch ──────────────────────────────
        const cvSnap = await cvsCol.where("itemId", "==", item.id).get();

        // ── Find pending fb_queue entries to cancel ─────────────────────
        const fbSnap = await fbQueueCol
          .where("sourceContentId", "==", item.id)
          .get();

        const cancellable = fbSnap.docs.filter((d) => {
          const status = d.data().status as string | undefined;
          return status === "queued" || status === "scheduled";
        });

        console.log(
          `     content_versions: ${cvSnap.size} • fb_queue (queued/scheduled): ${cancellable.length}`,
        );

        if (!DRY_RUN) {
          const batch = db.batch();

          // Items doc — flip category, drop opportunites vertical & opportunity map
          const itemPatch: Record<string, unknown> = {
            category: newCategory,
            boursesFixupAt: FieldValue.serverTimestamp(),
          };
          if (item.vertical === "opportunites") {
            itemPatch.vertical = FieldValue.delete();
          }
          // Drop the opportunity payload — it's meaningless for a finance piece
          if ((item as { opportunity?: unknown }).opportunity !== undefined) {
            itemPatch.opportunity = FieldValue.delete();
          }
          batch.update(doc.ref, itemPatch);

          // content_versions — patch category on each
          for (const cvDoc of cvSnap.docs) {
            batch.update(cvDoc.ref, { category: newCategory });
          }

          // fb_queue — cancel pending (queued/scheduled) entries
          for (const fbDoc of cancellable) {
            batch.update(fbDoc.ref, {
              status: "skipped",
              skipReason: "bourses_stock_market_false_positive",
              updatedAt: FieldValue.serverTimestamp(),
            });
          }

          await batch.commit();
        }

        fixes.push({
          itemId: item.id,
          title: titlePreview,
          fromCategory: "bourses",
          toCategory: newCategory,
          contentVersionsUpdated: cvSnap.size,
          fbQueueCancelled: cancellable.length,
        });
        totalFixed++;
      } catch (err) {
        console.error(`\n  ❌ Error on ${item.id}:`, err);
        totalErrors++;
      }
    }

    if (snap.size < BATCH_SIZE) hasMore = false;
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(64)}`);
  console.log(`✅ Bourses stock-market backfill complete`);
  console.log(`   Mode:                     ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`   Items scanned (bourses):  ${totalScanned}`);
  console.log(`   Genuine scholarships:     ${totalCleanBourses}`);
  console.log(`   Reclassified to news:     ${totalFixed}`);
  console.log(`   Errors:                   ${totalErrors}`);

  if (fixes.length > 0) {
    const totalCv = fixes.reduce((a, f) => a + f.contentVersionsUpdated, 0);
    const totalFb = fixes.reduce((a, f) => a + f.fbQueueCancelled, 0);
    console.log(`   content_versions patched: ${totalCv}`);
    console.log(`   fb_queue cancelled:       ${totalFb}`);
    console.log(`\n   Sample (first 10):`);
    for (const f of fixes.slice(0, 10)) {
      console.log(
        `     • ${f.itemId} → ${f.toCategory}  (cv=${f.contentVersionsUpdated}, fb=${f.fbQueueCancelled}) "${f.title}"`,
      );
    }
  }

  if (DRY_RUN && totalFixed > 0) {
    console.log(`\n💡 Re-run with --confirm to apply these changes.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n💥 Fatal:", err);
    process.exit(1);
  });
