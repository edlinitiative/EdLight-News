import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { PublishQueueEntry, PublishStatus } from "@edlight-news/types";
import {
  createPublishQueueEntrySchema,
  type CreatePublishQueueEntry,
} from "@edlight-news/types";

const COLLECTION = "publish_queue";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function createPublishQueueEntry(
  data: CreatePublishQueueEntry,
): Promise<PublishQueueEntry> {
  const validated = createPublishQueueEntrySchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, createdAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as PublishQueueEntry;
}

export async function getPublishQueueEntry(
  id: string,
): Promise<PublishQueueEntry | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as PublishQueueEntry;
}

export async function listPending(limit = 10): Promise<PublishQueueEntry[]> {
  const snap = await collection()
    .where("status", "==", "pending" satisfies PublishStatus)
    .orderBy("scheduledAt", "asc")
    .limit(limit)
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as PublishQueueEntry,
  );
}

export async function updatePublishStatus(
  id: string,
  status: PublishStatus,
  extra?: { lastError?: string; completedAt?: FieldValue },
): Promise<void> {
  await collection()
    .doc(id)
    .update({ status, ...extra });
}

export async function incrementAttemptCount(id: string): Promise<void> {
  await collection()
    .doc(id)
    .update({ attemptCount: FieldValue.increment(1) });
}
