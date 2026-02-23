import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import { createContributorProfileSchema } from "@edlight-news/types";
const COLLECTION = "contributor_profiles";
function collection() {
    return getDb().collection(COLLECTION);
}
export async function create(data) {
    const validated = createContributorProfileSchema.parse(data);
    const ref = collection().doc();
    const now = FieldValue.serverTimestamp();
    await ref.set({ ...validated, createdAt: now, updatedAt: now });
    const snap = await ref.get();
    return { id: ref.id, ...snap.data() };
}
export async function get(id) {
    const snap = await collection().doc(id).get();
    if (!snap.exists)
        return null;
    return { id: snap.id, ...snap.data() };
}
export async function getByEmail(email) {
    const snap = await collection().where("email", "==", email).limit(1).get();
    if (snap.empty)
        return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() };
}
export async function listAll() {
    const snap = await collection().orderBy("displayName").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listVerified() {
    const snap = await collection()
        .where("verified", "==", true)
        .orderBy("displayName")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function listByRole(role) {
    const snap = await collection()
        .where("role", "==", role)
        .orderBy("displayName")
        .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function update(id, data) {
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}
export async function count() {
    const snap = await collection().count().get();
    return snap.data().count;
}
//# sourceMappingURL=contributor-profiles.js.map