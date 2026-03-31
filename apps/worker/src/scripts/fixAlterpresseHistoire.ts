/**
 * One-off script: Fix AlterPresse items wrongly tagged as "histoire".
 *
 * AlterPresse is a general news outlet, but its utility source was
 * configured with series="HaitiHistory", causing all its articles to be
 * routed to the histoire formatter.
 *
 * This script:
 *   1. Finds IG queue items with igType="histoire" that are still queued/scheduled
 *   2. Looks up the source item to check if it came from alterpresse.org
 *   3. Re-types matching items to igType="news" (or skips already-posted ones)
 *
 * Usage:
 *   npx tsx src/scripts/fixAlterpresseHistoire.ts
 *   # or with dry-run (no writes):
 *   DRY_RUN=1 npx tsx src/scripts/fixAlterpresseHistoire.ts
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../../..", ".env");
dotenv.config({ path: envPath });

import { getDb } from "@edlight-news/firebase";

const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  const db = getDb();

  console.log(`\n🔍 Finding histoire IG queue items that may be from AlterPresse...`);
  if (DRY_RUN) console.log("   (DRY RUN — no changes will be written)\n");

  // 1. Get all non-posted histoire items from ig_queue
  const igSnap = await db
    .collection("ig_queue")
    .where("igType", "==", "histoire")
    .get();

  console.log(`   Found ${igSnap.size} total histoire IG queue items.\n`);

  let fixed = 0;
  let skipped = 0;
  let alreadyPosted = 0;

  for (const igDoc of igSnap.docs) {
    const igData = igDoc.data();
    const sourceContentId = igData.sourceContentId as string;
    const status = igData.status as string;

    // 2. Look up the source item
    const itemSnap = await db.collection("items").doc(sourceContentId).get();
    if (!itemSnap.exists) {
      // Item was deleted — skip
      continue;
    }

    const itemData = itemSnap.data()!;
    // Items use singular `source` with `originalUrl` / `name`
    const source = itemData.source as { originalUrl?: string; name?: string } | undefined;
    const sourceList = (itemData.sourceList ?? []) as Array<{ url?: string }>;
    const citations = (itemData.utilityMeta?.citations ?? []) as Array<{ url?: string }>;

    const isAlterPresse =
      (source?.originalUrl && source.originalUrl.includes("alterpresse.org")) ||
      (source?.name && source.name.toLowerCase().includes("alterpresse")) ||
      sourceList.some((s) => s.url?.includes("alterpresse.org")) ||
      citations.some((c) => c.url?.includes("alterpresse.org"));

    if (!isAlterPresse) continue;

    const title = (igData.payload?.slides?.[0]?.heading ?? igData.reasons?.[0] ?? "(untitled)") as string;

    if (status === "posted") {
      console.log(`   ⏭️  Already posted — skipping: "${title}" [${igDoc.id}]`);
      alreadyPosted++;
      continue;
    }

    console.log(`   🔄 Retyping: "${title}" [${igDoc.id}] status=${status}`);

    if (!DRY_RUN) {
      // Change igType from "histoire" to "news", clear any histoire-specific payload
      await igDoc.ref.update({
        igType: "news",
        // Clear the old payload so the news formatter regenerates it on next tick
        payload: null,
        slides: 0,
        updatedAt: new Date(),
      });
    }
    fixed++;
  }

  // 3. Also fix the items collection — clear utilityMeta.series for AlterPresse items
  console.log(`\n🔍 Checking items collection for AlterPresse history items...`);
  const itemsSnap = await db
    .collection("items")
    .where("utilityMeta.series", "==", "HaitiHistory")
    .get();

  let itemsFixed = 0;
  for (const doc of itemsSnap.docs) {
    const data = doc.data();
    const source = data.source as { originalUrl?: string; name?: string } | undefined;
    const sourceList = (data.sourceList ?? []) as Array<{ url?: string }>;
    const citations = (data.utilityMeta?.citations ?? []) as Array<{ url?: string }>;

    const isAlterPresse =
      (source?.originalUrl && source.originalUrl.includes("alterpresse.org")) ||
      (source?.name && source.name.toLowerCase().includes("alterpresse")) ||
      sourceList.some((s) => s.url?.includes("alterpresse.org")) ||
      citations.some((c) => c.url?.includes("alterpresse.org"));

    if (!isAlterPresse) continue;

    const title = (data.headline ?? data.title ?? "(untitled)") as string;
    console.log(`   🔄 Clearing HaitiHistory series from item: "${title}" [${doc.id}]`);

    if (!DRY_RUN) {
      await doc.ref.update({
        "utilityMeta.series": "Career", // Neutral series that won't map to histoire
        updatedAt: new Date(),
      });
    }
    itemsFixed++;
  }

  console.log(`\n✅ Done!`);
  console.log(`   IG queue:  ${fixed} retyped to "news", ${alreadyPosted} already posted (skipped), ${skipped} skipped`);
  console.log(`   Items:     ${itemsFixed} cleared from HaitiHistory series`);
  if (DRY_RUN) console.log(`   ⚠️  DRY RUN — no actual changes were made. Remove DRY_RUN=1 to apply.`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
