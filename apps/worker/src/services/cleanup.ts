/**
 * Shared cleanup logic used by both:
 *   - apps/worker/src/routes/cleanup.ts    (Cloud Scheduler weekly trigger)
 *   - apps/worker/src/scripts/runCleanup.ts (manual one-off)
 *
 * See routes/cleanup.ts header for the retention policy rationale.
 */

import { Timestamp } from "firebase-admin/firestore";
import { getDb, deleteCarouselSlides, igQueueRepo, itemsRepo } from "@edlight-news/firebase";

const BATCH_SIZE = 400;
const STORAGE_PARALLEL = 20;

// Non-Haiti detection (mirrors apps/worker/src/scripts/igPurgeNonHaiti.ts).
const NON_HAITI_BLOCKERS = [
  "african", "africain", "afrique", "africa",
  "nigerian", "kenyan", "south african", "ghanaian",
  "sub-saharan", "subsaharan", "sub saharan",
  "citizens of african", "pays africains",
  "ressortissants africains", "africains uniquement",
  "african union", "union africaine",
];
const HAITI_RELEVANT = [
  "haiti", "haïti", "ayiti",
  "all countries", "tous les pays",
  "worldwide", "international", "global",
  "caribbean", "caraïbes",
];
function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export type DeleteResult = { docsDeleted: number; storageOk: number; storageFail: number };

/**
 * Delete a list of `<collection>` doc IDs. For ig_queue, also best-effort
 * wipes carousel slides from GCS in parallel before the Firestore batch.
 */
async function deleteDocs(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  ids: string[],
  opts: { wipeStorage?: boolean } = {},
): Promise<DeleteResult> {
  if (ids.length === 0) return { docsDeleted: 0, storageOk: 0, storageFail: 0 };

  let storageOk = 0;
  let storageFail = 0;
  if (opts.wipeStorage) {
    for (let i = 0; i < ids.length; i += STORAGE_PARALLEL) {
      const batch = ids.slice(i, i + STORAGE_PARALLEL);
      const results = await Promise.allSettled(batch.map((id) => deleteCarouselSlides(id)));
      storageOk += results.filter((r) => r.status === "fulfilled").length;
      storageFail += results.filter((r) => r.status === "rejected").length;
    }
  }

  let docsDeleted = 0;
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const slice = ids.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const id of slice) batch.delete(db.collection(collectionName).doc(id));
    await batch.commit();
    docsDeleted += slice.length;
  }

  return { docsDeleted, storageOk, storageFail };
}

/**
 * Walk a query in pages of BATCH_SIZE, collect doc IDs, delete them.
 */
async function purgeByQuery(
  db: FirebaseFirestore.Firestore,
  collectionName: string,
  query: FirebaseFirestore.Query,
  opts: { wipeStorage?: boolean } = {},
): Promise<DeleteResult> {
  const allIds: string[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let pageQuery = query.limit(BATCH_SIZE);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const snap = await pageQuery.get();
    if (snap.empty) break;
    for (const doc of snap.docs) allIds.push(doc.id);
    if (snap.docs.length < BATCH_SIZE) break;
    cursor = snap.docs[snap.docs.length - 1] ?? null;
  }

  return deleteDocs(db, collectionName, allIds, opts);
}

/** Pass 1 — non-Haiti queued items. */
async function purgeNonHaitiQueued(
  db: FirebaseFirestore.Firestore,
): Promise<{ scanned: number; matched: number; result: DeleteResult }> {
  const queued = await igQueueRepo.listQueuedByScore(500);
  const toDelete: string[] = [];
  let scanned = 0;

  for (const qItem of queued) {
    if (qItem.igType !== "scholarship" && qItem.igType !== "opportunity") continue;
    scanned++;
    try {
      const item = await itemsRepo.getItem(qItem.sourceContentId);
      if (!item) continue;
      const eligText = (item.opportunity?.eligibility ?? []).join(" ");
      const combined = normalize(`${item.title ?? ""} ${item.summary ?? ""} ${eligText}`);
      const hasBlocker = NON_HAITI_BLOCKERS.some((b) => combined.includes(normalize(b)));
      if (!hasBlocker) continue;
      const hasHaitiMention = HAITI_RELEVANT.some((h) => combined.includes(normalize(h)));
      if (hasHaitiMention) continue;
      toDelete.push(qItem.id);
    } catch (err) {
      console.warn(`[cleanup] non-Haiti check failed for ${qItem.id}:`, err);
    }
  }

  const result = await deleteDocs(db, "ig_queue", toDelete, { wipeStorage: true });
  return { scanned, matched: toDelete.length, result };
}

