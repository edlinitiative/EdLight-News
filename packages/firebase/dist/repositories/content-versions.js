import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createContentVersionSchema, } from "@edlight-news/types";
const COLLECTION = "content_versions";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function createContentVersion(data) {
    const validated = createContentVersionSchema.parse(data);
    // Strip undefined values — Firestore rejects them
    const clean = Object.fromEntries(Object.entries(validated).filter(([, v]) => v !== undefined));
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...clean, createdAt: now, updatedAt: now });
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
/**
 * Batch-create multiple draft content_versions for a single item.
 * Used after LLM generation to write FR + HT versions at once.
 */
export async function createDraftVersionsForItem(itemId, versions) {
    const results = [];
    for (const v of versions) {
        const cv = await createContentVersion({ ...v, itemId });
        results.push(cv);
    }
    return results;
}
export async function getContentVersion(id) {
    const snap = await collection().doc(id).get();
    if (!snap.exists)
        return null;
    return { id: snap.id, ...snap.data() };
}
/**
 * List web content_versions (draft + published) for the news feed.
 */
export async function listWebVersions(language, limit = 50) {
    const snap = await collection()
        .where("channel", "==", "web")
        .where("language", "==", language)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listPublishedForWeb(language, limit = 50) {
    const snap = await collection()
        .where("channel", "==", "web")
        .where("status", "==", "published")
        .where("language", "==", language)
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listByItemId(itemId) {
    const snap = await collection().where("itemId", "==", itemId).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/**
 * Check whether an item already has web content_versions.
 */
export async function hasWebVersions(itemId) {
    const snap = await collection()
        .where("itemId", "==", itemId)
        .where("channel", "==", "web")
        .limit(1)
        .get();
    return !snap.empty;
}
export async function updateContentVersionStatus(id, status) {
    await collection()
        .doc(id)
        .update({ status, updatedAt: FieldValue.serverTimestamp() });
}
/**
 * Bulk-publish all draft content_versions that have passed quality gates
 * (no draftReason set). Called as a cleanup sweep after generate.
 */
export async function publishEligibleDrafts() {
    const snap = await collection()
        .where("status", "==", "draft")
        .get();
    const eligible = snap.docs.filter((d) => !d.data().draftReason);
    if (eligible.length === 0)
        return 0;
    const chunks = [];
    for (let i = 0; i < eligible.length; i += 400) {
        chunks.push(eligible.slice(i, i + 400));
    }
    for (const chunk of chunks) {
        const batch = getDb().batch();
        for (const doc of chunk) {
            batch.update(doc.ref, {
                status: "published",
                updatedAt: FieldValue.serverTimestamp(),
            });
        }
        await batch.commit();
    }
    return eligible.length;
}
//# sourceMappingURL=content-versions.js.map