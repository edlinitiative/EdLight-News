import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createAssetSchema } from "@edlight-news/types";
const COLLECTION = "assets";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function createAsset(data) {
    const validated = createAssetSchema.parse(data);
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...validated, createdAt: now });
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
export async function getAsset(id) {
    const snap = await collection().doc(id).get();
    if (!snap.exists)
        return null;
    return { id: snap.id, ...snap.data() };
}
export async function listByContentVersion(contentVersionId) {
    const snap = await collection()
        .where("contentVersionId", "==", contentVersionId)
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function deleteAsset(id) {
    await collection().doc(id).delete();
}
//# sourceMappingURL=assets.js.map