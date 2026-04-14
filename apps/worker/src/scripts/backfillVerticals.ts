#!/usr/bin/env npx tsx
/**
 * One-time backfill: infer `vertical` for items that don't have one.
 *
 * The main classification backfill set `classificationBackfillAt` but
 * only inferred vertical for items it actually processed (not skipped).
 * This script fills the gap — runs keyword-based vertical inference on
 * ALL items that are missing a vertical.
 *
 * Usage:
 *   cd apps/worker
 *   npx tsx src/scripts/backfillVerticals.ts            # dry-run
 *   npx tsx src/scripts/backfillVerticals.ts --confirm   # live writes
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../..", ".env") });

import { getDb } from "@edlight-news/firebase";
import { FieldValue } from "firebase-admin/firestore";

const CONFIRM = process.argv.includes("--confirm");
const DRY_RUN = !CONFIRM;
const BATCH_SIZE = 300;

const OPP_CATS = new Set([
  "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
]);

function inferVertical(title: string, summary: string, category: string, geoTag?: string): string | undefined {
  if (OPP_CATS.has(category)) return "opportunites";

  const text = `${title} ${summary}`.toLowerCase();

  if (
    geoTag === "Global" || geoTag === "Diaspora" ||
    /\b(international|géopolitique|diplomatie|onu|nations unies|g7|g20|otan|nato|monde|world|global|entènasyonal)\b/i.test(text)
  ) {
    return "world";
  }

  if (
    /\b(université|education|éducation|enseignement|étudiant|lycée|school|academic|inivèsite|edikasyon|recherche|research|baccalauréat|bakaloreya)\b/i.test(text)
  ) {
    return "education";
  }

  if (
    /\b(économie|economy|business|entreprise|startup|finance|investissement|marché|entrepreneurship|commerce|emploi|ekonomi|biznis|banque|bank)\b/i.test(text)
  ) {
    return "business";
  }

  // Haiti-specific news — set vertical to "haiti" for geoTag HT
  if (geoTag === "HT" || /\b(haiti|haïti|ayiti|port-au-prince|pòtoprens)\b/i.test(text)) {
    return "haiti";
  }

  return undefined;
}

async function main() {
  console.log(`\n🏷️  Backfill verticals — ${DRY_RUN ? "DRY RUN" : "LIVE MODE"}\n`);

  const db = getDb();
  const col = db.collection("items");

  let totalScanned = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const verticalCounts: Record<string, number> = {};

  let lastDocSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  let hasMore = true;

  while (hasMore) {
    let query = col.orderBy("createdAt", "desc").limit(BATCH_SIZE);
    if (lastDocSnap) query = query.startAfter(lastDocSnap);

    const snap = await query.get();
    if (snap.empty) { hasMore = false; break; }
    lastDocSnap = snap.docs[snap.docs.length - 1];

    const writer = DRY_RUN ? null : db.bulkWriter();
    if (writer) {
      writer.onWriteError((err) => {
        console.error(`  ❌ Write error: ${err.message}`);
        return false;
      });
    }

    for (const doc of snap.docs) {
      totalScanned++;
      const data = doc.data();

      // Skip items that already have a vertical
      if (data.vertical) {
        totalSkipped++;
        continue;
      }

      const vertical = inferVertical(
        data.title ?? "",
        data.summary ?? "",
        data.category ?? "news",
        data.geoTag,
      );

      if (!vertical) {
        totalSkipped++;
        continue;
      }

      verticalCounts[vertical] = (verticalCounts[vertical] ?? 0) + 1;

      if (DRY_RUN) {
        if (totalUpdated < 20) {
          console.log(`  [DRY] ${doc.id} → vertical="${vertical}" (cat=${data.category}, geo=${data.geoTag ?? "—"}) "${(data.title ?? "").slice(0, 50)}…"`);
        }
      } else {
        writer!.update(doc.ref, { vertical, updatedAt: FieldValue.serverTimestamp() });
      }

      totalUpdated++;
    }

    if (writer) await writer.close();

    if (snap.docs.length < BATCH_SIZE) hasMore = false;
  }

  console.log(`\n✅ Backfill verticals complete`);
  console.log(`   Scanned:  ${totalScanned}`);
  console.log(`   Updated:  ${totalUpdated}`);
  console.log(`   Skipped:  ${totalSkipped}`);
  console.log(`   Mode:     ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  if (Object.keys(verticalCounts).length > 0) {
    console.log(`   Breakdown:`);
    for (const [v, c] of Object.entries(verticalCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${v}: ${c}`);
    }
  }
  console.log();

  process.exit(0);
}

main().catch((err) => { console.error("💥", err); process.exit(1); });
