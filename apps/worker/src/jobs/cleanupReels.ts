/**
 * Worker job: cleanupReels — 7-day retention for reel videos.
 *
 * Every reel MP4 lives under `reels/` in Cloud Storage. Reels are posted to
 * Instagram manually within a day or two of generation, so the local copy is
 * dead weight afterwards. This job:
 *
 *   1. Deletes `reels/**` objects older than RETENTION_DAYS.
 *   2. Clears the now-dead `mp4Url` on any reels_pending_review doc that
 *      pointed at a deleted object, and deletes stale non-posted docs older
 *      than RETENTION_DAYS (posted docs are kept — the metrics loop needs
 *      them).
 *
 * Read-quota discipline: the pipeline runs every 15 minutes but this job
 * only does real work during the 04:00 Haiti-time hour (≤4 ticks/day). The
 * Cloud Storage listing is not a Firestore read; the Firestore part costs
 * one small collection scan on those ticks only.
 */

import { getStorage } from "firebase-admin/storage";
import { getApp, getDb } from "@edlight-news/firebase";

const RETENTION_DAYS = 7;
const HAITI_TZ = "America/Port-au-Prince";
const CLEANUP_HAITI_HOUR = 4;

export interface CleanupReelsResult {
  skipped: string | null;
  objectsDeleted: number;
  bytesReclaimed: number;
  docsDeleted: number;
  docsCleared: number;
}

function haitiHour(date: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: HAITI_TZ,
      hour: "2-digit",
      hour12: false,
    }).format(date),
  );
}

export async function cleanupReels(): Promise<CleanupReelsResult> {
  const result: CleanupReelsResult = {
    skipped: null,
    objectsDeleted: 0,
    bytesReclaimed: 0,
    docsDeleted: 0,
    docsCleared: 0,
  };

  if (haitiHour() !== CLEANUP_HAITI_HOUR) {
    result.skipped = `outside-cleanup-hour(${CLEANUP_HAITI_HOUR}h HT)`;
    return result;
  }

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 3600 * 1000;

  // ── 1. Storage: delete reel MP4s older than the retention window ────────
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? undefined;
  const bucket = getStorage(getApp()).bucket(bucketName);
  const [files] = await bucket.getFiles({ prefix: "reels/" });

  const expired = files.filter((f) => {
    const created = Date.parse(String(f.metadata.timeCreated ?? ""));
    return Number.isFinite(created) && created < cutoff;
  });

  const deletedNames = new Set<string>();
  for (const file of expired) {
    try {
      const size = Number(file.metadata.size ?? 0);
      await file.delete();
      deletedNames.add(file.name);
      result.objectsDeleted += 1;
      result.bytesReclaimed += size;
    } catch (err) {
      console.warn(`[cleanupReels] failed to delete ${file.name}:`, err);
    }
  }

  // ── 2. Firestore: clear dead links, prune stale non-posted docs ─────────
  // Small collection (≤ a few hundred docs) scanned at most 4×/day.
  const db = getDb();
  const snap = await db.collection("reels_pending_review").get();
  const batch = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    const status = String(doc.get("status") ?? "");
    const mp4Url = String(doc.get("mp4Url") ?? "");
    const generatedAtMs = (() => {
      const v = doc.get("generatedAt");
      const secs = v?.seconds ?? v?._seconds;
      return typeof secs === "number" ? secs * 1000 : NaN;
    })();
    const isExpired = Number.isFinite(generatedAtMs) && generatedAtMs < cutoff;

    const pointsAtDeleted =
      mp4Url && [...deletedNames].some((n) => mp4Url.includes(encodeURIComponent(n)) || mp4Url.includes(n));

    if (status !== "posted" && isExpired) {
      batch.delete(doc.ref);
      result.docsDeleted += 1;
      ops += 1;
    } else if (pointsAtDeleted) {
      batch.update(doc.ref, { mp4Url: "" });
      result.docsCleared += 1;
      ops += 1;
    }
  }
  if (ops > 0) await batch.commit();

  if (result.objectsDeleted > 0 || result.docsDeleted > 0) {
    console.log(
      `[cleanupReels] deleted ${result.objectsDeleted} objects ` +
        `(${(result.bytesReclaimed / 1024 / 1024).toFixed(1)} MB), ` +
        `${result.docsDeleted} stale docs, cleared ${result.docsCleared} dead links`,
    );
  }
  return result;
}
