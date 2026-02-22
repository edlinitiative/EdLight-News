import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
const COLLECTION = "utility_queue";
function collection() {
    return getDb().collection(COLLECTION);
}
/** Enqueue a new utility generation job. */
export async function enqueueJob(input) {
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    const runAt = input.runAt ? Timestamp.fromDate(input.runAt) : Timestamp.now();
    const data = {
        status: "queued",
        series: input.series,
        ...(input.rotationKey ? { rotationKey: input.rotationKey } : {}),
        langTargets: input.langTargets,
        sourceIds: input.sourceIds,
        runAt,
        attempts: 0,
        createdAt: now,
        updatedAt: now,
    };
    await ref.set(data);
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
/** List queued jobs ready to process (status="queued", runAt <= now). */
export async function listQueuedJobs(limit) {
    const now = Timestamp.now();
    // Single-field query to avoid composite index requirement.
    // Filter runAt <= now and sort client-side.
    const snap = await collection()
        .where("status", "==", "queued")
        .get();
    return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((e) => {
        const runAt = e.runAt instanceof Timestamp ? e.runAt : Timestamp.fromDate(new Date(e.runAt));
        return runAt.toMillis() <= now.toMillis();
    })
        .sort((a, b) => {
        const aT = a.runAt instanceof Timestamp ? a.runAt.toMillis() : new Date(a.runAt).getTime();
        const bT = b.runAt instanceof Timestamp ? b.runAt.toMillis() : new Date(b.runAt).getTime();
        return aT - bT;
    })
        .slice(0, limit);
}
/** Mark a job as processing. */
export async function markProcessing(id) {
    await collection().doc(id).update({
        status: "processing",
        attempts: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
    });
}
/** Mark a job as done. */
export async function markDone(id) {
    await collection().doc(id).update({
        status: "done",
        updatedAt: FieldValue.serverTimestamp(),
    });
}
/** Mark a job as failed with reasons. */
export async function markFailed(id, reasons, lastError) {
    await collection().doc(id).update({
        status: "failed",
        failReasons: reasons,
        ...(lastError ? { lastError } : {}),
        updatedAt: FieldValue.serverTimestamp(),
    });
}
/** Count utility items (itemType="utility") created in the last N hours.
 *  Uses the items collection, not the queue. */
export async function countRecentUtilityItems(hoursAgo) {
    const since = new Date();
    since.setHours(since.getHours() - hoursAgo);
    const sinceTimestamp = Timestamp.fromDate(since);
    // Single-field query to avoid composite index requirement.
    // Filter by createdAt client-side.
    const snap = await getDb()
        .collection("items")
        .where("itemType", "==", "utility")
        .get();
    return snap.docs.filter((d) => {
        const created = d.data().createdAt;
        if (!created)
            return false;
        const ts = created instanceof Timestamp ? created : Timestamp.fromDate(new Date(created));
        return ts.toMillis() >= sinceTimestamp.toMillis();
    }).length;
}
//# sourceMappingURL=utility-queue.js.map