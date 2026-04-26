/**
 * One-shot backfill: clear `draftReason` + flip status→"published" on FR/HT
 * web content_versions that were drafted ONLY because the previous
 * `isShortContent || draft.confidence < 0.6` rule conflated RSS-only
 * ingest with Gemini's actual confidence signal (see PR #40).
 *
 * Eligibility:
 *   1. status == "draft"
 *   2. channel == "web"
 *   3. draftReason matches /^Low confidence \(0\.\d+\)$/ AND the parsed
 *      confidence value is >= 0.6 (so Gemini actually was confident — only
 *      isShortContent kept it as a draft).
 *   4. Linked item has audienceFitScore >= PUBLISH_SCORE_THRESHOLD (0.40),
 *      so the audience-fit gate would have published it anyway.
 *   5. Linked item is NOT off-mission, NOT marked needsReview.
 *   6. Linked item.createdAt within --since-days (default 14) so we don't
 *      retroactively republish months of archive. The IG/FB queues only
 *      consider items in the last 48–72h anyway, so a 14-day window
 *      comfortably covers anything that could realistically post and
 *      keeps recent /opportunites + /news pages accurate.
 *
 * Run:
 *   cd apps/worker && npx tsx src/scripts/backfillLowConfidenceDrafts.ts
 *
 * Flags:
 *   --dry            preview without writing
 *   --since-days=N   only promote drafts whose item was created in the last
 *                    N days (default 14). Pass --since-days=999 for "all".
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";
import { PUBLISH_SCORE_THRESHOLD } from "@edlight-news/generator";
import { FieldValue } from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry");
const CONFIDENCE_FLOOR = 0.6;
const LOW_CONF_PATTERN = /^Low confidence \((\d*\.?\d+)\)$/;

const sinceFlag = process.argv.find((a) => a.startsWith("--since-days="));
const SINCE_DAYS = sinceFlag ? parseInt(sinceFlag.split("=")[1] ?? "14", 10) : 14;
const SINCE_CUTOFF_MS = Date.now() - SINCE_DAYS * 24 * 60 * 60 * 1000;

async function main() {
  const db = getDb();
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "WRITE"}\n`);

  // Paginate the full draft set — Firestore caps individual queries at 500
  // ops, but we need to scan all drafts so a recent draft buried past the
  // first 500 isn't silently skipped.
  const candidates: { id: string; itemId: string; lang: string; conf: number; title: string }[] = [];
  const reasonCounts: Record<string, number> = {};
  let totalScanned = 0;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  const PAGE_SIZE = 500;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = db
      .collection("content_versions")
      .where("status", "==", "draft")
      .where("channel", "==", "web")
      .orderBy("__name__")
      .limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    totalScanned += snap.size;
    for (const doc of snap.docs) {
      const d = doc.data() as Record<string, unknown>;
      const reason = (d.draftReason as string | undefined) ?? "(none)";
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;

      const match = (d.draftReason as string | undefined)?.match(LOW_CONF_PATTERN);
      if (!match) continue;
      const conf = parseFloat(match[1]!);
      if (!Number.isFinite(conf) || conf < CONFIDENCE_FLOOR) continue;

      candidates.push({
        id: doc.id,
        itemId: d.itemId as string,
        lang: (d.language as string) ?? "?",
        conf,
        title: ((d.title as string) ?? "").slice(0, 60),
      });
    }
    if (snap.size < PAGE_SIZE) break;
    lastDoc = snap.docs[snap.docs.length - 1] ?? null;
  }
  console.log(`Scanned ${totalScanned} draft web content_versions.\n`);

  console.log("draftReason breakdown across scanned drafts:");
  for (const [r, n] of Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n}× ${r}`);
  }

  console.log(`\nLow-confidence drafts with conf >= ${CONFIDENCE_FLOOR}: ${candidates.length}`);

  if (candidates.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  // Verify each candidate's item passes the audience-fit floor (the gate that
  // would have routed it to draft via "Low audience-fit score" instead of
  // lowConfidence had isShortContent not short-circuited the check).
  const itemIds = [...new Set(candidates.map((c) => c.itemId))];
  const itemsById = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < itemIds.length; i += 30) {
    const chunk = itemIds.slice(i, i + 30);
    const refs = chunk.map((id) => db.collection("items").doc(id));
    const docs = await db.getAll(...refs);
    for (const d of docs) {
      if (d.exists) itemsById.set(d.id, d.data() as Record<string, unknown>);
    }
  }

  const promotable: typeof candidates = [];
  let droppedAudienceFit = 0;
  let droppedOffMission = 0;
  let droppedNeedsReview = 0;
  let droppedNoItem = 0;
  let droppedTooOld = 0;

  for (const c of candidates) {
    const item = itemsById.get(c.itemId);
    if (!item) {
      droppedNoItem++;
      continue;
    }
    const created = item.createdAt as { seconds?: number } | undefined;
    const createdMs = created?.seconds ? created.seconds * 1000 : 0;
    if (createdMs < SINCE_CUTOFF_MS) {
      droppedTooOld++;
      continue;
    }
    const fitScore = (item.audienceFitScore as number | undefined) ?? 0;
    const flags = (item.qualityFlags as Record<string, unknown> | undefined) ?? {};
    if (flags.offMission) {
      droppedOffMission++;
      continue;
    }
    if (flags.needsReview) {
      droppedNeedsReview++;
      continue;
    }
    if (fitScore < PUBLISH_SCORE_THRESHOLD) {
      droppedAudienceFit++;
      continue;
    }
    promotable.push(c);
  }

  console.log(`\nPromotable after item-side gates: ${promotable.length}`);
  console.log(`  dropped — no item: ${droppedNoItem}`);
  console.log(`  dropped — older than ${SINCE_DAYS}d: ${droppedTooOld}`);
  console.log(`  dropped — off-mission: ${droppedOffMission}`);
  console.log(`  dropped — needsReview: ${droppedNeedsReview}`);
  console.log(`  dropped — audienceFitScore < ${PUBLISH_SCORE_THRESHOLD}: ${droppedAudienceFit}`);

  if (promotable.length === 0) {
    console.log("\nNothing to promote.");
    process.exit(0);
  }

  console.log("\nWill promote:");
  for (const c of promotable.slice(0, 30)) {
    console.log(`  [${c.lang}] ${c.id} item=${c.itemId} conf=${c.conf} "${c.title}"`);
  }
  if (promotable.length > 30) console.log(`  ... and ${promotable.length - 30} more`);

  if (DRY_RUN) {
    console.log("\n[dry] no writes performed. Re-run without --dry to apply.");
    process.exit(0);
  }

  // Batch updates (Firestore: max 500 ops/batch)
  let written = 0;
  for (let i = 0; i < promotable.length; i += 400) {
    const chunk = promotable.slice(i, i + 400);
    const batch = db.batch();
    for (const c of chunk) {
      const ref = db.collection("content_versions").doc(c.id);
      batch.update(ref, {
        status: "published",
        draftReason: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  committed ${written}/${promotable.length}`);
  }

  console.log(`\nDone — promoted ${written} drafts to published.`);
  console.log("Next /tick will pick them up via buildIgQueue + buildFbQueue.");
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
