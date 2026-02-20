import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { Source } from "@edlight-news/types";
import { createSourceSchema, type CreateSource } from "@edlight-news/types";

const COLLECTION = "sources";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function createSource(data: CreateSource): Promise<Source> {
  const validated = createSourceSchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as Source;
}

export async function getSource(id: string): Promise<Source | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Source;
}

/**
 * Returns all sources where active == true.
 * This is the primary query for the worker tick.
 */
export async function getEnabledSources(): Promise<Source[]> {
  const snap = await collection().where("active", "==", true).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Source);
}

/** Alias kept for backwards-compat */
export const listActiveSources = getEnabledSources;

export async function updateSource(
  id: string,
  data: Partial<CreateSource>,
): Promise<void> {
  await collection()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteSource(id: string): Promise<void> {
  await collection().doc(id).delete();
}
