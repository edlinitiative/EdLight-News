import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });
import { getDb } from "@edlight-news/firebase";

const STANFORD_CITATION_URL = "https://exhibits.stanford.edu/haitiancreole/feed";
const STANFORD_UTILITY_SOURCE_ID = "q4VLWq5yswuMQQCML1pu";
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const db = getDb();
  console.log(`=== Stanford purge (dry=${DRY_RUN}) ===\n`);

  // Find all utility-engine items that cite the Stanford feed
  const snap = await db.collection("items").where("sourceId", "==", "utility-engine").get();
  const stanfordItems = snap.docs.filter((d) => {
    const citations: any[] = d.data()?.utilityMeta?.citations ?? [];
    return citations.some((c: any) => c.url === STANFORD_CITATION_URL);
  });
  console.log(`Found ${stanfordItems.length} items citing Stanford feed`);
  for (const d of stanfordItems) {
    console.log(`  item=${d.id} title="${d.data().title?.substring(0, 80)}"`);
  }

  // Find IG queue entries for these items
  const itemIds = stanfordItems.map((d) => d.id);
  const igPostIds: string[] = [];
  const queueIds: string[] = [];
  for (const itemId of itemIds) {
    const qSnap = await db.collection("ig_queue").where("sourceContentId", "==", itemId).get();
    for (const q of qSnap.docs) {
      const qd = q.data();
      queueIds.push(q.id);
      if (qd.igPostId) { igPostIds.push(qd.igPostId); }
      console.log(`  queue=${q.id} status=${qd.status} igPostId=${qd.igPostId ?? "(none)"}`);
    }
  }

  console.log(`\nSummary: ${itemIds.length} items | ${queueIds.length} queue entries | ${igPostIds.length} IG posts`);
  if (igPostIds.length > 0) {
    console.log("IG post IDs to delete from Instagram:", igPostIds.join(", "));
  }

  if (DRY_RUN) {
    console.log("\n(dry run — no changes made)");
    return;
  }

  // Delete content_versions
  for (const itemId of itemIds) {
    const cvSnap = await db.collection("content_versions").where("itemId", "==", itemId).get();
    for (const cv of cvSnap.docs) {
      await cv.ref.delete();
      console.log(`  ✅ Deleted content_version ${cv.id}`);
    }
  }
  // Delete ig_queue entries
  for (const id of queueIds) {
    await db.collection("ig_queue").doc(id).delete();
    console.log(`  ✅ Deleted queue ${id}`);
  }
  // Delete items
  for (const d of stanfordItems) {
    await d.ref.delete();
    console.log(`  ✅ Deleted item ${d.id}`);
  }
  // Deactivate utility source
  await db.collection("utility_sources").doc(STANFORD_UTILITY_SOURCE_ID).update({ active: false, enabled: false });
  console.log(`\n✅ Deactivated utility source ${STANFORD_UTILITY_SOURCE_ID}`);
  console.log("\nDone.");
}

main().catch(console.error);