/**
 * Run all cleanup passes. Returns a summary suitable for JSON serialization.
 *
 * Also persists the new ig_queue count to `metrics/ig_queue_count` so the
 * admin UI can read it without doing a full count() scan on every pageload.
 */
export async function runCleanup(): Promise<Record<string, unknown>> {
  const db = getDb();
  const summary: Record<string, unknown> = {};
  const startMs = Date.now();

  // count() can fail if the daily read quota is already exhausted (which is
  // often *why* cleanup is being run). Wrap so the deletion passes still run.
  const safeCount = async (col: string): Promise<number | null> => {
    try {
      return (await db.collection(col).count().get()).data().count;
    } catch (err) {
      console.warn(`[cleanup] count(${col}) failed:`, err instanceof Error ? err.message : err);
      return null;
    }
  };

  const beforeCount = await safeCount("ig_queue");
  summary.beforeCount = beforeCount;

  // Helper: build a status+age query that uses the existing
  // `status ASC + createdAt DESC` composite index. We must orderBy createdAt
  // explicitly when filtering with a range on it; using DESC matches the
  // index Firestore already has deployed (avoids a "needs index" error).
  const ageQuery = (
    col: string,
    status: string,
    cutoff: Timestamp,
  ): FirebaseFirestore.Query =>
    db.collection(col)
      .where("status", "==", status)
      .where("createdAt", "<", cutoff)
      .orderBy("createdAt", "desc");

  // ── ig_queue passes ───────────────────────────────────────────────────────
  console.log("[cleanup] ig_queue pass 1: non-Haiti queued");
  summary.nonHaiti = await purgeNonHaitiQueued(db);

  const cutoff30 = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 3600 * 1000));
  console.log("[cleanup] ig_queue pass 2a: skipped older than 30d");
  summary.staleSkipped = await purgeByQuery(db, "ig_queue", ageQuery("ig_queue", "skipped", cutoff30), { wipeStorage: true });
  console.log("[cleanup] ig_queue pass 2b: expired older than 30d");
  summary.staleExpired = await purgeByQuery(db, "ig_queue", ageQuery("ig_queue", "expired", cutoff30), { wipeStorage: true });

  // Score-ordered schedulers will never pick a `queued` item once newer
  // higher-scored items arrive. 3 days is plenty of grace; anything older is
  // dead weight. (Was 14d, but produced 600+ stale docs across sibling queues.)
  const cutoffStaleQueued = Timestamp.fromDate(new Date(Date.now() - 3 * 24 * 3600 * 1000));
  console.log("[cleanup] ig_queue pass 3: queued older than 3d");
  summary.staleQueued = await purgeByQuery(db, "ig_queue", ageQuery("ig_queue", "queued", cutoffStaleQueued), { wipeStorage: true });

  const cutoff90 = Timestamp.fromDate(new Date(Date.now() - 90 * 24 * 3600 * 1000));
  console.log("[cleanup] ig_queue pass 4: posted older than 90d");
  summary.oldPosted = await purgeByQuery(db, "ig_queue", ageQuery("ig_queue", "posted", cutoff90), { wipeStorage: true });

  // ── Sibling queues — same rules but no Storage cleanup needed ────────────
  // fb/wa/th/x queues don't store carousel slides.
  for (const col of ["fb_queue", "wa_queue", "th_queue", "x_queue"] as const) {
    const colSummary: Record<string, unknown> = {};
    colSummary.before = await safeCount(col);
    for (const [label, status, cutoff] of [
      ["skipped", "skipped", cutoff30],
      ["expired", "expired", cutoff30],
      ["queued", "queued", cutoffStaleQueued],
      ["posted", "posted", cutoff90],
      // fb_queue uses status="sent" instead of "posted"
      ["sent", "sent", cutoff90],
    ] as const) {
      try {
        colSummary[label] = await purgeByQuery(db, col, ageQuery(col, status, cutoff));
      } catch (err) {
        colSummary[label] = { error: err instanceof Error ? err.message : String(err) };
      }
    }
    colSummary.after = await safeCount(col);
    const before = colSummary.before as number | null;
    const after = colSummary.after as number | null;
    colSummary.freed = before !== null && after !== null ? before - after : null;
    summary[col] = colSummary;
  }

  const afterCount = await safeCount("ig_queue");
  summary.afterCount = afterCount;
  summary.freed =
    beforeCount !== null && afterCount !== null ? beforeCount - afterCount : null;
  summary.durationMs = Date.now() - startMs;

  // Persist count for the admin UI to read without a count() scan.
  if (afterCount !== null) {
    try {
      await db.collection("metrics").doc("ig_queue_count").set({
        count: afterCount,
        updatedAt: Timestamp.now(),
      });
    } catch (err) {
      console.warn("[cleanup] failed to persist metrics/ig_queue_count:", err);
    }
  }

  return summary;
}
