import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createHaitiHistoryAlmanacEntrySchema } from "@edlight-news/types";
const COLLECTION = "haiti_history_almanac";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function create(data) {
    const validated = createHaitiHistoryAlmanacEntrySchema.parse(data);
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
    const snap = await collection().orderBy("monthDay").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/** List entries for a specific day (MM-DD). */
export async function listByMonthDay(monthDay) {
    const snap = await collection()
        .where("monthDay", "==", monthDay)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/** List entries for a specific month (MM). */
export async function listByMonth(month) {
    const startDay = `${month}-01`;
    const endDay = `${month}-32`; // lexicographic trick: 32 > any valid day
    const snap = await collection()
        .where("monthDay", ">=", startDay)
        .where("monthDay", "<=", endDay)
        .orderBy("monthDay")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/** Upsert by monthDay + title_fr (idempotent seeding). */
export async function upsertByTitle(data) {
    const validated = createHaitiHistoryAlmanacEntrySchema.parse(data);
    const existing = await collection()
        .where("monthDay", "==", validated.monthDay)
        .where("title_fr", "==", validated.title_fr)
        .limit(1)
        .get();
    if (!existing.empty) {
        const doc = existing.docs[0];
        const clean = Object.fromEntries(Object.entries(validated).filter(([, v]) => v !== undefined && v !== null));
        await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
        const updated = await doc.ref.get();
        return { entry: { id: doc.id, ...updated.data() }, created: false };
    }
    const entry = await create(validated);
    return { entry, created: true };
}
export async function update(id, data) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));
    await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}
//# sourceMappingURL=haiti-history-almanac.js.map