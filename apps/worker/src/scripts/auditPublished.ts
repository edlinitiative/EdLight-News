/**
 * Audit script: lists all published FR web content_versions with their
 * parent item details, sorted by audienceFitScore ascending.
 *
 * Usage:
 *   cd apps/worker && npx tsx src/scripts/auditPublished.ts
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";

// ── Load .env ───────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.resolve(monorepoRoot, ".env") });

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n📋 Audit: published FR web content_versions\n");

  const db = getDb();
  const cvCol = db.collection("content_versions");
  const itemsCol = db.collection("items");

  // 1. Load all published FR web content_versions
  const cvSnap = await cvCol
    .where("channel", "==", "web")
    .where("status", "==", "published")
    .where("language", "==", "fr")
    .get();

  console.log(`Found ${cvSnap.size} published FR web content_versions\n`);

  if (cvSnap.empty) {
    console.log("Nothing to audit.");
    return;
  }

  // 2. Collect unique itemIds and batch-fetch parent items
  const itemIds = [...new Set(cvSnap.docs.map((d) => d.data().itemId as string))];
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

  console.log(`Loaded ${itemMap.size} parent items for ${itemIds.length} unique itemIds\n`);

  // 3. Build rows
  interface Row {
    cvId: string;
    audienceFitScore: number | null;
    hasExtractedText: string;
    title: string;
    sourceName: string;
    confidence: number | null;
  }

  const rows: Row[] = [];

  for (const cvDoc of cvSnap.docs) {
    const cv = cvDoc.data();
    const itemId = cv.itemId as string;
    const item = itemMap.get(itemId);

    const audienceFitScore = item?.audienceFitScore ?? null;
    const hasExtractedText = item?.extractedText ? "yes" : "no";
    const title = (item?.title ?? "(no item)").slice(0, 80);
    const sourceName = item?.citations?.[0]?.sourceName ?? "(unknown)";
    const confidence = item?.confidence ?? null;

    rows.push({
      cvId: cvDoc.id,
      audienceFitScore,
      hasExtractedText,
      title,
      sourceName,
      confidence,
    });
  }

  // 4. Sort by audienceFitScore ascending (nulls first)
  rows.sort((a, b) => {
    const sa = a.audienceFitScore ?? -1;
    const sb = b.audienceFitScore ?? -1;
    return sa - sb;
  });

  // 5. Print table
  const header = [
    "cv.id".padEnd(24),
    "fitScore".padEnd(10),
    "extractTxt".padEnd(12),
    "confidence".padEnd(12),
    "source".padEnd(30),
    "title",
  ].join(" | ");

  const separator = "-".repeat(header.length);

  console.log(header);
  console.log(separator);

  for (const r of rows) {
    const line = [
      r.cvId.padEnd(24),
      (r.audienceFitScore !== null ? r.audienceFitScore.toFixed(2) : "n/a").padEnd(10),
      r.hasExtractedText.padEnd(12),
      (r.confidence !== null ? r.confidence.toFixed(2) : "n/a").padEnd(12),
      r.sourceName.slice(0, 30).padEnd(30),
      r.title,
    ].join(" | ");
    console.log(line);
  }

  // 6. Summary stats
  const count = rows.length;
  const scores = rows
    .map((r) => r.audienceFitScore)
    .filter((s): s is number => s !== null);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const withText = rows.filter((r) => r.hasExtractedText === "yes").length;
  const withoutText = rows.filter((r) => r.hasExtractedText === "no").length;

  console.log("\n" + separator);
  console.log(`\n📊 Summary Stats:`);
  console.log(`   Total published FR web CVs : ${count}`);
  console.log(`   Average audienceFitScore   : ${avgScore.toFixed(4)}`);
  console.log(`   Min audienceFitScore       : ${scores.length > 0 ? minScore.toFixed(4) : "n/a"}`);
  console.log(`   With extractedText         : ${withText}`);
  console.log(`   Without extractedText      : ${withoutText}`);
  console.log("");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
