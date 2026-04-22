import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { FbQueueItem, FbQueueStatus, FbMessagePayload } from "@edlight-news/types";
import { createFbQueueItemSchema, type CreateFbQueueItem } from "@edlight-news/types";

const COLLECTION = "fb_queue";

function collection() {
  return getDb().collection(COLLECTION);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const timestampLike = value as { toDate?: unknown };
    if (typeof timestampLike.toDate === "function") {
      const parsed = timestampLike.toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === "number") return new Date(seconds * 1000);
  }
  return null;
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createFbQueueItem(data: CreateFbQueueItem): Promise<FbQueueItem> {
  const validated = createFbQueueItemSchema.parse(data);
  const clean = Object.fromEntries(
    Object.entries(validated).filter(([, v]) => v !== undefined),
  );
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...clean, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as FbQueueItem;
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getFbQueueItem(id: string): Promise<FbQueueItem | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as FbQueueItem;
}

export async function findBySourceContentId(sourceContentId: string): Promise<FbQueueItem | null> {
  const snap = await collection()
    .where("sourceContentId", "==", sourceContentId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as FbQueueItem;
}

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
  status: FbQueueStatus,
  limit = 50,
): Promise<FbQueueItem[]> {
  const snap = await collection()
    .where("status", "==", status)
    .limit(Math.max(limit * 4, 80))
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as FbQueueItem)
    .sort((a, b) => (Number(b.score ?? 0) - Number(a.score ?? 0)))
    .slice(0, limit);
}

export async function listQueuedByScore(limit = 20): Promise<FbQueueItem[]> {
  return listByStatus("queued", limit);
}

export async function listScheduled(limit = 10): Promise<FbQueueItem[]> {
  // Avoid hard dependency on composite index (status + scheduledFor).
  // We fetch scheduled docs and sort in-memory.
  const snap = await collection()
    .where("status", "==", "scheduled" satisfies FbQueueStatus)
    .limit(Math.max(limit * 4, 40))
    .get();

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as FbQueueItem)
    .sort((a, b) => {
      const aTime = toDate(a.scheduledFor)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = toDate(b.scheduledFor)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    })
    .slice(0, limit);
}

/**
 * Fetch FB queue items sent within the last `sinceHours` hours.
 * Used by the scheduler for topic-dedup / cool-off enforcement.
 */
export async function listRecentSent(sinceHours = 24, limit = 50): Promise<FbQueueItem[]> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
  const snap = await collection()
    .where("status", "==", "sent" satisfies FbQueueStatus)
    .limit(Math.max(limit * 4, 100))
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as FbQueueItem)
    .filter((item) => {
      const updatedAt = toDate(item.updatedAt);
      return updatedAt ? updatedAt.getTime() >= since.getTime() : false;
    })
    .sort((a, b) => {
      const aTime = toDate(a.updatedAt)?.getTime() ?? 0;
      const bTime = toDate(b.updatedAt)?.getTime() ?? 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}

// ── Haiti timezone helpers ──────────────────────────────────────────────────

function getHaitiOffsetHours(date: Date = new Date()): number {
  const haitiHour = parseInt(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Port-au-Prince", hour: "2-digit", hour12: false }).format(date),
    10,
  );
  const utcHour = date.getUTCHours();
  let diff = utcHour - haitiHour;
  if (diff > 12) diff -= 24;
  if (diff < -12) diff += 24;
  return diff;
}

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
  const startUTC = new Date(Date.UTC(y, m, d, offsetHours, 0, 0, 0));
  const endUTC = new Date(Date.UTC(y, m, d + 1, offsetHours, 0, 0, 0));
  return {
    startTs: Timestamp.fromDate(startUTC),
    endTs: Timestamp.fromDate(endUTC),
    startISO: startUTC.toISOString(),
    endISO: endUTC.toISOString(),
  };
}

export async function countSentToday(): Promise<number> {
  const { startTs } = haitiDayBounds();
  // Avoid composite index dependency (status + updatedAt) by filtering in-memory.
  const snap = await collection()
    .where("status", "==", "sent" satisfies FbQueueStatus)
    .limit(500)
    .get();
  return snap.docs.filter((doc) => {
    const updatedAt = toDate(doc.data().updatedAt);
    return updatedAt ? updatedAt.getTime() >= startTs.toDate().getTime() : false;
  }).length;
}

export async function countScheduledToday(): Promise<number> {
  const { startISO, endISO } = haitiDayBounds();
  // Avoid composite index dependency (status + scheduledFor range).
  const [scheduledSnap, sendingSnap] = await Promise.all([
    collection().where("status", "==", "scheduled" satisfies FbQueueStatus).limit(500).get(),
    collection().where("status", "==", "sending" satisfies FbQueueStatus).limit(500).get(),
  ]);

  const allDocs = [...scheduledSnap.docs, ...sendingSnap.docs];
  return allDocs.filter((doc) => {
    const scheduledFor = doc.data().scheduledFor as string | undefined;
    if (!scheduledFor) return false;
    return scheduledFor >= startISO && scheduledFor < endISO;
  }).length;
}

// ── Update ──────────────────────────────────────────────────────────────────

export async function updateStatus(
  id: string,
  status: FbQueueStatus,
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
  payload: FbMessagePayload,
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
    status: "scheduled" satisfies FbQueueStatus,
    scheduledFor,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markSent(
  id: string,
  fbPostId?: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const update: Record<string, unknown> = {
    status: "sent" satisfies FbQueueStatus,
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  };
  if (fbPostId) update.fbPostId = fbPostId;
  await collection().doc(id).update(update);
}

export async function claimForSending(id: string): Promise<boolean> {
  const db = getDb();
  const ref = collection().doc(id);
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return false;
      const data = snap.data()!;
      if (data.status !== "scheduled") return false;
      tx.update(ref, {
        status: "sending" satisfies FbQueueStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
  } catch {
    return false;
  }
}

export async function listAll(limit = 100): Promise<FbQueueItem[]> {
  const snap = await collection()
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FbQueueItem);
}

export async function purgeAll(): Promise<number> {
  const db = getDb();
  let totalDeleted = 0;
  const BATCH_SIZE = 500;

  while (true) {
    const snap = await collection().limit(BATCH_SIZE).get();
    if (snap.empty) break;

    const batch = db.batch();
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    totalDeleted += snap.size;
    console.log(`[fb-queue] Purged batch of ${snap.size} docs (total: ${totalDeleted})`);
  }

  return totalDeleted;
}
