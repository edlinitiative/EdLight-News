import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createUniversitySchema } from "@edlight-news/types";
const COLLECTION = "universities";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function create(data) {
    const validated = createUniversitySchema.parse(data);
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...validated, verifiedAt: now, updatedAt: now });
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
    const snap = await collection().orderBy("name").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listByCountry(country) {
    const snap = await collection().where("country", "==", country).orderBy("name").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function update(id, data) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));
    await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}
/** Upsert by name + country (used for seeding). */
export async function upsertByName(data) {
    const validated = createUniversitySchema.parse(data);
    const existing = await collection()
        .where("name", "==", validated.name)
        .where("country", "==", validated.country)
        .limit(1)
        .get();
    if (!existing.empty) {
        const doc = existing.docs[0];
        const clean = Object.fromEntries(Object.entries(validated).filter(([, v]) => v !== undefined && v !== null));
        await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
        const snap = await doc.ref.get();
        return { university: { id: doc.id, ...snap.data() }, created: false };
    }
    const university = await create(data);
    return { university, created: true };
}
export async function count() {
    const snap = await collection().count().get();
    return snap.data().count;
}
export async function countByCountry(country) {
    const snap = await collection().where("country", "==", country).count().get();
    return snap.data().count;
}
//# sourceMappingURL=universities.js.map