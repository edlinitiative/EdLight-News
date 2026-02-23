import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { Pathway, PathwayGoalKey, DatasetCountry } from "@edlight-news/types";
import { createPathwaySchema, type CreatePathway } from "@edlight-news/types";

const COLLECTION = "pathways";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function create(data: CreatePathway): Promise<Pathway> {
  const validated = createPathwaySchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as Pathway;
}

export async function get(id: string): Promise<Pathway | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Pathway;
}

export async function listAll(): Promise<Pathway[]> {
  const snap = await collection().orderBy("title_fr").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pathway);
}

export async function listByGoalKey(goalKey: PathwayGoalKey): Promise<Pathway[]> {
  const snap = await collection()
    .where("goalKey", "==", goalKey)
    .orderBy("title_fr")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pathway);
}

export async function listByCountry(country: DatasetCountry): Promise<Pathway[]> {
  const snap = await collection()
    .where("country", "==", country)
    .orderBy("title_fr")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Pathway);
}

export async function update(id: string, data: Partial<CreatePathway>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );
  await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}

/** Upsert by goalKey + country (used for seeding). */
export async function upsertByGoalKey(
  data: CreatePathway,
): Promise<{ pathway: Pathway; created: boolean }> {
  const validated = createPathwaySchema.parse(data);
  const q = collection().where("goalKey", "==", validated.goalKey);
  const snap = validated.country
    ? await q.where("country", "==", validated.country).limit(1).get()
    : await q.limit(1).get();

  if (!snap.empty) {
    const doc = snap.docs[0]!;
    const clean = Object.fromEntries(
      Object.entries(validated).filter(([, v]) => v !== undefined),
    );
    await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
    const refreshed = await doc.ref.get();
    return { pathway: { id: doc.id, ...refreshed.data() } as Pathway, created: false };
  }

  const pathway = await create(data);
  return { pathway, created: true };
}

export async function count(): Promise<number> {
  const snap = await collection().count().get();
  return snap.data().count;
}
