import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { UtilitySource, UtilitySeries } from "@edlight-news/types";
import { createUtilitySourceSchema, type CreateUtilitySource } from "@edlight-news/types";

const COLLECTION = "utility_sources";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function createUtilitySource(data: CreateUtilitySource): Promise<UtilitySource> {
  const validated = createUtilitySourceSchema.parse(data);
  const clean = Object.fromEntries(
    Object.entries(validated).filter(([, v]) => v !== undefined),
  );
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...clean, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as UtilitySource;
}

export async function getUtilitySource(id: string): Promise<UtilitySource | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as UtilitySource;
}

/** List all active utility sources. */
export async function listActive(): Promise<UtilitySource[]> {
  const snap = await collection().where("active", "==", true).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as UtilitySource);
}

/** List active utility sources matching a specific utilityType. */
/** List active sources for a given series. */
export async function listBySeries(series: UtilitySeries): Promise<UtilitySource[]> {
  const snap = await collection()
    .where("active", "==", true)
    .where("series", "==", series)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as UtilitySource)
    .sort((a, b) => (b.priority ?? 50) - (a.priority ?? 50));
}

/** List active sources for a given series + rotation key. */
export async function listBySeriesAndRotation(
  series: UtilitySeries,
  rotationKey: string,
): Promise<UtilitySource[]> {
  const all = await listBySeries(series);
  return all.filter(
    (s) => !s.rotationKey || s.rotationKey === rotationKey,
  );
}

/** Upsert a utility source by URL. Used for seeding. */
export async function upsertByUrl(data: CreateUtilitySource): Promise<{ source: UtilitySource; created: boolean }> {
  const validated = createUtilitySourceSchema.parse(data);
  const existing = await collection().where("url", "==", validated.url).limit(1).get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    const clean = Object.fromEntries(
      Object.entries(validated).filter(([, v]) => v !== undefined),
    );
    await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
    const snap = await doc.ref.get();
    return { source: { id: doc.id, ...snap.data() } as UtilitySource, created: false };
  }

  const source = await createUtilitySource(data);
  return { source, created: true };
}
