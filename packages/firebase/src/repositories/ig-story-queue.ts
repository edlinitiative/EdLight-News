import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { IGStoryQueueItem, IGStoryQueueStatus } from "@edlight-news/types";
import { createIGStoryQueueItemSchema, type CreateIGStoryQueueItem } from "@edlight-news/types";

const COLLECTION = "ig_story_queue";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function createStoryQueueItem(data: CreateIGStoryQueueItem): Promise<IGStoryQueueItem> {
  const validated = createIGStoryQueueItemSchema.parse(data);
  const clean = Object.fromEntries(
    Object.entries(validated).filter(([, v]) => v !== undefined),
  );
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...clean, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as IGStoryQueueItem;
}

export async function getByDateKey(dateKey: string): Promise<IGStoryQueueItem | null> {
  const snap = await collection()
    .where("dateKey", "==", dateKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as IGStoryQueueItem;
}

/** Return ALL story-queue items for a given Haiti dateKey (any slot). */
export async function listByDateKey(dateKey: string): Promise<IGStoryQueueItem[]> {
  const snap = await collection()
    .where("dateKey", "==", dateKey)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IGStoryQueueItem);
}

/**
 * Count story-queue items for a given dateKey, optionally filtered by status.
 * Used by `scheduleIgStoryFrames` to enforce the cold-start daily cap.
 */
export async function countByDateKey(
  dateKey: string,
  statuses?: readonly IGStoryQueueStatus[],
): Promise<number> {
  let query = collection().where("dateKey", "==", dateKey);
  if (statuses && statuses.length > 0) {
    query = query.where("status", "in", statuses as IGStoryQueueStatus[]);
  }
  const snap = await query.count().get();
  return snap.data().count;
}

/**
 * True iff a story-queue item already exists for (dateKey, slot).
 * Used to make slot-fill jobs idempotent across ticks.
 */
export async function existsForSlot(
  dateKey: string,
  slot: NonNullable<IGStoryQueueItem["slot"]>,
): Promise<boolean> {
  const snap = await collection()
    .where("dateKey", "==", dateKey)
    .where("slot", "==", slot)
    .limit(1)
    .get();
  return !snap.empty;
}

export async function listByStatus(
  status: IGStoryQueueStatus,
  limit = 10,
): Promise<IGStoryQueueItem[]> {
  const snap = await collection()
    .where("status", "==", status)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as IGStoryQueueItem);
}

export async function updateStatus(
  id: string,
  status: IGStoryQueueStatus,
  extra?: Partial<Pick<IGStoryQueueItem, "igMediaId" | "error">>,
): Promise<void> {
  await collection().doc(id).update({
    status,
    ...extra,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
