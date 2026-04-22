import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "@edlight-news/firebase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const IDS = ["GuLkmaZZlFqONzwXrEAZ", "GGNAZbSPb36vkXFl0bj2"];

async function main() {
  const db = getDb();
  for (const id of IDS) {
    const snap = await db.collection("items").doc(id).get();
    if (!snap.exists) {
      console.log(`\n${id}: NOT FOUND`);
      continue;
    }
    const d = snap.data() as Record<string, unknown>;
    console.log(`\n── ${id} ──`);
    console.log(`title:      ${d.title}`);
    console.log(`category:   ${d.category}`);
    console.log(`vertical:   ${d.vertical}`);
    console.log(`geoTag:     ${d.geoTag}`);
    console.log(`opportunity:`, d.opportunity);
    console.log(`summary:    ${String(d.summary ?? "").slice(0, 200)}`);
    console.log(`extracted:  ${String(d.extractedText ?? "").slice(0, 300)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
