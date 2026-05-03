/**
 * Quick diagnostic: inspect why listOpportunitiesNeedingScholarshipPromotion
 * returns 0 despite 692 items with vertical="opportunites".
 *
 * Checks which gate criteria the items fail.
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
  const snap = await db
    .collection("items")
    .where("vertical", "==", "opportunites")
    .limit(50)
    .get();

  let hasCanonicalUrl = 0;
  let hasExtractedText = 0;
  let hasSummary = 0;
  let hasEither = 0;
  let hasScholarshipPromotion = 0;
  let hasScholarshipPromotionAttempts = 0;

  console.log(`Sampling ${snap.size} items:\n`);

  let count = 0;
  for (const doc of snap.docs) {
    const it = doc.data();
    const passUrl = !!it.canonicalUrl;
    const passExtract = !!it.extractedText;
    const passSummary = !!it.summary;
    const passEither = passExtract || passSummary;

    if (passUrl) hasCanonicalUrl++;
    if (passExtract) hasExtractedText++;
    if (passSummary) hasSummary++;
    if (passEither) hasEither++;
    if (it.scholarshipPromotion) hasScholarshipPromotion++;
    if (it.scholarshipPromotionAttempts !== undefined) hasScholarshipPromotionAttempts++;

    count++;
    if (count <= 3) {
      console.log(`--- Item ${doc.id} ---`);
      console.log(`  canonicalUrl:        ${it.canonicalUrl ? "YES" : "MISSING"}`);
      console.log(`  extractedText length: ${typeof it.extractedText === "string" ? it.extractedText.length : "N/A"}`);
      console.log(`  summary:             ${it.summary ? "YES" : "MISSING"}`);
      console.log(`  scholarshipPromotion: ${it.scholarshipPromotion ?? "none"}`);
      console.log(`  scholarshipPromotionAttempts: ${it.scholarshipPromotionAttempts ?? "none"}`);
      console.log(`  title:               ${(it.title || "").substring(0, 80)}`);
      console.log(`  canonicalUrl value:  ${(it.canonicalUrl || "").substring(0, 80)}`);
      console.log();
    }
  }

  console.log(`\nTotals (sample of ${snap.size}):`);
  console.log(`  has canonicalUrl:            ${hasCanonicalUrl}/${snap.size}`);
  console.log(`  has extractedText:           ${hasExtractedText}/${snap.size}`);
  console.log(`  has summary:                 ${hasSummary}/${snap.size}`);
  console.log(`  has either text or summary:  ${hasEither}/${snap.size}`);
  console.log(`  has scholarshipPromotion:    ${hasScholarshipPromotion}/${snap.size}`);
  console.log(`  passes ALL promotion gates:  ${(hasCanonicalUrl > 0 && hasEither > 0) ? "YES" : "NO — missing data"}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});