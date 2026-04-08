import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });
import { getDb } from "@edlight-news/firebase";

async function main() {
  const db = getDb();
  const snap = await db.collection("ig_queue")
    .orderBy("createdAt", "desc")
    .limit(5)
    .get();

  for (const doc of snap.docs) {
    const d = doc.data();
    const item = d.sourceContentId ? await db.collection("items").doc(d.sourceContentId).get() : null;
    const it = item?.data();
    console.log(`\n--- queue=${doc.id} ---`);
    console.log(`  status=${d.status}  igPostId=${d.igPostId ?? "(none)"}`);
    console.log(`  item.category=${it?.category ?? "(none)"}  item.title="${String(it?.title ?? "").substring(0, 70)}"`);
    const s0 = d.slides?.[0];
    if (s0) {
      console.log(`  slide[0] keys: ${Object.keys(s0).join(", ")}`);
      for (const [k, v] of Object.entries(s0)) {
        if (typeof v === "string") console.log(`    ${k}: ${String(v).substring(0, 120)}`);
      }
    }
  }
}

main().catch(console.error);
