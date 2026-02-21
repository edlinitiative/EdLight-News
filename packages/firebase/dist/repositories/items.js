import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createItemSchema } from "@edlight-news/types";
const COLLECTION = "items";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function createItem(data) {
    const validated = createItemSchema.parse(data);
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...validated, createdAt: now, updatedAt: now });
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
export async function getItem(id) {
    const snap = await collection().doc(id).get();
    if (!snap.exists)
        return null;
    return { id: snap.id, ...snap.data() };
}
export async function findByCanonicalUrl(canonicalUrl) {
    const snap = await collection()
        .where("canonicalUrl", "==", canonicalUrl)
        .limit(1)
        .get();
    if (snap.empty)
        return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
}
/**
 * Insert or update an item keyed by canonicalUrl.
 * If an item with the same canonicalUrl exists, it is updated.
 * Returns the upserted Item and whether it was newly created.
 */
export async function upsertItemByCanonicalUrl(data) {
    const validated = createItemSchema.parse(data);
    const existing = await findByCanonicalUrl(validated.canonicalUrl);
    if (existing) {
        const now = FieldValue.serverTimestamp();
        await collection()
            .doc(existing.id)
            .update({ ...validated, updatedAt: now });
        const snap = await collection().doc(existing.id).get();
        return { item: { id: existing.id, ...snap.data() }, created: false };
    }
    const item = await createItem(data);
    return { item, created: true };
}
/**
 * List items that do NOT yet have content_versions.
 * Used by the generate step to find items needing content generation.
 */
export async function listItemsByCategory(category) {
    const snap = await collection().where("category", "==", category).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listRecentItems(limit = 50) {
    const snap = await collection()
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function updateItem(id, data) {
    // Strip undefined values — Firestore rejects them
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await collection()
        .doc(id)
        .update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}
/** Get a single item by its dedupeGroupId (newest first). */
export async function listByDedupeGroupId(dedupeGroupId, limit = 10) {
    const snap = await collection()
        .where("dedupeGroupId", "==", dedupeGroupId)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function deleteItem(id) {
    await collection().doc(id).delete();
}
//# sourceMappingURL=items.js.map