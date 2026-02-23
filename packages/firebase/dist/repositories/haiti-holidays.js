import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createHaitiHolidaySchema } from "@edlight-news/types";
const COLLECTION = "haiti_holidays";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function create(data) {
    const validated = createHaitiHolidaySchema.parse(data);
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
/** Get holidays for a specific day (MM-DD). */
export async function listByMonthDay(monthDay) {
    const snap = await collection()
        .where("monthDay", "==", monthDay)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/** Upsert by monthDay + name_fr (idempotent seeding). */
export async function upsertByName(data) {
    const validated = createHaitiHolidaySchema.parse(data);
    const existing = await collection()
        .where("monthDay", "==", validated.monthDay)
        .where("name_fr", "==", validated.name_fr)
        .limit(1)
        .get();
    if (!existing.empty) {
        const doc = existing.docs[0];
        const clean = Object.fromEntries(Object.entries(validated).filter(([, v]) => v !== undefined && v !== null));
        await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
        const updated = await doc.ref.get();
        return { holiday: { id: doc.id, ...updated.data() }, created: false };
    }
    const holiday = await create(validated);
    return { holiday, created: true };
}
export async function update(id, data) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));
    await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}
//# sourceMappingURL=haiti-holidays.js.map