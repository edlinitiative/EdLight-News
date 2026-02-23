import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { ContributorProfile, ContributorRole } from "@edlight-news/types";
import { createContributorProfileSchema, type CreateContributorProfile } from "@edlight-news/types";

const COLLECTION = "contributor_profiles";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function create(data: CreateContributorProfile): Promise<ContributorProfile> {
  const validated = createContributorProfileSchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as ContributorProfile;
}

export async function get(id: string): Promise<ContributorProfile | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as ContributorProfile;
}

export async function getByEmail(email: string): Promise<ContributorProfile | null> {
  const snap = await collection().where("email", "==", email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as ContributorProfile;
}

export async function listAll(): Promise<ContributorProfile[]> {
  const snap = await collection().orderBy("displayName").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContributorProfile);
}

export async function listVerified(): Promise<ContributorProfile[]> {
  const snap = await collection()
    .where("verified", "==", true)
    .orderBy("displayName")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContributorProfile);
}

export async function listByRole(role: ContributorRole): Promise<ContributorProfile[]> {
  const snap = await collection()
    .where("role", "==", role)
    .orderBy("displayName")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ContributorProfile);
}

export async function update(id: string, data: Partial<CreateContributorProfile>): Promise<void> {
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );
  await collection().doc(id).update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}

export async function count(): Promise<number> {
  const snap = await collection().count().get();
  return snap.data().count;
}
