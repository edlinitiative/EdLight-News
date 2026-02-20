import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { Asset } from "@edlight-news/types";
import { createAssetSchema, type CreateAsset } from "@edlight-news/types";

const COLLECTION = "assets";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function createAsset(data: CreateAsset): Promise<Asset> {
  const validated = createAssetSchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, createdAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as Asset;
}

export async function getAsset(id: string): Promise<Asset | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Asset;
}

export async function listByContentVersion(
  contentVersionId: string,
): Promise<Asset[]> {
  const snap = await collection()
    .where("contentVersionId", "==", contentVersionId)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Asset);
}

export async function deleteAsset(id: string): Promise<void> {
  await collection().doc(id).delete();
}
