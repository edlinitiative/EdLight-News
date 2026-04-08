import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });
import { getDb } from "@edlight-news/firebase";

async function main() {
  const db = getDb();
  const snap = await db.collection("ig_queue")
    .where("igPostId", "==", "18333532903216088")
    .get();

  for (const doc of snap.docs) {
    const d = doc.data();
    const item = d.sourceContentId ? await db.collection("items").doc(d.sourceContentId).get() : null;
    const it = item?.data();
    console.log(`=== queue=${doc.id} ===`);
    console.log(`  status=${d.status}  sourceContentId=${d.sourceContentId}`);
    console.log(`  item.category=${it?.category}  item.title="${it?.title}"`);
    console.log(`\n  Queue entry top-level keys: ${Object.keys(d).join(", ")}`);
    // Print all queue fields
    for (const [k, v] of Object.entries(d)) {
      if (k !== "slides") console.log(`  ${k}: ${JSON.stringify(v)?.substring(0, 150)}`);
    }
    console.log(`  slides length: ${d.slides?.length ?? "N/A"}`);

    // Check content_versions
    console.log(`\n  Content versions:`);
    const cvs = await db.collection("content_versions")
      .where("itemId", "==", d.sourceContentId)
      .get();
    console.log(`  ${cvs.size} content_version(s) found`);
    for (const cv of cvs.docs) {
      const cvd = cv.data();
      console.log(`  cv=${cv.id} type=${cvd.type} status=${cvd.status}`);
      if (cvd.slides) {
        for (let i = 0; i < cvd.slides.length; i++) {
          const s = cvd.slides[i];
          console.log(`    slide[${i}] type=${s.type} imageUrl=${s.imageUrl ?? "(none)"}`);
          if (s.lines) console.log(`      lines: ${JSON.stringify(s.lines)?.substring(0, 200)}`);
          if (s.headline) console.log(`      headline: ${s.headline}`);
          if (s.text) console.log(`      text: ${s.text?.substring(0, 100)}`);
        }
      }
    }

    // Item full data
    console.log(`\n  Item data:`);
    if (it) {
      for (const key of Object.keys(it)) {
        const v = (it as any)[key];
        if (typeof v !== "object" || v === null) {
          console.log(`    ${key}: ${JSON.stringify(v)?.substring(0, 100)}`);
        } else {
          console.log(`    ${key}: ${JSON.stringify(v)?.substring(0, 200)}`);
        }
      }
    }
  }
}

main().catch(console.error);
