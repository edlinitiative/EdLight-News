/**
 * Fix script — addresses issues found in the content audit:
 *
 * 1. Re-enable (reactivate) all 53 sources
 * 2. Reset 2 stuck "rendering" IG items → "queued"
 * 3. Unpublish content_versions for items with expired opportunity deadlines
 * 4. Backfill itemType on items where it's missing
 *
 * Usage: cd apps/worker && npx tsx src/scripts/fixAuditIssues.ts
 */
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getDb } from "@edlight-news/firebase";
import { FieldValue } from "firebase-admin/firestore";

const db = getDb();

/* ================================================================== */
/*  1. Re-activate all sources                                        */
/* ================================================================== */

async function reactivateSources() {
  console.log("\n═══ 1. Re-activating sources ═══");
  const snap = await db.collection("sources").where("active", "==", false).get();
  if (snap.empty) {
    console.log("  All sources are already active ✓");
    return;
  }

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`  ✅ Re-activated ${snap.size} sources`);
}

/* ================================================================== */
/*  2. Reset stuck "rendering" IG items                               */
/* ================================================================== */

async function resetStuckRendering() {
  console.log("\n═══ 2. Resetting stuck 'rendering' IG items ═══");
  const snap = await db.collection("ig_queue").where("status", "==", "rendering").get();
  if (snap.empty) {
    console.log("  No stuck items ✓");
    return;
  }

  const batch = db.batch();
  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      status: "queued",
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`  ✅ Reset ${snap.size} items from "rendering" → "queued"`);
}

/* ================================================================== */
/*  3. Unpublish expired opportunity content                          */
/* ================================================================== */

async function unpublishExpiredOpportunities() {
  console.log("\n═══ 3. Unpublishing expired opportunities ═══");
  const now = new Date();

  // Find items that have an expired opportunity deadline
  const itemsSnap = await db.collection("items").get();
  const expiredItemIds: string[] = [];

  for (const doc of itemsSnap.docs) {
    const data = doc.data();
    const deadline = data.opportunity?.deadline ?? data.deadline;
    if (!deadline) continue;
    try {
      if (new Date(deadline) < now) {
        expiredItemIds.push(doc.id);
      }
    } catch {
      // skip unparseable dates
    }
  }

  if (expiredItemIds.length === 0) {
    console.log("  No expired opportunities found ✓");
    return;
  }
  console.log(`  Found ${expiredItemIds.length} items with expired deadlines`);

  // Find their published content_versions and set to "draft" with reason
  let updated = 0;
  for (let i = 0; i < expiredItemIds.length; i += 10) {
    const batch = expiredItemIds.slice(i, i + 10);
    for (const itemId of batch) {
      const cvSnap = await db
        .collection("content_versions")
        .where("itemId", "==", itemId)
        .where("status", "==", "published")
        .get();

      if (cvSnap.empty) continue;

      const writeBatch = db.batch();
      for (const cvDoc of cvSnap.docs) {
        writeBatch.update(cvDoc.ref, {
          status: "draft",
          draftReason: "Deadline expired",
          updatedAt: FieldValue.serverTimestamp(),
        });
        updated++;
      }
      await writeBatch.commit();
    }
  }
  console.log(`  ✅ Unpublished ${updated} content_versions with expired deadlines`);
}

/* ================================================================== */
/*  4. Backfill missing itemType on items                             */
/* ================================================================== */

async function backfillItemType() {
  console.log("\n═══ 4. Backfilling missing itemType ═══");

  // Items missing itemType — set based on heuristics
  const snap = await db.collection("items")
    .orderBy("createdAt", "desc")
    .limit(2000)
    .get();

  let updated = 0;
  const chunks: FirebaseFirestore.DocumentSnapshot[] = [];

  for (const doc of snap.docs) {
    const data = doc.data()!;

    // Skip if already has a meaningful itemType
    if (data.itemType && data.itemType !== "unknown") continue;

    // Determine type from other signals
    let itemType = "source"; // default for scraped news

    if (data.utilityMeta || data.sourceId === "utility-engine") {
      itemType = "utility";
    } else if (data.synthesisMeta || data.clusterId) {
      itemType = "synthesis";
    } else if (data.sourceId === "haiti-history-almanac") {
      itemType = "source"; // history items are still sourced
    }

    // Only update if we have something better than unknown
    if (itemType !== "unknown") {
      chunks.push(doc);
    }
  }

  // Batch update
  for (let i = 0; i < chunks.length; i += 400) {
    const batch = db.batch();
    for (const doc of chunks.slice(i, i + 400)) {
      const data = doc.data()!;
      let itemType = "source";
      if (data.utilityMeta || data.sourceId === "utility-engine") {
        itemType = "utility";
      } else if (data.synthesisMeta || data.clusterId) {
        itemType = "synthesis";
      }

      batch.update(doc.ref, {
        itemType,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    updated += Math.min(400, chunks.length - i);
  }

  console.log(`  ✅ Backfilled itemType on ${updated} items`);
}

/* ================================================================== */
/*  MAIN                                                              */
/* ================================================================== */

async function main() {
  console.log("🔧 EdLight News — Audit Fix Script");
  console.log(`   Run at: ${new Date().toISOString()}\n`);

  await reactivateSources();
  await resetStuckRendering();
  await unpublishExpiredOpportunities();
  await backfillItemType();

  console.log("\n✅ All fixes applied.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fix script failed:", err);
  process.exit(1);
});
