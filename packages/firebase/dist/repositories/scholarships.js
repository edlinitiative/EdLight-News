import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createScholarshipSchema } from "@edlight-news/types";
const COLLECTION = "scholarships";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function create(data) {
    const validated = createScholarshipSchema.parse(data);
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
/** List scholarships with deadlines within the next N days. */
export async function listClosingSoon(days) {
    const all = await listAll();
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return all.filter((s) => {
        if (!s.deadline?.dateISO)
            return false;
        const d = new Date(s.deadline.dateISO);
        return d >= now && d <= cutoff;
    }).sort((a, b) => {
        const dA = a.deadline?.dateISO ?? "";
        const dB = b.deadline?.dateISO ?? "";
        return dA.localeCompare(dB);
    });
}
/** List scholarships where HT is in eligibleCountries. */
export async function listEligibleForHaiti() {
    const all = await listAll();
    return all.filter((s) => s.eligibleCountries?.includes("HT") ||
        s.country === "Global" ||
        s.country === "HT");
}
export async function update(id, data) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}
/** Upsert by name (used for seeding). */
export async function upsertByName(data) {
    const validated = createScholarshipSchema.parse(data);
    const existing = await collection()
        .where("name", "==", validated.name)
        .limit(1)
        .get();
    if (!existing.empty) {
        const doc = existing.docs[0];
        const clean = Object.fromEntries(Object.entries(validated).filter(([, v]) => v !== undefined));
        await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
        const snap = await doc.ref.get();
        return { scholarship: { id: doc.id, ...snap.data() }, created: false };
    }
    const scholarship = await create(data);
    return { scholarship, created: true };
}
export async function count() {
    const snap = await collection().count().get();
    return snap.data().count;
}
//# sourceMappingURL=scholarships.js.map