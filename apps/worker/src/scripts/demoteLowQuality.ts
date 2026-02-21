/**
 * One-time migration: demote existing published content_versions that
 * should not have been auto-published under the new quality gates.
 *
 * Criteria for demotion (status → "draft"):
 *   1. Parent item's audienceFitScore < 0.65  (PUBLISH_SCORE_THRESHOLD)
 *   2. Parent item has no extractedText       (thin/hollow content)
 *
 * Usage:
 *   pnpm demote:low-quality                          # live writes
 *   DEMOTE_DRY_RUN=true pnpm demote:low-quality      # log-only, no writes
 *
 * Safe to re-run — only touches content_versions still marked "published".
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { PUBLISH_SCORE_THRESHOLD } from "@edlight-news/generator";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Config ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.env.DEMOTE_DRY_RUN === "true";

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `\n🔄 Demote low-quality published content — ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE MODE"}\n`,
  );

  const db = getDb();
  const cvCol = db.collection("content_versions");
  const itemsCol = db.collection("items");

  // 1. Load ALL published web content_versions
  const cvSnap = await cvCol
    .where("channel", "==", "web")
    .where("status", "==", "published")
    .get();

  console.log(`Found ${cvSnap.size} published web content_versions\n`);

  // 2. Collect unique itemIds and batch-fetch their parent items
  const itemIds = [...new Set(cvSnap.docs.map((d) => d.data().itemId as string))];
  console.log(`Spanning ${itemIds.length} unique items\n`);

  // Firestore getAll max is 100 at a time
  const itemMap = new Map<string, FirebaseFirestore.DocumentData>();
  for (let i = 0; i < itemIds.length; i += 100) {
    const batch = itemIds.slice(i, i + 100).map((id) => itemsCol.doc(id));
    const docs = await db.getAll(...batch);
    for (const doc of docs) {
      if (doc.exists) {
        itemMap.set(doc.id, doc.data()!);
      }
    }
  }
  console.log(`Loaded ${itemMap.size} parent items\n`);

  // 3. Evaluate each content_version against the new quality gates
  let demotedLowScore = 0;
  let demotedThinContent = 0;
  let alreadyOk = 0;
  let orphaned = 0;

  const bulkWriter = db.bulkWriter();

  for (const cvDoc of cvSnap.docs) {
    const cv = cvDoc.data();
    const itemId = cv.itemId as string;
    const item = itemMap.get(itemId);

    if (!item) {
      orphaned++;
      continue;
    }

    const score = item.audienceFitScore as number | undefined;
    const hasExtractedText = !!item.extractedText;

    let draftReason: string | undefined;

    if (score !== undefined && score < PUBLISH_SCORE_THRESHOLD) {
      draftReason = `Low audience-fit score (${score.toFixed(2)})`;
    } else if (!hasExtractedText) {
      draftReason = "No extracted article text — generated from title/summary only";
    }

    if (!draftReason) {
      alreadyOk++;
      continue;
    }

    const label = `  📝 ${cvDoc.id} (item=${itemId}, lang=${cv.language}, score=${score?.toFixed(2) ?? "?"}, text=${hasExtractedText ? "yes" : "NO"})`;

    if (score !== undefined && score < PUBLISH_SCORE_THRESHOLD) {
      demotedLowScore++;
      console.log(`${label} → draft: ${draftReason}`);
    } else {
      demotedThinContent++;
      console.log(`${label} → draft: ${draftReason}`);
    }

    if (!DRY_RUN) {
      bulkWriter.update(cvDoc.ref, {
        status: "draft",
        draftReason,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  if (!DRY_RUN) {
    await bulkWriter.close();
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`✅ Results:`);
  console.log(`   Low score (< ${PUBLISH_SCORE_THRESHOLD}):  ${demotedLowScore} demoted`);
  console.log(`   Thin content (no text):    ${demotedThinContent} demoted`);
  console.log(`   Already OK:                ${alreadyOk}`);
  console.log(`   Orphaned (no parent):      ${orphaned}`);
  console.log(`   Total published scanned:   ${cvSnap.size}`);
  if (DRY_RUN) {
    console.log(`\n   ⚠️  DRY RUN — no writes were made. Set DEMOTE_DRY_RUN=false to apply.\n`);
  } else {
    console.log(`\n   ✅ Writes committed.\n`);
  }
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
