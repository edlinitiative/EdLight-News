/**
 * One-time patch: republish content_versions stuck as "draft" due to
 * the previous publish threshold being too strict (0.65 → now 0.40).
 *
 * What this does:
 *   1. Finds all draft CVs with draftReason matching "Low audience-fit score"
 *   2. Looks up the parent item and re-scores it with the updated scoring logic
 *      (which now gives "news" category +0.15)
 *   3. If the new score >= NEW_THRESHOLD (0.40), clears draftReason and
 *      publishes the CV
 *
 * Usage:
 *   npx tsx src/scripts/republishDrafts.ts              # dry-run (default)
 *   REPUBLISH_LIVE=true npx tsx src/scripts/republishDrafts.ts  # live writes
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { computeScoring } from "../services/scoring.js";

const NEW_THRESHOLD = 0.40;
const LIVE = process.env.REPUBLISH_LIVE === "true";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

async function main() {
  console.log(`\n🔧 Republish stuck drafts (${LIVE ? "LIVE" : "DRY-RUN"})\n`);
  console.log(`   New threshold: ${NEW_THRESHOLD}`);
  console.log(`   Criteria: draftReason starts with "Low audience-fit score"\n`);

  // ── 1. Find all draft CVs ─────────────────────────────────────────────────
  const snap = await db
    .collection("content_versions")
    .where("status", "==", "draft")
    .get();

  // Filter in-memory for "Low audience-fit score" draftReason (avoids composite index)
  const lowScoreDocs = snap.docs.filter((d) => {
    const reason = (d.data().draftReason as string) ?? "";
    return reason.startsWith("Low audience-fit score");
  });

  console.log(`Found ${lowScoreDocs.length} draft CVs with "Low audience-fit score" reason (of ${snap.size} total drafts)\n`);

  if (lowScoreDocs.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  // ── 2. Group CVs by itemId for efficient parent lookup ────────────────────
  const cvsByItem = new Map<string, typeof lowScoreDocs>();
  for (const doc of lowScoreDocs) {
    const itemId = doc.data().itemId as string;
    if (!cvsByItem.has(itemId)) cvsByItem.set(itemId, []);
    cvsByItem.get(itemId)!.push(doc);
  }

  console.log(`Spanning ${cvsByItem.size} unique items\n`);

  let promoted = 0;
  let skipped = 0;

  for (const [itemId, cvDocs] of cvsByItem) {
    const itemSnap = await db.collection("items").doc(itemId).get();
    if (!itemSnap.exists) {
      console.log(`  ⚠ item ${itemId} not found — skipping ${cvDocs.length} CVs`);
      skipped += cvDocs.length;
      continue;
    }

    const item = itemSnap.data()!;
    const title = (item.title as string) ?? "";
    const text = `${title} ${(item.extractedText as string) || (item.summary as string) || ""}`;
    const category = item.category as string | undefined;

    // Re-score with updated scoring logic
    const scoring = computeScoring(title, text, category);

    if (scoring.audienceFitScore < NEW_THRESHOLD) {
      console.log(
        `  ✗ item ${itemId} — new score ${scoring.audienceFitScore.toFixed(2)} still below ${NEW_THRESHOLD} (${cvDocs.length} CVs)`,
      );
      skipped += cvDocs.length;
      continue;
    }

    console.log(
      `  ✓ item ${itemId} — new score ${scoring.audienceFitScore.toFixed(2)} >= ${NEW_THRESHOLD} — promoting ${cvDocs.length} CVs`,
    );

    if (LIVE) {
      const batch = db.batch();
      for (const cvDoc of cvDocs) {
        batch.update(cvDoc.ref, {
          status: "published",
          draftReason: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      // Also update the item's audienceFitScore to the new value
      batch.update(itemSnap.ref, {
        audienceFitScore: scoring.audienceFitScore,
      });
      await batch.commit();
    }

    promoted += cvDocs.length;
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Promoted: ${promoted} content_versions`);
  console.log(`   Skipped:  ${skipped} content_versions`);
  console.log(`   Mode:     ${LIVE ? "LIVE ✅" : "DRY-RUN (set REPUBLISH_LIVE=true to apply)"}\n`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
