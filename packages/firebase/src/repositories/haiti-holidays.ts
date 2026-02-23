import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { HaitiHoliday } from "@edlight-news/types";
import { createHaitiHolidaySchema, type CreateHaitiHoliday } from "@edlight-news/types";

const COLLECTION = "haiti_holidays";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function create(data: CreateHaitiHoliday): Promise<HaitiHoliday> {
  const validated = createHaitiHolidaySchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, verifiedAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as HaitiHoliday;
}

export async function get(id: string): Promise<HaitiHoliday | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as HaitiHoliday;
}

export async function listAll(): Promise<HaitiHoliday[]> {
  const snap = await collection().orderBy("monthDay").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiHoliday);
}

/** Get holidays for a specific day (MM-DD). */
export async function listByMonthDay(monthDay: string): Promise<HaitiHoliday[]> {
  const snap = await collection()
    .where("monthDay", "==", monthDay)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiHoliday);
}

/** Upsert by monthDay + name_fr (idempotent seeding). */
export async function upsertByName(
  data: CreateHaitiHoliday,
): Promise<{ holiday: HaitiHoliday; created: boolean }> {
  const validated = createHaitiHolidaySchema.parse(data);
  const existing = await collection()
    .where("monthDay", "==", validated.monthDay)
    .where("name_fr", "==", validated.name_fr)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    const clean = Object.fromEntries(
      Object.entries(validated).filter(([, v]) => v !== undefined && v !== null),
    );
    await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
    const updated = await doc.ref.get();
    return { holiday: { id: doc.id, ...updated.data() } as HaitiHoliday, created: false };
  }

  const holiday = await create(validated);
  return { holiday, created: true };
}

export async function update(id: string, data: Partial<CreateHaitiHoliday>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null),
  );
  await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}
