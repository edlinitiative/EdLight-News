/**
 * Firestore repository for haiti_history_almanac_raw.
 *
 * Stores structured FACTS only — no LLM-generated narrative.
 * Each record represents a single historical event with verified sources.
 */
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createHaitiHistoryAlmanacRawSchema, } from "@edlight-news/types";
const COLLECTION = "haiti_history_almanac_raw";
function collection() {
    return getDb().collection(COLLECTION);
}
// ── Create ──────────────────────────────────────────────────────────────────
export async function create(data) {
    const validated = createHaitiHistoryAlmanacRawSchema.parse(data);
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...validated, createdAt: now });
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
// ── Read ────────────────────────────────────────────────────────────────────
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
/** List verified entries for a specific day (MM-DD). */
export async function listVerifiedByMonthDay(monthDay) {
    const snap = await collection()
        .where("monthDay", "==", monthDay)
        .where("verificationStatus", "==", "verified")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/** List entries for a specific month (MM). */
export async function listByMonth(month) {
    const startDay = `${month}-01`;
    const endDay = `${month}-32`;
    const snap = await collection()
        .where("monthDay", ">=", startDay)
        .where("monthDay", "<=", endDay)
        .orderBy("monthDay")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
/** List all unverified entries. */
export async function listUnverified() {
    const snap = await collection()
        .where("verificationStatus", "==", "unverified")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
// ── Update ──────────────────────────────────────────────────────────────────
export async function update(id, data) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));
    await collection().doc(id).update(clean);
}
export async function markVerified(id) {
    await collection().doc(id).update({ verificationStatus: "verified" });
}
export async function markUnverified(id) {
    await collection().doc(id).update({ verificationStatus: "unverified" });
}
// ── Upsert ──────────────────────────────────────────────────────────────────
/** Upsert by monthDay + year + title (idempotent seeding). */
export async function upsertByKey(data) {
    const validated = createHaitiHistoryAlmanacRawSchema.parse(data);
    const existing = await collection()
        .where("monthDay", "==", validated.monthDay)
        .where("year", "==", validated.year)
        .where("title", "==", validated.title)
        .limit(1)
        .get();
    if (!existing.empty) {
        const doc = existing.docs[0];
        const clean = Object.fromEntries(Object.entries(validated).filter(([, v]) => v !== undefined && v !== null));
        await doc.ref.update(clean);
        const updated = await doc.ref.get();
        return {
            entry: { id: doc.id, ...updated.data() },
            created: false,
        };
    }
    const entry = await create(validated);
    return { entry, created: true };
}
// ── Delete ──────────────────────────────────────────────────────────────────
export async function remove(id) {
    await collection().doc(id).delete();
}
// ── Stats ───────────────────────────────────────────────────────────────────
/** Get total count of entries. */
export async function count() {
    const snap = await collection().count().get();
    return snap.data().count;
}
//# sourceMappingURL=haiti-history-almanac-raw.js.map