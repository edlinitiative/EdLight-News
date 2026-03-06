import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createIGStoryQueueItemSchema } from "@edlight-news/types";
const COLLECTION = "ig_story_queue";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function createStoryQueueItem(data) {
    const validated = createIGStoryQueueItemSchema.parse(data);
    const clean = Object.fromEntries(Object.entries(validated).filter(([, v]) => v !== undefined));
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...clean, createdAt: now, updatedAt: now });
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
export async function getByDateKey(dateKey) {
    const snap = await collection()
        .where("dateKey", "==", dateKey)
        .limit(1)
        .get();
    if (snap.empty)
        return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
}
export async function listByStatus(status, limit = 10) {
    const snap = await collection()
        .where("status", "==", status)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function updateStatus(id, status, extra) {
    await collection().doc(id).update({
        status,
        ...extra,
        updatedAt: FieldValue.serverTimestamp(),
    });
}
//# sourceMappingURL=ig-story-queue.js.map