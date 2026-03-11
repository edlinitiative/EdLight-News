import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { IGQueueItem, IGQueueStatus, IGFormattedPayload } from "@edlight-news/types";
import { createIGQueueItemSchema, type CreateIGQueueItem } from "@edlight-news/types";

const COLLECTION = "ig_queue";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function createIGQueueItem(data: CreateIGQueueItem): Promise<IGQueueItem> {
  const validated = createIGQueueItemSchema.parse(data);
  const clean = Object.fromEntries(
    Object.entries(validated).filter(([, v]) => v !== undefined),
  );
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...clean, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as IGQueueItem;
}

export async function getIGQueueItem(id: string): Promise<IGQueueItem | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as IGQueueItem;
}

export async function findBySourceContentId(sourceContentId: string): Promise<IGQueueItem | null> {
  const snap = await collection()
    .where("sourceContentId", "==", sourceContentId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as IGQueueItem;
}

export async function listByStatus(
  status: IGQueueStatus,
  limit = 50,
): Promise<IGQueueItem[]> {
  const snap = await collection()
    .where("status", "==", status)
    .orderBy("score", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IGQueueItem);
}

export async function listQueuedByScore(limit = 20): Promise<IGQueueItem[]> {
  return listByStatus("queued", limit);
}

export async function listScheduled(limit = 10): Promise<IGQueueItem[]> {
  const snap = await collection()
    .where("status", "in", ["scheduled", "scheduled_ready_for_manual"])
    .orderBy("scheduledFor", "asc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IGQueueItem);
}

export async function listRecentPosted(sinceDaysAgo = 1, limit = 10): Promise<IGQueueItem[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);
  const sinceTs = Timestamp.fromDate(since);

  const snap = await collection()
    .where("status", "==", "posted" satisfies IGQueueStatus)
    .where("updatedAt", ">=", sinceTs)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IGQueueItem);
}

/**
 * Compute the current UTC offset for Haiti dynamically.
 * Haiti observes US Eastern time rules (EST = UTC-5, EDT = UTC-4).
 * Returns the offset in hours (positive = behind UTC).
 */
function getHaitiOffsetHours(date: Date = new Date()): number {
  const haitiStr = date.toLocaleString("en-US", { timeZone: "America/Port-au-Prince" });
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const diffMs = new Date(utcStr).getTime() - new Date(haitiStr).getTime();
  return Math.round(diffMs / (60 * 60 * 1000));
}

/**
 * Convert a Date to Haiti local midnight boundaries.
 * Uses dynamic offset calculation to handle both EST and EDT.
 */
function haitiDayBounds(date: Date = new Date()): { startTs: Timestamp; endTs: Timestamp; startISO: string; endISO: string } {
  const haitiStr = date.toLocaleString("en-US", { timeZone: "America/Port-au-Prince" });
  const haitiDate = new Date(haitiStr);
  const y = haitiDate.getFullYear();
  const m = haitiDate.getMonth();
  const d = haitiDate.getDate();
  const offsetHours = getHaitiOffsetHours(date);
  // Haiti midnight in UTC = Haiti midnight + offset hours
  const startUTC = new Date(Date.UTC(y, m, d, offsetHours, 0, 0, 0));
  const endUTC = new Date(Date.UTC(y, m, d + 1, offsetHours, 0, 0, 0));
  return {
    startTs: Timestamp.fromDate(startUTC),
    endTs: Timestamp.fromDate(endUTC),
    startISO: startUTC.toISOString(),
    endISO: endUTC.toISOString(),
  };
}

export async function countPostedToday(): Promise<number> {
  const { startTs } = haitiDayBounds();

  const snap = await collection()
    .where("status", "==", "posted" satisfies IGQueueStatus)
    .where("updatedAt", ">=", startTs)
    .count()
    .get();
  return snap.data().count;
}

/**
 * Returns all items posted or scheduled today (for type-diversity checks).
 * Only includes minimal fields: id, igType, status.
 */
export async function listPostedAndScheduledToday(): Promise<Pick<IGQueueItem, "id" | "igType" | "status">[]> {
  const { startTs, startISO, endISO } = haitiDayBounds();

  // Posted today (Haiti day)
  const postedSnap = await collection()
    .where("status", "==", "posted" satisfies IGQueueStatus)
    .where("updatedAt", ">=", startTs)
    .select("igType", "status")
    .get();

  // Scheduled today (Haiti day)
  const scheduledSnap = await collection()
    .where("status", "in", ["scheduled", "scheduled_ready_for_manual", "rendering"])
    .where("scheduledFor", ">=", startISO)
    .where("scheduledFor", "<", endISO)
    .select("igType", "status")
    .get();

  const results: Pick<IGQueueItem, "id" | "igType" | "status">[] = [];
  for (const doc of [...postedSnap.docs, ...scheduledSnap.docs]) {
    const data = doc.data();
    results.push({ id: doc.id, igType: data.igType, status: data.status });
  }
  return results;
}

export async function countScheduledToday(): Promise<number> {
  const { startISO, endISO } = haitiDayBounds();

  const snap = await collection()
    .where("status", "in", ["scheduled", "scheduled_ready_for_manual", "rendering"])
    .where("scheduledFor", ">=", startISO)
    .where("scheduledFor", "<", endISO)
    .count()
    .get();
  return snap.data().count;
}

export async function updateStatus(
  id: string,
  status: IGQueueStatus,
  extra?: Record<string, unknown>,
): Promise<void> {
  const update: Record<string, unknown> = {
    status,
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  };
  await collection().doc(id).update(update);
}

export async function setPayload(
  id: string,
  payload: IGFormattedPayload,
): Promise<void> {
  await collection().doc(id).update({
    payload,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function setScheduled(
  id: string,
  scheduledFor: string,
): Promise<void> {
  await collection().doc(id).update({
    status: "scheduled" satisfies IGQueueStatus,
    scheduledFor,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markPosted(
  id: string,
  igPostId?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    status: "posted" satisfies IGQueueStatus,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (igPostId) update.igPostId = igPostId;
  await collection().doc(id).update(update);
}

/**
 * List ALL items in scheduled/rendering status (no limit on date range).
 * Used by cleanup logic to expire stale scheduled items.
 */
export async function listAllScheduled(limit = 50): Promise<IGQueueItem[]> {
  const snap = await collection()
    .where("status", "in", ["scheduled", "scheduled_ready_for_manual", "rendering"])
    .orderBy("scheduledFor", "asc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IGQueueItem);
}

/**
 * Atomically claim a scheduled item for processing by checking its current
 * status and updating to "rendering" in a single Firestore transaction.
 * Returns true if the claim succeeded, false if another runner already claimed it.
 */
export async function claimForProcessing(id: string): Promise<boolean> {
  const db = getDb();
  const ref = collection().doc(id);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const data = snap.data()!;
      // Only claim if still in "scheduled" status
      if (data.status !== "scheduled" && data.status !== "scheduled_ready_for_manual") {
        return false;
      }
      tx.update(ref, {
        status: "rendering" satisfies IGQueueStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
  } catch {
    return false;
  }
}

export async function listAll(limit = 100): Promise<IGQueueItem[]> {
  const snap = await collection()
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IGQueueItem);
}
