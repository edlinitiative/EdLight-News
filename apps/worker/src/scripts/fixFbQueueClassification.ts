#!/usr/bin/env npx tsx
/**
 * Fix currently queued / scheduled Facebook posts that were composed
 * from mis-classified items.
 *
 * Background
 * ──────────
 * The `composeFbMessage` helper picks a hook ("Bourse à surveiller",
 * "Opportunité à saisir", "À la une"…) based on the underlying item's
 * `category` / `vertical`. If the upstream classifier mislabelled an
 * item as `bourses` (scholarship), the FB post goes out promising a
 * scholarship that doesn't exist.
 *
 * This script audits every fb_queue row in status `queued` / `scheduled`,
 * re-validates the underlying item with the stricter post-fix rules from
 * services/classify.ts, and either:
 *
 *   • Reclassifies the item AND cancels the FB row (status → "skipped",
 *     skipReason → "fb_queue_fixup_misclassified") when the item is
 *     genuinely not an opportunity. Also patches its content_versions.
 *
 *   • Leaves the row alone otherwise.
 *
 * Currently scopes its strict re-validation to the `bourses` false
 * positives because that is the user-reported problem; other topic
 * misclassifications can be added later.
 *
 * Usage
 * ─────
 *   pnpm tsx src/scripts/fixFbQueueClassification.ts             # dry run
 *   pnpm tsx src/scripts/fixFbQueueClassification.ts --confirm   # live writes
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { FieldValue } from "firebase-admin/firestore";

import { getDb } from "@edlight-news/firebase";
import {
  isStockMarketFalsePositive,
  lacksScholarshipEvidence,
} from "../services/classify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

const CONFIRM = process.argv.includes("--confirm");
const DRY_RUN = !CONFIRM;

interface FbRow {
  id: string;
  status: string;
  sourceContentId: string;
  scheduledFor?: string;
  payloadText: string;
}

async function main() {
  console.log(
    `\n🔧 Fix FB queue classification — ${DRY_RUN ? "DRY RUN" : "LIVE MODE"}\n`,
  );

  const db = getDb();
  const fbCol = db.collection("fb_queue");
  const itemsCol = db.collection("items");
  const cvsCol = db.collection("content_versions");

  // 1. Pull every queued / scheduled row
  const snap = await fbCol
    .where("status", "in", ["queued", "scheduled"])
    .limit(500)
    .get();

  console.log(`Found ${snap.size} queued/scheduled FB rows\n`);

  const rows: FbRow[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      status: String(data.status),
      sourceContentId: String(data.sourceContentId ?? ""),
      scheduledFor: data.scheduledFor as string | undefined,
      payloadText: String(
        (data.payload as { text?: string } | undefined)?.text ?? "",
      ),
    };
  });

  let scanned = 0;
  let cancelled = 0;
  let kept = 0;
  let errors = 0;

  for (const row of rows) {
    scanned++;
    if (!row.sourceContentId) {
      console.log(`  ⚠️  ${row.id} — no sourceContentId, skipping`);
      continue;
    }

    try {
      const itemSnap = await itemsCol.doc(row.sourceContentId).get();
      if (!itemSnap.exists) {
        console.log(
          `  ⚠️  ${row.id} — underlying item ${row.sourceContentId} missing, cancelling`,
        );
        if (!DRY_RUN) {
          await fbCol.doc(row.id).update({
            status: "skipped",
            skipReason: "fb_queue_fixup_item_missing",
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        cancelled++;
        continue;
      }

      const item = itemSnap.data() as Record<string, unknown>;
      const category = String(item.category ?? "");
      const title = String(item.title ?? "");
      const combined = `${title} ${item.summary ?? ""} ${item.extractedText ?? ""}`;

      // ── Decide: is this row mis-classified? ──────────────────────────
      // Today we only audit `bourses` rows. Other categories (programmes,
      // stages, concours) tend to be more reliably tagged by the gate.
      let mustFix = false;
      let reason = "";
      let newCategory: "news" | "local_news" | null = null;

      if (category === "bourses" || category === "scholarship") {
        if (isStockMarketFalsePositive(combined)) {
          mustFix = true;
          reason = "stock_market_false_positive";
        } else if (lacksScholarshipEvidence(combined)) {
          mustFix = true;
          reason = "no_strict_scholarship_keyword";
        }
        if (mustFix) {
          newCategory = item.geoTag === "HT" ? "local_news" : "news";
        }
      }

      if (!mustFix) {
        kept++;
        continue;
      }

      console.log(
        `\n  🔄 fb_queue ${row.id} → cancel (${reason})` +
          `\n     item=${row.sourceContentId}  ${category} → ${newCategory}` +
          `\n     "${title.slice(0, 80)}…"`,
      );

      if (!DRY_RUN) {
        const batch = db.batch();

        // a) Patch the item: flip category, drop opportunity scaffolding
        const itemPatch: Record<string, unknown> = {
          category: newCategory,
          fbQueueFixupAt: FieldValue.serverTimestamp(),
          fbQueueFixupReason: reason,
        };
        if (item.vertical === "opportunites") {
          itemPatch.vertical = FieldValue.delete();
        }
        if (item.opportunity !== undefined) {
          itemPatch.opportunity = FieldValue.delete();
        }
        batch.update(itemsCol.doc(row.sourceContentId), itemPatch);

        // b) Patch content_versions for the item
        const cvSnap = await cvsCol
          .where("itemId", "==", row.sourceContentId)
          .get();
        for (const cvDoc of cvSnap.docs) {
          batch.update(cvDoc.ref, { category: newCategory });
        }

        // c) Cancel the FB row itself
        batch.update(fbCol.doc(row.id), {
          status: "skipped",
          skipReason: `fb_queue_fixup_${reason}`,
          updatedAt: FieldValue.serverTimestamp(),
        });

        await batch.commit();
      }

      cancelled++;
    } catch (err) {
      console.error(`  ❌ Error on ${row.id}:`, err);
      errors++;
    }
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log(`✅ FB-queue fixup complete`);
  console.log(`   Mode:        ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  console.log(`   Scanned:     ${scanned}`);
  console.log(`   Kept:        ${kept}`);
  console.log(`   Cancelled:   ${cancelled}`);
  console.log(`   Errors:      ${errors}`);

  if (DRY_RUN && cancelled > 0) {
    console.log(`\n💡 Re-run with --confirm to apply changes.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n💥 Fatal:", err);
    process.exit(1);
  });
