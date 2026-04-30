/**
 * Diagnostic: Audit the full bourse pipeline to understand why the IG queue is empty.
 *
 * Checks:
 *   1. How many items have vertical="opportunites" or opportunity-like category
 *   2. How many have scholarshipEvaluatedAt set (already processed by discoverScholarships)
 *   3. Among processed items, how many have empty eligibility (the bug)
 *   4. How many IG queue entries exist for scholarship/opportunity types
 *   5. Sampled items to show actual data shapes
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const OPPORTUNITY_CATEGORIES = new Set([
  "scholarship",
  "opportunity",
  "bourses",
  "concours",
  "stages",
  "programmes",
]);

async function main() {
  const db = getDb();

  // ── 1. Items with vertical="opportunites" or opportunity-like category ──
  console.log("=".repeat(70));
  console.log("1. ITEMS INGRESS");
  console.log("=".repeat(70));

  const verticalSnap = await db
    .collection("items")
    .where("vertical", "==", "opportunites")
    .limit(500)
    .get();
  console.log(`  vertical="opportunites": ${verticalSnap.size} items`);

  const catSnaps = await Promise.all(
    Array.from(OPPORTUNITY_CATEGORIES).map((c) =>
      db.collection("items").where("category", "==", c).limit(300).get(),
    ),
  );
  const catTotal = catSnaps.reduce((sum, s) => sum + s.size, 0);
  console.log(`  category in [${Array.from(OPPORTUNITY_CATEGORIES).join(", ")}]: ${catTotal} items`);

  // Union of both queries (by id)
  const allItems = new Map<string, any>();
  verticalSnap.forEach((doc) => allItems.set(doc.id, { id: doc.id, ...doc.data() }));
  for (const snap of catSnaps) {
    snap.forEach((doc) => allItems.set(doc.id, { id: doc.id, ...doc.data() }));
  }
  console.log(`  Union (unique items): ${allItems.size}`);
  console.log();

  // ── 2. Processed by discoverScholarships ──
  console.log("=".repeat(70));
  console.log("2. DISCOVER SCHOLARSHIPS PROCESSING");
  console.log("=".repeat(70));

  const processed: any[] = [];
  const unprocessed: any[] = [];
  const broken: any[] = [];

  for (const item of allItems.values()) {
    if (item.scholarshipEvaluatedAt) {
      processed.push(item);
      const eligibility = item.opportunity?.eligibility;
      if (!eligibility || !Array.isArray(eligibility) || eligibility.length === 0) {
        broken.push(item);
      }
    } else {
      unprocessed.push(item);
    }
  }

  console.log(`  Processed (scholarshipEvaluatedAt set): ${processed.length}`);
  console.log(`  Unprocessed: ${unprocessed.length}`);
  console.log(`  BROKEN (processed but eligibility empty/missing): ${broken.length}`);
  console.log();

  // ── 3. IG Queue ──
  console.log("=".repeat(70));
  console.log("3. IG QUEUE");
  console.log("=".repeat(70));

  const queueAll = await db.collection("ig_queue").limit(500).get();
  console.log(`  Total ig_queue entries: ${queueAll.size}`);

  const queueByType: Record<string, number> = {};
  const queueScholarship: any[] = [];
  const queueOpportunity: any[] = [];

  queueAll.forEach((doc) => {
    const d = doc.data();
    const t = d.type ?? d.igType ?? "unknown";
    queueByType[t] = (queueByType[t] ?? 0) + 1;
    if (t === "scholarship") queueScholarship.push({ id: doc.id, ...d });
    if (t === "opportunity") queueOpportunity.push({ id: doc.id, ...d });
  });

  for (const [t, c] of Object.entries(queueByType).sort()) {
    console.log(`  type="${t}": ${c}`);
  }
  console.log();

  // ── 4. Detailed breakdown of processed items ──
  console.log("=".repeat(70));
  console.log("4. DETAILED BREAKDOWN");
  console.log("=".repeat(70));

  if (processed.length === 0) {
    console.log("  No items have been processed by discoverScholarships yet.");
    console.log("  The worker tick has not run or no items matched");
    console.log("  listOpportunitiesNeedingScholarshipPromotion().");
    console.log();
    console.log("  Possible reasons:");
    console.log("    - Worker is not running");
    console.log("    - No items have vertical=opportunites AND scholarshipEvaluatedAt=null");
    console.log("    - Items need both vertical=opportunites AND category IN");
    console.log("      ['scholarship','opportunity','bourses','concours','stages','programmes']");
    console.log("      to match listOpportunitiesNeedingScholarshipPromotion()");
  } else {
    // Show categories of processed items
    const catCount: Record<string, number> = {};
    for (const i of processed) {
      const c = i.category ?? "undefined";
      catCount[c] = (catCount[c] ?? 0) + 1;
    }
    console.log("  Processed items by category:");
    for (const [c, n] of Object.entries(catCount).sort()) {
      console.log(`    ${c}: ${n}`);
    }

    if (broken.length > 0) {
      console.log();
      console.log(`  Broken items (${broken.length}):`);
      for (const i of broken.slice(0, 5)) {
        console.log(`    ${i.id}`);
        console.log(`      category: ${i.category ?? "undefined"}`);
        console.log(`      eligibility: ${JSON.stringify(i.opportunity?.eligibility)}`);
        console.log(`      has opportunity.deadline: ${!!i.opportunity?.deadline}`);
        console.log(`      has opportunity.coverage: ${!!i.opportunity?.coverage}`);
        console.log(`      has opportunity.howToApply: ${!!i.opportunity?.howToApply}`);
        console.log(`      canonicalUrl: ${i.canonicalUrl?.slice(0, 80) ?? "none"}`);
        console.log();
      }
    }

    // Show items that passed vs. items by promotion status
    const promoted = processed.filter(
      (i) => i.scholarshipPromotion === "promoted",
    );
    const rejected = processed.filter(
      (i) => i.scholarshipPromotion === "rejected",
    );
    const failed = processed.filter(
      (i) => i.scholarshipPromotion === "failed" || !i.scholarshipPromotion,
    );
    console.log(`  promotion="promoted": ${promoted.length}`);
    console.log(`  promotion="rejected": ${rejected.length}`);
    console.log(`  promotion="failed" or unset: ${failed.length}`);
  }

  // ── 5. Show a few actual IG queue entries ──
  console.log();
  console.log("=".repeat(70));
  console.log("5. IG QUEUE SAMPLE (first 5)");
  console.log("=".repeat(70));

  const allQueue = [...queueAll.docs].slice(0, 5);
  if (allQueue.length === 0) {
    console.log("  NO entries in ig_queue at all.");
    console.log("  buildIgQueue job has not run or no items passed selection.");
  } else {
    for (const doc of allQueue) {
      const d = doc.data();
      console.log(`  ${doc.id}`);
      console.log(`    type: ${d.type ?? d.igType ?? "unknown"}`);
      console.log(`    priority: ${d.priority ?? d.score ?? "unset"}`);
      console.log(
        `    title: ${(d.title ?? d.caption ?? "").slice(0, 80)}`,
      );
      console.log(
        `    itemId: ${d.itemId ?? "unset"}`,
      );
      console.log(
        `    createdAt: ${d.createdAt?.toDate?.()?.toISOString() ?? d.createdAt}`,
      );
      console.log();
    }
  }

  // ── 6. Summary ──
  console.log("=".repeat(70));
  console.log("6. PIPELINE HEALTH SUMMARY");
  console.log("=".repeat(70));
  console.log();

  const issues: string[] = [];

  if (allItems.size === 0) {
    issues.push(
      "❌ NO items with vertical=opportunites or opportunity categories — scraper may not be running",
    );
  }
  if (unprocessed.length === allItems.size && allItems.size > 0) {
    issues.push(
      "❌ NO items processed by discoverScholarships — worker tick may not be running",
    );
  }
  if (broken.length > 0) {
    issues.push(
      `❌ ${broken.length} items have scholarshipEvaluatedAt but empty eligibility — REPAIR BACKFILL NEEDED`,
    );
  }
  if (queueAll.size === 0 && broken.length === 0 && processed.length > 0) {
    issues.push(
      "⚠️  Items processed but none in ig_queue — check buildIgQueue selection gates or timing window (72h)",
    );
  }
  if (queueAll.size === 0 && processed.length === 0) {
    issues.push(
      "⚠️  No items processed AND no queue entries — discoverScholarships tick has not run or no matching items",
    );
  }

  if (issues.length === 0) {
    console.log("  ✅ Pipeline appears healthy");
  } else {
    for (const issue of issues) {
      console.log(`  ${issue}`);
    }
  }

  console.log();
  console.log(
    "  Freshness window for buildIgQueue: last 72h (configured in buildIgQueue.ts)",
  );
  console.log(
    `  IG queue total entries: ${queueAll.size}`,
  );
  console.log(
    `  Scholarship queue entries: ${queueScholarship.length}`,
  );
  console.log(
    `  Opportunity queue entries: ${queueOpportunity.length}`,
  );
}

main()
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });