import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { HaitiCalendarEvent, CalendarEventType, CalendarLevel } from "@edlight-news/types";
import { createHaitiCalendarEventSchema, type CreateHaitiCalendarEvent } from "@edlight-news/types";

const COLLECTION = "haiti_education_calendar";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function create(data: CreateHaitiCalendarEvent): Promise<HaitiCalendarEvent> {
  const validated = createHaitiCalendarEventSchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, verifiedAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as HaitiCalendarEvent;
}

export async function get(id: string): Promise<HaitiCalendarEvent | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as HaitiCalendarEvent;
}

export async function listAll(): Promise<HaitiCalendarEvent[]> {
  const snap = await collection().orderBy("dateISO").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiCalendarEvent);
}

export async function listByEventType(eventType: CalendarEventType): Promise<HaitiCalendarEvent[]> {
  const snap = await collection()
    .where("eventType", "==", eventType)
    .orderBy("dateISO")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiCalendarEvent);
}

export async function listByLevel(level: CalendarLevel): Promise<HaitiCalendarEvent[]> {
  const snap = await collection()
    .where("level", "==", level)
    .orderBy("dateISO")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiCalendarEvent);
}

/** List events from today onward. */
export async function listUpcoming(): Promise<HaitiCalendarEvent[]> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const snap = await collection()
    .where("dateISO", ">=", today)
    .orderBy("dateISO")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as HaitiCalendarEvent);
}

export async function update(id: string, data: Partial<CreateHaitiCalendarEvent>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null),
  );
  await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}

/** Upsert by title + dateISO (used for seeding). */
export async function upsertByTitle(
  data: CreateHaitiCalendarEvent,
): Promise<{ event: HaitiCalendarEvent; created: boolean }> {
  const validated = createHaitiCalendarEventSchema.parse(data);
  const existing = await collection()
    .where("title", "==", validated.title)
    .where("dateISO", "==", validated.dateISO)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    const clean = Object.fromEntries(
      Object.entries(validated).filter(([, v]) => v !== undefined && v !== null),
    );
    await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
    const snap = await doc.ref.get();
    return { event: { id: doc.id, ...snap.data() } as HaitiCalendarEvent, created: false };
  }

  const event = await create(data);
  return { event, created: true };
}

export async function count(): Promise<number> {
  const snap = await collection().count().get();
  return snap.data().count;
}
