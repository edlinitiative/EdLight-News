import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createHaitiCalendarEventSchema } from "@edlight-news/types";
const COLLECTION = "haiti_education_calendar";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function create(data) {
    const validated = createHaitiCalendarEventSchema.parse(data);
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
    const snap = await collection().orderBy("dateISO").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listByEventType(eventType) {
    const snap = await collection()
        .where("eventType", "==", eventType)
        .orderBy("dateISO")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listByLevel(level) {
    const snap = await collection()
        .where("level", "==", level)
        .orderBy("dateISO")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/** List events from today onward. */
export async function listUpcoming() {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const snap = await collection()
        .where("dateISO", ">=", today)
        .orderBy("dateISO")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function update(id, data) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));
    await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}
/** Upsert by title + dateISO (used for seeding). */
export async function upsertByTitle(data) {
    const validated = createHaitiCalendarEventSchema.parse(data);
    const existing = await collection()
        .where("title", "==", validated.title)
        .where("dateISO", "==", validated.dateISO)
        .limit(1)
        .get();
    if (!existing.empty) {
        const doc = existing.docs[0];
        const clean = Object.fromEntries(Object.entries(validated).filter(([, v]) => v !== undefined && v !== null));
        await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
        const snap = await doc.ref.get();
        return { event: { id: doc.id, ...snap.data() }, created: false };
    }
    const event = await create(data);
    return { event, created: true };
}
export async function count() {
    const snap = await collection().count().get();
    return snap.data().count;
}
//# sourceMappingURL=haiti-calendar.js.map