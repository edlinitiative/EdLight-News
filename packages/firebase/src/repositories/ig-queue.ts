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

/**
 * Fetch the set of sourceContentIds already present in the queue for entries
 * created within the last `windowDays` days.
 *
 * Used by buildIgQueue to perform a SINGLE batch read instead of one
 * findBySourceContentId call per item (saves ~500 reads per tick).
 */
export async function listSourceContentIdsSince(since: Date): Promise<Set<string>> {
  const sinceTs = Timestamp.fromDate(since);
  const snap = await collection()
    .where("createdAt", ">=", sinceTs)
    .select("sourceContentId")
    .get();
  const ids = new Set<string>();
  for (const doc of snap.docs) {
    const scid = doc.data().sourceContentId as string | undefined;
    if (scid) ids.add(scid);
  }
  return ids;
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
    .where("status", "==", "scheduled" satisfies IGQueueStatus)
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
 * Returns the offset in hours (positive = behind UTC, e.g. +4 for EDT, +5 for EST).
 */
function getHaitiOffsetHours(date: Date = new Date()): number {
  const haitiHour = parseInt(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Port-au-Prince", hour: "2-digit", hour12: false }).format(date),
    10,
  );
  const utcHour = date.getUTCHours();
  let diff = utcHour - haitiHour; // positive = behind UTC (+4 for EDT)
  if (diff > 12) diff -= 24;
  if (diff < -12) diff += 24;
  return diff;
}

/**
 * Convert a Date to Haiti local midnight boundaries.
 * Uses dynamic offset calculation to handle both EST and EDT.
 */
function haitiDayBounds(date: Date = new Date()): { startTs: Timestamp; endTs: Timestamp; startISO: string; endISO: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Port-au-Prince",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const y = parseInt(get("year"), 10);
  const m = parseInt(get("month"), 10) - 1;
  const d = parseInt(get("day"), 10);
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
 * Includes minimal fields: id, igType, status, targetPostDate.
 */
export async function listPostedAndScheduledToday(): Promise<Pick<IGQueueItem, "id" | "igType" | "status" | "targetPostDate">[]> {
  const { startTs, startISO, endISO } = haitiDayBounds();

  // Posted today (Haiti day)
  const postedSnap = await collection()
    .where("status", "==", "posted" satisfies IGQueueStatus)
    .where("updatedAt", ">=", startTs)
    .select("igType", "status", "targetPostDate")
    .get();

  // Scheduled today (Haiti day)
  const scheduledSnap = await collection()
    .where("status", "in", ["scheduled", "scheduled_ready_for_manual", "rendering"])
    .where("scheduledFor", ">=", startISO)
    .where("scheduledFor", "<", endISO)
    .select("igType", "status", "targetPostDate")
    .get();

  const results: Pick<IGQueueItem, "id" | "igType" | "status" | "targetPostDate">[] = [];
  for (const doc of [...postedSnap.docs, ...scheduledSnap.docs]) {
    const data = doc.data();
    results.push({ id: doc.id, igType: data.igType, status: data.status, targetPostDate: data.targetPostDate });
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
  extra?: Record<string, unknown>,
): Promise<void> {
  const update: Record<string, unknown> = {
    status: "posted" satisfies IGQueueStatus,
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
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
