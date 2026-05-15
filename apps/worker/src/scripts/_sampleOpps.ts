/* eslint-disable */
import dotenv from "dotenv";
dotenv.config({ path: "/workspaces/EdLight-News/.env" });
import { getDb } from "@edlight-news/firebase";

async function main() {
  const db = getDb();
  // Sample a few opportunites items + show what the verifier sees.
  const snap = await db.collection("items").where("vertical", "==", "opportunites").limit(10).get();
  for (const doc of snap.docs) {
    const d = doc.data() as any;
    console.log("─".repeat(80));
    console.log("ID         :", doc.id);
    console.log("title      :", String(d.title ?? "").slice(0, 120));
    console.log("category   :", d.category);
    console.log("vertical   :", d.vertical);
    console.log("summary    :", String(d.summary ?? "").slice(0, 280));
    console.log("extracted  :", String(d.extractedText ?? "").slice(0, 200));
    console.log("publishedAt:", d.publishedAt?.toDate?.());
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
