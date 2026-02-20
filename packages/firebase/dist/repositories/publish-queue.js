import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createPublishQueueEntrySchema, } from "@edlight-news/types";
const COLLECTION = "publish_queue";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function createPublishQueueEntry(data) {
    const validated = createPublishQueueEntrySchema.parse(data);
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...validated, createdAt: now });
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
export async function getPublishQueueEntry(id) {
    const snap = await collection().doc(id).get();
    if (!snap.exists)
        return null;
    return { id: snap.id, ...snap.data() };
}
export async function listPending(limit = 10) {
    const snap = await collection()
        .where("status", "==", "pending")
        .orderBy("scheduledAt", "asc")
        .limit(limit)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function updatePublishStatus(id, status, extra) {
    await collection()
        .doc(id)
        .update({ status, ...extra });
}
export async function incrementAttemptCount(id) {
    await collection()
        .doc(id)
        .update({ attemptCount: FieldValue.increment(1) });
}
//# sourceMappingURL=publish-queue.js.map