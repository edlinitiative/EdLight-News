// Read the latest reels_pending_review doc and print its key fields.
import { getDb } from "@edlight-news/firebase";

async function main(): Promise<void> {
  const db = getDb();
  const id = process.argv[2] ?? "dL8TWYQqY93HMG2HtjP2";
  const d = await db.collection("reels_pending_review").doc(id).get();
  if (!d.exists) {
    console.log(`(no doc with id ${id})`);
    return;
  }
  const v = d.data() as Record<string, unknown>;
  console.log("id:", d.id);
  console.log("status:", v.status);
  console.log("format:", v.format);
  console.log("title:", v.title);
  console.log("hook:", v.hook);
  console.log("durationSec:", v.durationSec);
  console.log("reelVariant:", v.reelVariant);
  console.log("slackMessageTs:", v.slackMessageTs);
  console.log("videoStorageUrl:", v.videoStorageUrl);
  console.log("qualityScore.total:", (v.qualityScore as any)?.total);
  console.log("qualityScore.passed:", (v.qualityScore as any)?.passed);
  console.log("storyboard scenes:", Array.isArray(v.storyboard) ? (v.storyboard as unknown[]).length : 0);
  console.log("hashtags:", v.hashtags);
  console.log("---");
  console.log("videoUrl:", v.videoUrl);
  console.log("posterUrl:", v.posterUrl);
  console.log("storagePath:", v.storagePath);
  console.log("captionFr (first 300):", typeof v.captionFr === "string" ? v.captionFr.slice(0, 300) : v.captionFr);
  console.log("qualityScore detail:", JSON.stringify(v.qualityScore, null, 2));
  console.log("storyboard detail:", JSON.stringify(v.storyboard, null, 2));
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
