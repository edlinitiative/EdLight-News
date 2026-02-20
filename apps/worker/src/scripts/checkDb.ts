import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../../../..", ".env") });

import { getDb } from "@edlight-news/firebase";

async function main() {
  const db = getDb();

  // Count sources
  const sources = await db.collection("sources").get();
  console.log(`\n📦 sources: ${sources.size}`);

  // Count raw_items
  const rawItems = await db.collection("raw_items").get();
  console.log(`📦 raw_items: ${rawItems.size}`);
  if (rawItems.size > 0) {
    console.log("  Recent raw_items:");
    for (const d of rawItems.docs.slice(0, 10)) {
      const data = d.data();
      console.log(`    - [${data.status}] ${data.title?.slice(0, 60)} → ${data.url?.slice(0, 60)}`);
    }
  }

  // Count items
  const items = await db.collection("items").get();
  console.log(`📦 items: ${items.size}`);
  if (items.size > 0) {
    for (const d of items.docs.slice(0, 5)) {
      const data = d.data();
      console.log(`    - ${data.title?.slice(0, 60)}`);
    }
  }

  // Count content_versions
  const cv = await db.collection("content_versions").get();
  console.log(`📦 content_versions: ${cv.size}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
