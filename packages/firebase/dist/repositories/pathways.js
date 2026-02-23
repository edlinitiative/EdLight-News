import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createPathwaySchema } from "@edlight-news/types";
const COLLECTION = "pathways";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function create(data) {
    const validated = createPathwaySchema.parse(data);
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...validated, updatedAt: now });
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
    const snap = await collection().orderBy("title_fr").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listByGoalKey(goalKey) {
    const snap = await collection()
        .where("goalKey", "==", goalKey)
        .orderBy("title_fr")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listByCountry(country) {
    const snap = await collection()
        .where("country", "==", country)
        .orderBy("title_fr")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function update(id, data) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}
/** Upsert by goalKey + country (used for seeding). */
export async function upsertByGoalKey(data) {
    const validated = createPathwaySchema.parse(data);
    const q = collection().where("goalKey", "==", validated.goalKey);
    const snap = validated.country
        ? await q.where("country", "==", validated.country).limit(1).get()
        : await q.limit(1).get();
    if (!snap.empty) {
        const doc = snap.docs[0];
        const clean = Object.fromEntries(Object.entries(validated).filter(([, v]) => v !== undefined));
        await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
        const refreshed = await doc.ref.get();
        return { pathway: { id: doc.id, ...refreshed.data() }, created: false };
    }
    const pathway = await create(data);
    return { pathway, created: true };
}
export async function count() {
    const snap = await collection().count().get();
    return snap.data().count;
}
//# sourceMappingURL=pathways.js.map