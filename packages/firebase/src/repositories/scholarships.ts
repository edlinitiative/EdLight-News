import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { Scholarship, DatasetCountry } from "@edlight-news/types";
import { createScholarshipSchema, type CreateScholarship } from "@edlight-news/types";

const COLLECTION = "scholarships";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function create(data: CreateScholarship): Promise<Scholarship> {
  const validated = createScholarshipSchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, verifiedAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as Scholarship;
}

export async function get(id: string): Promise<Scholarship | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Scholarship;
}

export async function listAll(): Promise<Scholarship[]> {
  const snap = await collection().orderBy("name").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Scholarship);
}

export async function listByCountry(country: DatasetCountry): Promise<Scholarship[]> {
  const snap = await collection().where("country", "==", country).orderBy("name").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Scholarship);
}

/** List scholarships with deadlines within the next N days. */
export async function listClosingSoon(days: number): Promise<Scholarship[]> {
  const all = await listAll();
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  return all.filter((s) => {
    if (!s.deadline?.dateISO) return false;
    const d = new Date(s.deadline.dateISO);
    return d >= now && d <= cutoff;
  }).sort((a, b) => {
    const dA = a.deadline?.dateISO ?? "";
    const dB = b.deadline?.dateISO ?? "";
    return dA.localeCompare(dB);
  });
}

/**
 * List scholarships open to Haitian applicants.
 *
 * A scholarship is considered eligible if ANY of:
 *   - country is "HT" or "Global" (host-country signal),
 *   - eligibleCountries contains "HT" (explicit allow-list),
 *   - eligibleCountries contains "Global" (open to any nationality —
 *     this is the convention used by Chevening, MasterCard, DAAD, AUF,
 *     Erasmus+, the Quebec tuition exemption, etc.),
 *   - eligibleCountries is missing or empty (no restriction recorded —
 *     err on the side of inclusion; users can still see in the card
 *     summary whether HT is explicitly listed).
 *
 * Items with an explicit allow-list that EXCLUDES Haiti
 * (e.g. Commonwealth Scholarships, which list ~50 specific countries
 * but not Haiti) remain correctly filtered out.
 */
export async function listEligibleForHaiti(): Promise<Scholarship[]> {
  const all = await listAll();
  return all.filter((s) => {
    if (s.country === "HT" || s.country === "Global") return true;
    const list = s.eligibleCountries;
    if (!list || list.length === 0) return true;
    return list.includes("HT") || list.includes("Global");
  });
}

export async function update(id: string, data: Partial<CreateScholarship>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null),
  );
  await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}

/** Upsert by name (used for seeding). */
export async function upsertByName(
  data: CreateScholarship,
): Promise<{ scholarship: Scholarship; created: boolean }> {
  const validated = createScholarshipSchema.parse(data);
  const existing = await collection()
    .where("name", "==", validated.name)
    .limit(1)
    .get();

  if (!existing.empty) {
    const doc = existing.docs[0]!;
    const clean = Object.fromEntries(
      Object.entries(validated).filter(([, v]) => v !== undefined && v !== null),
    );
    await doc.ref.update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
    const snap = await doc.ref.get();
    return { scholarship: { id: doc.id, ...snap.data() } as Scholarship, created: false };
  }

  const scholarship = await create(data);
  return { scholarship, created: true };
}

export async function count(): Promise<number> {
  const snap = await collection().count().get();
  return snap.data().count;
}
