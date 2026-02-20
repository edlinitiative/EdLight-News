import { getDb } from "../admin.js";
import { createMetricSchema } from "@edlight-news/types";
const COLLECTION = "metrics";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function createMetric(data) {
    const validated = createMetricSchema.parse(data);
    const ref = collection().doc();
    await ref.set(validated);
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
export async function listByContentVersion(contentVersionId) {
    const snap = await collection()
        .where("contentVersionId", "==", contentVersionId)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function updateMetric(id, data) {
    await collection().doc(id).update(data);
}
//# sourceMappingURL=metrics.js.map