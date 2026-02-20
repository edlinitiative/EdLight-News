import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type {
  ContentVersion,
  ContentChannel,
  ContentLanguage,
  ContentStatus,
} from "@edlight-news/types";
import {
  createContentVersionSchema,
  type CreateContentVersion,
} from "@edlight-news/types";

const COLLECTION = "content_versions";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function createContentVersion(
  data: CreateContentVersion,
): Promise<ContentVersion> {
  const validated = createContentVersionSchema.parse(data);
  // Strip undefined values — Firestore rejects them
  const clean = Object.fromEntries(
    Object.entries(validated).filter(([, v]) => v !== undefined),
  );
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...clean, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as ContentVersion;
}

/**
 * Batch-create multiple draft content_versions for a single item.
 * Used after LLM generation to write FR + HT versions at once.
 */
export async function createDraftVersionsForItem(
  itemId: string,
  versions: Omit<CreateContentVersion, "itemId">[],
): Promise<ContentVersion[]> {
  const results: ContentVersion[] = [];
  for (const v of versions) {
    const cv = await createContentVersion({ ...v, itemId });
    results.push(cv);
  }
  return results;
}

export async function getContentVersion(
  id: string,
): Promise<ContentVersion | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as ContentVersion;
}

/**
 * List web content_versions (draft + published) for the news feed.
 */
export async function listWebVersions(
  language: ContentLanguage,
  limit = 50,
): Promise<ContentVersion[]> {
  const snap = await collection()
    .where("channel", "==", "web" satisfies ContentChannel)
    .where("language", "==", language)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as ContentVersion,
  );
}

export async function listPublishedForWeb(
  language: ContentLanguage,
  limit = 50,
): Promise<ContentVersion[]> {
  const snap = await collection()
    .where("channel", "==", "web" satisfies ContentChannel)
    .where("status", "==", "published" satisfies ContentStatus)
    .where("language", "==", language)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as ContentVersion,
  );
}

export async function listByItemId(
  itemId: string,
): Promise<ContentVersion[]> {
  const snap = await collection().where("itemId", "==", itemId).get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() }) as ContentVersion,
  );
}

/**
 * Check whether an item already has web content_versions.
 */
export async function hasWebVersions(itemId: string): Promise<boolean> {
  const snap = await collection()
    .where("itemId", "==", itemId)
    .where("channel", "==", "web" satisfies ContentChannel)
    .limit(1)
    .get();
  return !snap.empty;
}

export async function updateContentVersionStatus(
  id: string,
  status: ContentStatus,
): Promise<void> {
  await collection()
    .doc(id)
    .update({ status, updatedAt: FieldValue.serverTimestamp() });
}

/**
 * Bulk-publish all draft content_versions that have passed quality gates
 * (no draftReason set). Called as a cleanup sweep after generate.
 */
export async function publishEligibleDrafts(): Promise<number> {
  const snap = await collection()
    .where("status", "==", "draft" satisfies ContentStatus)
    .get();

  const eligible = snap.docs.filter((d) => !d.data().draftReason);
  if (eligible.length === 0) return 0;

  const chunks: typeof eligible[] = [];
  for (let i = 0; i < eligible.length; i += 400) {
    chunks.push(eligible.slice(i, i + 400));
  }
  for (const chunk of chunks) {
    const batch = getDb().batch();
    for (const doc of chunk) {
      batch.update(doc.ref, {
        status: "published" as ContentStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
  return eligible.length;
}
