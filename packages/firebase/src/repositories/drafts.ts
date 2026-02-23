import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { Draft, DraftStatus } from "@edlight-news/types";
import { createDraftSchema, type CreateDraft } from "@edlight-news/types";

const COLLECTION = "drafts";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function create(data: CreateDraft): Promise<Draft> {
  const validated = createDraftSchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as Draft;
}

export async function get(id: string): Promise<Draft | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Draft;
}

export async function listAll(): Promise<Draft[]> {
  const snap = await collection().orderBy("updatedAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Draft);
}

export async function listByStatus(status: DraftStatus): Promise<Draft[]> {
  const snap = await collection()
    .where("status", "==", status)
    .orderBy("updatedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Draft);
}

export async function listByAuthor(authorId: string): Promise<Draft[]> {
  const snap = await collection()
    .where("authorId", "==", authorId)
    .orderBy("updatedAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Draft);
}

export async function update(id: string, data: Partial<CreateDraft>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );
  await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}

export async function updateStatus(id: string, status: DraftStatus): Promise<void> {
  await collection().doc(id).update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function count(): Promise<number> {
  const snap = await collection().count().get();
  return snap.data().count;
}
