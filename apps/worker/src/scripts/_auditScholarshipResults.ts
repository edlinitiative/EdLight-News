/**
 * Full audit of scholarship promotion results across all opportunities items.
 * Counts promoted vs rejected vs unprocessed, and checks bourses existence.
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const db = getDb();
  const PAGE_SIZE = 100;
  let lastDoc: any = null;
  let totalItems = 0;
  let totalProcessed = 0;
  let totalUnprocessed = 0;
  let totalPromoted = 0;
  let totalRejected = 0;
  let totalFailed = 0;
  const promotedIds: string[] = [];

  console.log("Scanning all opportunities items...\n");

  while (true) {
    let q = db
      .collection("items")
      .where("vertical", "==", "opportunites")
      .orderBy("__name__")
      .limit(PAGE_SIZE);

    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const it = doc.data();
      totalItems++;

      if (it.scholarshipPromotion === "promoted") {
        totalPromoted++;
        totalProcessed++;
        promotedIds.push(doc.id);
      } else if (it.scholarshipPromotion === "rejected") {
        totalRejected++;
        totalProcessed++;
      } else if (it.scholarshipPromotion === "failed") {
        totalFailed++;
        totalProcessed++;
      } else {
        totalUnprocessed++;
      }
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    console.log(`  Scanned ${totalItems} items so far...`);
  }

  console.log(`\n=== Scholarship Promotion Results ===`);
  console.log(`Total items (vertical=opportunites): ${totalItems}`);
  console.log(`Processed:   ${totalProcessed} (${((totalProcessed / totalItems) * 100).toFixed(1)}%)`);
  console.log(`  Promoted:  ${totalPromoted}`);
  console.log(`  Rejected:  ${totalRejected}`);
  console.log(`  Failed:    ${totalFailed}`);
  console.log(`Unprocessed: ${totalUnprocessed}`);

  // Check bourses collection
  console.log(`\nChecking bourses collection...`);
  const boursesSnap = await db.collection("bourses").count().get();
  console.log(`Total bourses documents: ${boursesSnap.data().count}`);

  // Spot-check 5 promoted items to confirm bourses exist
  if (promotedIds.length > 0) {
    console.log(`\nSpot-checking bourses for first 5 promoted items:`);
    const sample = promotedIds.slice(0, 5);
    for (const id of sample) {
      const bourse = await db.collection("bourses").doc(id).get();
      console.log(`  ${id}: bourse ${bourse.exists ? "EXISTS ✓" : "MISSING ✗"}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});