import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { DatasetJob, DatasetName, DatasetJobStatus } from "@edlight-news/types";
import { createDatasetJobSchema, type CreateDatasetJob } from "@edlight-news/types";

const COLLECTION = "dataset_jobs";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function create(data: CreateDatasetJob): Promise<DatasetJob> {
  const validated = createDatasetJobSchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as DatasetJob;
}

export async function get(id: string): Promise<DatasetJob | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as DatasetJob;
}

/** List jobs with a given status, ordered by creation time. */
export async function listByStatus(status: DatasetJobStatus): Promise<DatasetJob[]> {
  const snap = await collection()
    .where("status", "==", status)
    .orderBy("runAt")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DatasetJob);
}

/** Convenience: list all queued jobs. */
export async function listQueued(): Promise<DatasetJob[]> {
  return listByStatus("queued");
}

export async function update(id: string, data: Partial<CreateDatasetJob>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );
  await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}

export async function markProcessing(id: string): Promise<void> {
  await collection().doc(id).update({
    status: "processing",
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markDone(id: string): Promise<void> {
  await collection().doc(id).update({
    status: "done",
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markFailed(id: string, error: string): Promise<void> {
  await collection().doc(id).update({
    status: "failed",
    error,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Enqueue a refresh job for a dataset (idempotent: skip if one is already queued). */
export async function enqueue(
  dataset: DatasetName,
): Promise<{ job: DatasetJob; created: boolean }> {
  const existing = await collection()
    .where("dataset", "==", dataset)
    .where("status", "in", ["queued", "processing"])
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    return { job: { id: doc.id, ...doc.data() } as DatasetJob, created: false };
  }

  const job = await create({
    dataset,
    status: "queued",
    runAt: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 },
    attempts: 0,
  });
  return { job, created: true };
}

/** Return the most recent "done" job for a given dataset, or null. */
export async function lastDoneForDataset(dataset: DatasetName): Promise<DatasetJob | null> {
  const snap = await collection()
    .where("dataset", "==", dataset)
    .where("status", "==", "done")
    .orderBy("updatedAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as DatasetJob;
}

export async function count(): Promise<number> {
  const snap = await collection().count().get();
  return snap.data().count;
}
