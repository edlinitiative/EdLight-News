import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { ThQueueItem, ThQueueStatus, ThMessagePayload } from "@edlight-news/types";
import { createThQueueItemSchema, type CreateThQueueItem } from "@edlight-news/types";

const COLLECTION = "th_queue";

function collection() {
  return getDb().collection(COLLECTION);
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createThQueueItem(data: CreateThQueueItem): Promise<ThQueueItem> {
  const validated = createThQueueItemSchema.parse(data);
  const clean = Object.fromEntries(
    Object.entries(validated).filter(([, v]) => v !== undefined),
  );
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...clean, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as ThQueueItem;
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getThQueueItem(id: string): Promise<ThQueueItem | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as ThQueueItem;
}

export async function findBySourceContentId(sourceContentId: string): Promise<ThQueueItem | null> {
  const snap = await collection()
    .where("sourceContentId", "==", sourceContentId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as ThQueueItem;
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
  status: ThQueueStatus,
  limit = 50,
): Promise<ThQueueItem[]> {
  const snap = await collection()
    .where("status", "==", status)
    .orderBy("score", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ThQueueItem);
}

export async function listQueuedByScore(limit = 20): Promise<ThQueueItem[]> {
  return listByStatus("queued", limit);
}

export async function listScheduled(limit = 10): Promise<ThQueueItem[]> {
  const snap = await collection()
    .where("status", "==", "scheduled" satisfies ThQueueStatus)
    .orderBy("scheduledFor", "asc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ThQueueItem);
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
  const snap = await collection()
    .where("status", "==", "sent" satisfies ThQueueStatus)
    .where("updatedAt", ">=", startTs)
    .count()
    .get();
  return snap.data().count;
}

export async function countScheduledToday(): Promise<number> {
  const { startISO, endISO } = haitiDayBounds();
  const snap = await collection()
    .where("status", "in", ["scheduled", "sending"])
    .where("scheduledFor", ">=", startISO)
    .where("scheduledFor", "<", endISO)
    .count()
    .get();
  return snap.data().count;
}

// ── Update ──────────────────────────────────────────────────────────────────

export async function updateStatus(
  id: string,
  status: ThQueueStatus,
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
  payload: ThMessagePayload,
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
    status: "scheduled" satisfies ThQueueStatus,
    scheduledFor,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markSent(
  id: string,
  thPostId?: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const update: Record<string, unknown> = {
    status: "sent" satisfies ThQueueStatus,
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  };
  if (thPostId) update.thPostId = thPostId;
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
        status: "sending" satisfies ThQueueStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
  } catch {
    return false;
  }
}

export async function listAll(limit = 100): Promise<ThQueueItem[]> {
  const snap = await collection()
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ThQueueItem);
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
    console.log(`[th-queue] Purged batch of ${snap.size} docs (total: ${totalDeleted})`);
  }

  return totalDeleted;
}
