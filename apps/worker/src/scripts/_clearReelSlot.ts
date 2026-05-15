import dotenv from "dotenv";
dotenv.config({ path: "/workspaces/EdLight-News/.env" });
import { getDb } from "@edlight-news/firebase";

const REEL_ID = "Ppau8q5xkPlCNzxN88Av";
async function main() {
  const db = getDb();
  const ref = db.collection("reels_pending_review").doc(REEL_ID);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`No reel ${REEL_ID} found.`);
    return;
  }
  const data = snap.data();
  console.log(`Found reel: status=${data?.status}`);
  await ref.update({
    status: "rejected",
    rejectedReason: "silent-audio-and-wrong-background (pre-PR#83 build)",
    rejectedAt: new Date(),
  });
  console.log(`✅ Marked reel ${REEL_ID} as rejected → slot open for next tick.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
