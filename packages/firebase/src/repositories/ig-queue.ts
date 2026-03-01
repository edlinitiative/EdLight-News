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

export async function countPostedToday(): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTs = Timestamp.fromDate(startOfDay);

  const snap = await collection()
    .where("status", "==", "posted" satisfies IGQueueStatus)
    .where("updatedAt", ">=", startTs)
    .count()
    .get();
  return snap.data().count;
}

export async function countScheduledToday(): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const snap = await collection()
    .where("status", "in", ["scheduled", "scheduled_ready_for_manual", "rendering"])
    .where("scheduledFor", ">=", startOfDay.toISOString())
    .where("scheduledFor", "<", endOfDay.toISOString())
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

export async function listAll(limit = 100): Promise<IGQueueItem[]> {
  const snap = await collection()
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IGQueueItem);
}
