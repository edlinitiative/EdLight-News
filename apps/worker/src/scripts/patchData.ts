/**
 * Data-quality patch:
 *  1. Clear draftReason on content_versions where confidence was wrongly flagged as low
 *  2. Clear lowConfidence flag on items where confidence >= 0.6
 *  3. Fix "Google News" titles in items (replace with a usable title)
 *
 * Run: npx tsx src/scripts/patchData.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { initializeApp, getApps, cert } from "firebase-admin/app";

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
  let cvPatched = 0;
  let itemsPatched = 0;
  let categoryPatched = 0;

  // ─── 1. Clear bad draftReason on content_versions ─────────────────────────
  // "Low confidence (0.9)" is a bug — 0.9 is high confidence
  const cvSnap = await db
    .collection("content_versions")
    .where("draftReason", ">=", "Low confidence")
    .where("draftReason", "<", "Low confidence\uFFFF")
    .get();

  console.log(`Found ${cvSnap.size} content_versions with bad draftReason`);
  const cvBatch = db.batch();
  for (const doc of cvSnap.docs) {
    // Only clear it if confidence value in the draftReason is >= 0.6
    const dr: string = doc.data().draftReason ?? "";
    const match = dr.match(/Low confidence \(([0-9.]+)\)/);
    const conf = match ? parseFloat(match[1]!) : 0;
    if (conf >= 0.6) {
      cvBatch.update(doc.ref, {
        draftReason: FieldValue.delete(),
        "qualityFlags.lowConfidence": false,
      });
      cvPatched++;
    }
  }
  await cvBatch.commit();
  console.log(`✅ Cleared draftReason on ${cvPatched} content_versions`);

  // ─── 2. Clear lowConfidence on items with confidence >= 0.6 ────────────────
  const itemsSnap = await db
    .collection("items")
    .where("qualityFlags.lowConfidence", "==", true)
    .get();

  console.log(`Found ${itemsSnap.size} items with lowConfidence=true`);
  const itemsBatch = db.batch();
  for (const doc of itemsSnap.docs) {
    const confidence: number = doc.data().confidence ?? 0;
    if (confidence >= 0.6) {
      itemsBatch.update(doc.ref, {
        "qualityFlags.lowConfidence": false,
      });
      itemsPatched++;
    }
  }
  await itemsBatch.commit();
  console.log(`✅ Fixed lowConfidence on ${itemsPatched} items`);

  // ─── 3. Fix "Google News" titles in items ──────────────────────────────────
  // Items with title = "Google News" or "Google News - …" should use summary
  const titleSnap = await db
    .collection("items")
    .where("title", "==", "Google News")
    .get();

  // Also content_versions with "Google News" title
  const cvTitleSnap = await db
    .collection("content_versions")
    .where("title", "==", "Google News")
    .get();

  console.log(`Found ${titleSnap.size} items + ${cvTitleSnap.size} content_versions with "Google News" title`);

  const titleBatch = db.batch();
  for (const doc of titleSnap.docs) {
    // Use the first sentence of summary as the title
    const summary: string = doc.data().summary ?? "";
    const fallbackTitle = summary.split(/[.!?]/)[0]?.trim() ?? summary.slice(0, 80);
    if (fallbackTitle) {
      titleBatch.update(doc.ref, { title: fallbackTitle });
      itemsPatched++;
    }
  }
  await titleBatch.commit();

  // Fix content_versions with "Google News" title — use summary snippet
  const cvTitleBatch = db.batch();
  for (const doc of cvTitleSnap.docs) {
    const summary: string = doc.data().summary ?? "";
    const body: string = doc.data().body ?? "";
    const fallbackTitle = summary.split(/[.!?]/)[0]?.trim() ||
                          body.split(/[.!?]/)[0]?.trim() ||
                          "Article haïtien";
    const truncated = fallbackTitle.slice(0, 120);
    if (truncated) {
      cvTitleBatch.update(doc.ref, { title: truncated });
      cvPatched++;
    }
  }
  await cvTitleBatch.commit();

  console.log(`✅ Fixed "Google News" titles: ${titleSnap.size} items, ${cvTitleSnap.size} content_versions`);

  // ─── 4. Backfill category on content_versions from parent items ────────────
  console.log("Backfilling category on content_versions…");
  const allCvSnap = await db.collection("content_versions").get();
  // Process in batches of 400 (Firestore batch limit is 500)
  for (let i = 0; i < allCvSnap.docs.length; i += 400) {
    const chunk = allCvSnap.docs.slice(i, i + 400);
    const batch = db.batch();
    for (const cvDoc of chunk) {
      const data = cvDoc.data();
      if (!data.category) {
        // Look up the parent item
        const itemSnap = await db.collection("items").doc(data.itemId).get();
        if (itemSnap.exists) {
          const category = itemSnap.data()?.category;
          if (category) {
            batch.update(cvDoc.ref, { category });
            categoryPatched++;
          }
        }
      }
    }
    await batch.commit();
  }
  console.log(`✅ Backfilled category on ${categoryPatched} content_versions`);

  // ─── 5. Publish eligible drafts (no draftReason = passed all gates) ─────────
  console.log("Publishing eligible drafts…");
  const draftSnap = await db.collection("content_versions")
    .where("status", "==", "draft")
    .get();
  const eligible = draftSnap.docs.filter((d) => !d.data().draftReason);
  let publishedCount = 0;
  for (let i = 0; i < eligible.length; i += 400) {
    const chunk = eligible.slice(i, i + 400);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, { status: "published" });
      publishedCount++;
    }
    await batch.commit();
  }
  console.log(`✅ Published ${publishedCount} eligible drafts`);

  console.log(`\n🏁 Done — ${cvPatched} content_versions patched, ${itemsPatched} items patched, ${categoryPatched} categories backfilled, ${publishedCount} published`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
