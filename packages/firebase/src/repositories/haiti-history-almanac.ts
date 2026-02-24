import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { HaitiHistoryAlmanacEntry } from "@edlight-news/types";
import { createHaitiHistoryAlmanacEntrySchema, type CreateHaitiHistoryAlmanacEntry } from "@edlight-news/types";

const COLLECTION = "haiti_history_almanac";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function create(data: CreateHaitiHistoryAlmanacEntry): Promise<HaitiHistoryAlmanacEntry> {
  const validated = createHaitiHistoryAlmanacEntrySchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, verifiedAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as HaitiHistoryAlmanacEntry;
}

export async function get(id: string): Promise<HaitiHistoryAlmanacEntry | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as HaitiHistoryAlmanacEntry;
}

export async function listAll(): Promise<HaitiHistoryAlmanacEntry[]> {
  const snap = await collection().orderBy("monthDay").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiHistoryAlmanacEntry);
}

/** List entries for a specific day (MM-DD). */
export async function listByMonthDay(monthDay: string): Promise<HaitiHistoryAlmanacEntry[]> {
  const snap = await collection()
    .where("monthDay", "==", monthDay)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiHistoryAlmanacEntry);
}

/** List entries for a specific month (MM). */
export async function listByMonth(month: string): Promise<HaitiHistoryAlmanacEntry[]> {
  const startDay = `${month}-01`;
  const endDay = `${month}-32`; // lexicographic trick: 32 > any valid day
  const snap = await collection()
    .where("monthDay", ">=", startDay)
    .where("monthDay", "<=", endDay)
    .orderBy("monthDay")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiHistoryAlmanacEntry);
}

/** List entries for an arbitrary MM-DD range. Handles year-end wrap (e.g. 12-29 → 01-04). */
export async function listByMonthDayRange(
  start: string,
  end: string,
): Promise<HaitiHistoryAlmanacEntry[]> {
  // Normal range: single query
  if (start <= end) {
    const snap = await collection()
      .where("monthDay", ">=", start)
      .where("monthDay", "<=", end)
      .orderBy("monthDay")
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiHistoryAlmanacEntry);
  }

  // Year-end wrap: two queries and merge
  const [snapA, snapB] = await Promise.all([
    collection()
      .where("monthDay", ">=", start)
      .where("monthDay", "<=", "12-31")
      .orderBy("monthDay")
      .get(),
    collection()
      .where("monthDay", ">=", "01-01")
      .where("monthDay", "<=", end)
      .orderBy("monthDay")
      .get(),
  ]);
  return [
    ...snapA.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiHistoryAlmanacEntry),
    ...snapB.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiHistoryAlmanacEntry),
  ];
}

/** Upsert by monthDay + title_fr (idempotent seeding). */
export async function upsertByTitle(
  data: CreateHaitiHistoryAlmanacEntry,
): Promise<{ entry: HaitiHistoryAlmanacEntry; created: boolean }> {
  const validated = createHaitiHistoryAlmanacEntrySchema.parse(data);
  const existing = await collection()
    .where("monthDay", "==", validated.monthDay)
    .where("title_fr", "==", validated.title_fr)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    const clean = Object.fromEntries(
      Object.entries(validated).filter(([, v]) => v !== undefined && v !== null),
    );
    await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
    const updated = await doc.ref.get();
    return { entry: { id: doc.id, ...updated.data() } as HaitiHistoryAlmanacEntry, created: false };
  }

  const entry = await create(validated);
  return { entry, created: true };
}

export async function update(id: string, data: Partial<CreateHaitiHistoryAlmanacEntry>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null),
  );
  await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}

/** Delete an almanac entry by ID. */
export async function remove(id: string): Promise<void> {
  await collection().doc(id).delete();
}

/** Find and delete by monthDay + title_fr (inverse of upsertByTitle). */
export async function removeByMonthDayAndTitle(monthDay: string, title_fr: string): Promise<boolean> {
  const snap = await collection()
    .where("monthDay", "==", monthDay)
    .where("title_fr", "==", title_fr)
    .limit(1)
    .get();
  if (snap.empty) return false;
  await snap.docs[0]!.ref.delete();
  return true;
}
