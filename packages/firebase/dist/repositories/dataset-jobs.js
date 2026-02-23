import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createDatasetJobSchema } from "@edlight-news/types";
const COLLECTION = "dataset_jobs";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function create(data) {
    const validated = createDatasetJobSchema.parse(data);
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...validated, createdAt: now, updatedAt: now });
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
export async function get(id) {
    const snap = await collection().doc(id).get();
    if (!snap.exists)
        return null;
    return { id: snap.id, ...snap.data() };
}
/** List jobs with a given status, ordered by creation time. */
export async function listByStatus(status) {
    const snap = await collection()
        .where("status", "==", status)
        .orderBy("runAt")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/** Convenience: list all queued jobs. */
export async function listQueued() {
    return listByStatus("queued");
}
export async function update(id, data) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));
    await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}
export async function markProcessing(id) {
    await collection().doc(id).update({
        status: "processing",
        updatedAt: FieldValue.serverTimestamp(),
    });
}
export async function markDone(id) {
    await collection().doc(id).update({
        status: "done",
        updatedAt: FieldValue.serverTimestamp(),
    });
}
export async function markFailed(id, error) {
    await collection().doc(id).update({
        status: "failed",
        lastError: error,
        updatedAt: FieldValue.serverTimestamp(),
    });
}
/** Enqueue a refresh job for a dataset (idempotent: skip if one is already queued). */
export async function enqueue(dataset) {
    const existing = await collection()
        .where("dataset", "==", dataset)
        .where("status", "in", ["queued", "processing"])
        .limit(1)
        .get();
    if (!existing.empty) {
        const doc = existing.docs[0];
        return { job: { id: doc.id, ...doc.data() }, created: false };
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
export async function lastDoneForDataset(dataset) {
    const snap = await collection()
        .where("dataset", "==", dataset)
        .where("status", "==", "done")
        .orderBy("updatedAt", "desc")
        .limit(1)
        .get();
    if (snap.empty)
        return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
}
export async function count() {
    const snap = await collection().count().get();
    return snap.data().count;
}
//# sourceMappingURL=dataset-jobs.js.map