import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { HistoryPublishLog, HistoryPublishStatus } from "@edlight-news/types";

const COLLECTION = "history_publish_log";

function collection() {
  return getDb().collection(COLLECTION);
}

/** Get the log entry for a specific date (YYYY-MM-DD). */
export async function getByDate(dateISO: string): Promise<HistoryPublishLog | null> {
  const snap = await collection().doc(dateISO).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as HistoryPublishLog;
}

/** Create or update the log entry for today. */
export async function upsert(data: {
  dateISO: string;
  publishedItemId?: string;
  almanacEntryIds: string[];
  holidayId?: string;
  status: HistoryPublishStatus;
  error?: string;
}): Promise<HistoryPublishLog> {
  const ref = collection().doc(data.dateISO);
  await ref.set(
    {
      ...data,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  const snap = await ref.get();
  return { id: snap.id, ...snap.data() } as HistoryPublishLog;
}

/** List recent publish log entries. */
export async function listRecent(limit = 30): Promise<HistoryPublishLog[]> {
  const snap = await collection()
    .orderBy("dateISO", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HistoryPublishLog);
}
