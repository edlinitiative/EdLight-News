/**
 * One-shot backfill: clear `qualityFlags.lowConfidence` on items that were
 * mis-flagged by the conflated `isShortContent` rule fixed in commit 3d5d6c8.
 *
 * Companion to backfillLowConfidenceDrafts.ts. That script only flipped
 * `content_versions.status` from draft → published. The item-level flag
 * `qualityFlags.lowConfidence: true` remains, and decideIG rejects any
 * item where that flag is true (selection.ts) — so opportunities and
 * scholarships processed before 3d5d6c8 are still blocked from ig_queue
 * even though their content_versions are now published.
 *
 * Eligibility (all must hold):
 *   1. qualityFlags.lowConfidence === true
 *   2. confidence >= 0.6  (Gemini's actual signal was confident — only the
 *      now-removed isShortContent branch put the flag on)
 *   3. NOT off-mission, NOT needsReview
 *   4. audienceFitScore >= PUBLISH_SCORE_THRESHOLD (0.40)
 *   5. createdAt within --since-days (default 14) so we don't retro-publish
 *      months of archive — the IG/FB queues only consider items in the last
 *      48-72h anyway, so 14 days is comfortable for anything that could
 *      realistically post.
 *
 * Action: set qualityFlags.lowConfidence = false. Leaves
 * `qualityFlags.reasons` intact so the historical "Low confidence: 0.85" /
 * "No extracted article text" notes remain visible for audit.
 *
 * Run:
 *   cd apps/worker && npx tsx src/scripts/backfillLowConfidenceItems.ts --dry
 *   cd apps/worker && npx tsx src/scripts/backfillLowConfidenceItems.ts
 *
 * Flags:
 *   --dry            preview without writing
 *   --since-days=N   override the 14-day window (default 14)
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";
import { PUBLISH_SCORE_THRESHOLD } from "@edlight-news/generator";
import { FieldValue } from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry");
const CONFIDENCE_FLOOR = 0.6;

const sinceFlag = process.argv.find((a) => a.startsWith("--since-days="));
const SINCE_DAYS = sinceFlag ? parseInt(sinceFlag.split("=")[1] ?? "14", 10) : 14;
const SINCE_CUTOFF_MS = Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000;

type ItemDoc = {
  category?: string;
  confidence?: number;
  audienceFitScore?: number;
  createdAt?: { seconds?: number };
  qualityFlags?: {
    lowConfidence?: boolean;
    needsReview?: boolean;
    offMission?: boolean;
  };
  title?: string;
};

async function main() {
  const db = getDb();
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "WRITE"}`);
  console.log(`Window: last ${SINCE_DAYS} days\n`);

  // Paginate the full set of items where lowConfidence is true.
  const candidates: {
    id: string;
    category: string;
    conf: number;
    fit: number;
    title: string;
  }[] = [];
  const categoryCounts: Record<string, number> = {};
  let totalScanned = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  const PAGE_SIZE = 500;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = db
      .collection("items")
      .where("qualityFlags.lowConfidence", "==", true)
      .orderBy("__name__")
      .limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    totalScanned += snap.size;
    for (const doc of snap.docs) {
      const d = doc.data() as ItemDoc;
      const cat = d.category ?? "(none)";
      categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1;

      const conf = d.confidence ?? 0;
      if (conf < CONFIDENCE_FLOOR) continue;

      const flags = d.qualityFlags ?? {};
      if (flags.offMission) continue;
      if (flags.needsReview) continue;

      const createdMs = d.createdAt?.seconds ? d.createdAt.seconds * 1000 : 0;
      if (createdMs < SINCE_CUTOFF_MS) continue;

      const fit = d.audienceFitScore ?? 0;
      if (fit < PUBLISH_SCORE_THRESHOLD) continue;

      candidates.push({
        id: doc.id,
        category: cat,
        conf,
        fit,
        title: (d.title ?? "").slice(0, 60),
      });
    }
    if (snap.size < PAGE_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1] ?? null;
  }

  console.log(`Scanned ${totalScanned} items with lowConfidence=true.\n`);

  console.log("Category breakdown across scanned items:");
  for (const [c, n] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(5)}  ${c}`);
  }

  console.log(
    `\nClearable (conf >= ${CONFIDENCE_FLOOR}, fit >= ${PUBLISH_SCORE_THRESHOLD}, ` +
      `not off-mission, not needsReview, within ${SINCE_DAYS}d): ${candidates.length}`,
  );

  if (candidates.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  // Show a category breakdown for the clearable subset — this is the actual
  // "what would unblock" report, the most useful number.
  const clearableByCat: Record<string, number> = {};
  for (const c of candidates) {
    clearableByCat[c.category] = (clearableByCat[c.category] ?? 0) + 1;
  }
  console.log("\nClearable category breakdown (these become IG-eligible after run):");
  for (const [c, n] of Object.entries(clearableByCat).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(5)}  ${c}`);
  }

  console.log("\nSample (first 30):");
  for (const c of candidates.slice(0, 30)) {
    console.log(
      `  ${c.id} cat=${c.category.padEnd(14)} conf=${c.conf.toFixed(2)} fit=${c.fit.toFixed(2)} "${c.title}"`,
    );
  }
  if (candidates.length > 30) {
    console.log(`  ... and ${candidates.length - 30} more`);
  }

  if (DRY_RUN) {
    console.log("\n[dry] no writes performed. Re-run without --dry to apply.");
    process.exit(0);
  }

  // Batch updates (Firestore: max 500 ops/batch)
  let written = 0;
  for (let i = 0; i < candidates.length; i += 400) {
    const chunk = candidates.slice(i, i + 400);
    const batch = db.batch();
    for (const c of chunk) {
      const ref = db.collection("items").doc(c.id);
      batch.update(ref, {
        "qualityFlags.lowConfidence": false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  committed ${written}/${candidates.length}`);
  }

  console.log(`\nDone — cleared lowConfidence on ${written} items.`);
  console.log("Next /tick will pick up newly-eligible items via buildIgQueue + buildFbQueue.");
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
