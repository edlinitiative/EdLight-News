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
