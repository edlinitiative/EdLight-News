import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createDraftSchema } from "@edlight-news/types";
const COLLECTION = "drafts";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function create(data) {
    const validated = createDraftSchema.parse(data);
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
export async function listAll() {
    const snap = await collection().orderBy("updatedAt", "desc").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listByStatus(status) {
    const snap = await collection()
        .where("status", "==", status)
        .orderBy("updatedAt", "desc")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listByAuthor(authorId) {
    const snap = await collection()
        .where("authorId", "==", authorId)
        .orderBy("updatedAt", "desc")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function update(id, data) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}
export async function updateStatus(id, status) {
    await collection().doc(id).update({
        status,
        updatedAt: FieldValue.serverTimestamp(),
    });
}
export async function count() {
    const snap = await collection().count().get();
    return snap.data().count;
}
//# sourceMappingURL=drafts.js.map