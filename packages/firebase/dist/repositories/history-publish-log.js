import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
const COLLECTION = "history_publish_log";
function collection() {
    return getDb().collection(COLLECTION);
}
/** Get the log entry for a specific date (YYYY-MM-DD). */
export async function getByDate(dateISO) {
    const snap = await collection().doc(dateISO).get();
    if (!snap.exists)
        return null;
    return { id: snap.id, ...snap.data() };
}
/** Create or update the log entry for today. */
export async function upsert(data) {
    const ref = collection().doc(data.dateISO);
    await ref.set({
        ...data,
        createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    const snap = await ref.get();
    return { id: snap.id, ...snap.data() };
}
/** List recent publish log entries. */
export async function listRecent(limit = 30) {
    const snap = await collection()
        .orderBy("dateISO", "desc")
        .limit(limit)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
//# sourceMappingURL=history-publish-log.js.map