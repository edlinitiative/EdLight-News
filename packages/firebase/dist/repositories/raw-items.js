import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createRawItemSchema } from "@edlight-news/types";
const COLLECTION = "raw_items";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function createRawItem(data) {
    const validated = createRawItemSchema.parse(data);
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...validated, createdAt: now });
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
export async function getRawItem(id) {
    const snap = await collection().doc(id).get();
    if (!snap.exists)
        return null;
    return { id: snap.id, ...snap.data() };
}
export async function findByHash(hash) {
    const snap = await collection().where("hash", "==", hash).limit(1).get();
    if (snap.empty)
        return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
}
/**
 * Insert a raw_item only if no existing doc has the same hash.
 * Returns { created: true, item } or { created: false } for dupes.
 */
export async function addRawItemIfNew(data) {
    const existing = await findByHash(data.hash);
    if (existing)
        return { created: false };
    const item = await createRawItem(data);
    return { created: true, item };
}
/**
 * Returns raw_items with status="new" ordered by createdAt, limited.
 */
export async function getNewRawItems(limit = 20) {
    const snap = await collection()
        .where("status", "==", "new")
        .orderBy("createdAt", "asc")
        .limit(limit)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/** Alias for backwards-compat */
export const listNewRawItems = getNewRawItems;
export async function markProcessed(id) {
    await collection().doc(id).update({ status: "processed" });
}
export async function markSkipped(id, reason) {
    await collection().doc(id).update({ status: "skipped", skipReason: reason });
}
/** Generic status update */
export async function updateRawItemStatus(id, status) {
    await collection().doc(id).update({ status });
}
//# sourceMappingURL=raw-items.js.map