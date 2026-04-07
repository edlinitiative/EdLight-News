import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });
import { getDb } from "@edlight-news/firebase";

async function main() {
  const db = getDb();
  const snap = await db.collection("ig_queue")
    .where("status", "in", ["scheduled","scheduled_ready_for_manual","queued","rendering"])
    .get();
  const now = Date.now();
  for (const doc of snap.docs) {
    const d = doc.data();
    const createdMs = d.createdAt?.seconds ? d.createdAt.seconds * 1000 : 0;
    const ageH = createdMs ? Math.round((now - createdMs) / 3600000) : "?";
    console.log(doc.id, d.igType, d.status, "age=" + ageH + "h");
  }
  console.log("total:", snap.size);
}
main().catch(console.error);
