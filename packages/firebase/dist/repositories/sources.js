import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createSourceSchema } from "@edlight-news/types";
const COLLECTION = "sources";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function createSource(data) {
    const validated = createSourceSchema.parse(data);
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...validated, createdAt: now, updatedAt: now });
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
export async function getSource(id) {
    const snap = await collection().doc(id).get();
    if (!snap.exists)
        return null;
    return { id: snap.id, ...snap.data() };
}
/**
 * Returns all sources where active == true.
 * This is the primary query for the worker tick.
 */
export async function getEnabledSources() {
    const snap = await collection().where("active", "==", true).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/** Alias kept for backwards-compat */
export const listActiveSources = getEnabledSources;
export async function updateSource(id, data) {
    await collection()
        .doc(id)
        .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}
export async function deleteSource(id) {
    await collection().doc(id).delete();
}
//# sourceMappingURL=sources.js.map