/**
 * One-off purge: delete ALL video content from the project.
 *
 * What it deletes:
 *   1. Cloud Storage — every object under `reels/` plus any other object
 *      whose contentType is `video/*` or whose extension is a video format
 *      (.mp4 / .mov / .webm / .m4v), wherever it lives in the bucket.
 *   2. Firestore — `reels_pending_review` docs with status pending /
 *      approved / rejected (their MP4s are gone, the review is moot).
 *      Docs with status `posted` are KEPT — they track live Instagram posts
 *      for the metrics loop — but their dead `mp4Url` is cleared.
 *
 * Usage:
 *   DRY_RUN=true  npx tsx src/scripts/purgeReelVideos.ts   # report only
 *   npx tsx src/scripts/purgeReelVideos.ts                 # delete
 *
 * Requires FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 * and FIREBASE_STORAGE_BUCKET (same env as the pipeline).
 */

import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), "../..", ".env") });

import { getStorage } from "firebase-admin/storage";
import { getApp, getDb } from "@edlight-news/firebase";

const DRY_RUN = process.env.DRY_RUN === "true";
const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i;

function fmtMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function purgeBucketVideos(): Promise<void> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? undefined;
  const bucket = getStorage(getApp()).bucket(bucketName);
  console.log(`Scanning bucket gs://${bucket.name} …`);

  const [files] = await bucket.getFiles();
  console.log(`Bucket holds ${files.length} objects total.`);

  const victims = files.filter((f) => {
    const ct = String(f.metadata.contentType ?? "");
    return (
      f.name.startsWith("reels/") || ct.startsWith("video/") || VIDEO_EXT.test(f.name)
    );
  });

  // Per-prefix report so the run log doubles as an audit trail.
  const byPrefix = new Map<string, { count: number; bytes: number }>();
  for (const f of victims) {
    const prefix = f.name.split("/")[0] ?? "(root)";
    const entry = byPrefix.get(prefix) ?? { count: 0, bytes: 0 };
    entry.count += 1;
    entry.bytes += Number(f.metadata.size ?? 0);
    byPrefix.set(prefix, entry);
  }

  let totalBytes = 0;
  for (const [prefix, { count, bytes }] of [...byPrefix.entries()].sort(
    (a, b) => b[1].bytes - a[1].bytes,
  )) {
    console.log(`  ${prefix}/ — ${count} video objects, ${fmtMB(bytes)}`);
    totalBytes += bytes;
  }
  console.log(
    `Video objects to delete: ${victims.length} (${fmtMB(totalBytes)})${DRY_RUN ? " [DRY RUN — nothing deleted]" : ""}`,
  );

  if (DRY_RUN || victims.length === 0) return;

  let deleted = 0;
  const chunkSize = 25;
  for (let i = 0; i < victims.length; i += chunkSize) {
    const chunk = victims.slice(i, i + chunkSize);
    const results = await Promise.allSettled(chunk.map((f) => f.delete()));
    for (const [j, r] of results.entries()) {
      if (r.status === "fulfilled") deleted += 1;
      else console.warn(`  ! failed to delete ${chunk[j]!.name}:`, r.reason);
    }
  }
  console.log(`Deleted ${deleted}/${victims.length} video objects (${fmtMB(totalBytes)} reclaimed).`);
}

async function purgeReelDocs(): Promise<void> {
  const db = getDb();
  const snap = await db.collection("reels_pending_review").get();
  console.log(`reels_pending_review holds ${snap.size} docs.`);

  let toDelete = 0;
  let toClear = 0;
  const batchLimit = 400;
  let batch = db.batch();
  let ops = 0;

  const flush = async () => {
    if (ops > 0 && !DRY_RUN) await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const doc of snap.docs) {
    const status = String(doc.get("status") ?? "");
    if (status === "posted") {
      // Keep the doc (live IG post metrics) but drop the dead video link.
      if (doc.get("mp4Url")) {
        batch.update(doc.ref, { mp4Url: "" });
        toClear += 1;
        ops += 1;
      }
    } else {
      batch.delete(doc.ref);
      toDelete += 1;
      ops += 1;
    }
    if (ops >= batchLimit) await flush();
  }
  await flush();

  console.log(
    `Firestore: ${toDelete} non-posted reel docs deleted, mp4Url cleared on ${toClear} posted docs${DRY_RUN ? " [DRY RUN — nothing written]" : ""}.`,
  );
}

async function main() {
  console.log(`=== purgeReelVideos ${DRY_RUN ? "(DRY RUN)" : ""} ===`);
  await purgeBucketVideos();
  await purgeReelDocs();
  console.log("=== done ===");
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
