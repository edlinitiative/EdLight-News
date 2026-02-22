import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { Item, ImageSource, ImageAttribution, EntityRef, ImageMeta } from "@edlight-news/types";
import { createItemSchema, type CreateItem } from "@edlight-news/types";

/** Fields that can be updated on an item (superset of CreateItem for image pipeline). */
export type ItemUpdate = Partial<CreateItem> & {
  imageConfidence?: number;
  imageAttribution?: ImageAttribution;
  entity?: EntityRef;
};

const COLLECTION = "items";

function collection() {
  return getDb().collection(COLLECTION);
}

export async function createItem(data: CreateItem): Promise<Item> {
  const validated = createItemSchema.parse(data);
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...validated, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as Item;
}

export async function getItem(id: string): Promise<Item | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Item;
}

export async function findByCanonicalUrl(
  canonicalUrl: string,
): Promise<Item | null> {
  const snap = await collection()
    .where("canonicalUrl", "==", canonicalUrl)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as Item;
}

/**
 * Insert or update an item keyed by canonicalUrl.
 * If an item with the same canonicalUrl exists, it is updated.
 * Returns the upserted Item and whether it was newly created.
 */
export async function upsertItemByCanonicalUrl(
  data: CreateItem,
): Promise<{ item: Item; created: boolean }> {
  const validated = createItemSchema.parse(data);
  const existing = await findByCanonicalUrl(validated.canonicalUrl);

  if (existing) {
    const now = FieldValue.serverTimestamp();
    await collection()
      .doc(existing.id)
      .update({ ...validated, updatedAt: now });
    const snap = await collection().doc(existing.id).get();
    return { item: { id: existing.id, ...snap.data() } as Item, created: false };
  }

  const item = await createItem(data);
  return { item, created: true };
}

/**
 * List items that do NOT yet have content_versions.
 * Used by the generate step to find items needing content generation.
 */
export async function listItemsByCategory(
  category: string,
): Promise<Item[]> {
  const snap = await collection().where("category", "==", category).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Item);
}

export async function listRecentItems(limit = 50): Promise<Item[]> {
  const snap = await collection()
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Item);
}

export async function updateItem(
  id: string,
  data: ItemUpdate,
): Promise<void> {
  // Strip undefined values — Firestore rejects them
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  );
  await collection()
    .doc(id)
    .update({ ...clean, updatedAt: FieldValue.serverTimestamp() });
}

/** Get a single item by its dedupeGroupId (newest first). */
export async function listByDedupeGroupId(
  dedupeGroupId: string,
  limit = 10,
): Promise<Item[]> {
  const snap = await collection()
    .where("dedupeGroupId", "==", dedupeGroupId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Item);
}

export async function deleteItem(id: string): Promise<void> {
  await collection().doc(id).delete();
}

// ── Synthesis helpers ───────────────────────────────────────────────────────

/** Find an existing synthesis item by its clusterId. */
export async function findSynthesisByClusterId(
  clusterId: string,
): Promise<Item | null> {
  const snap = await collection()
    .where("itemType", "==", "synthesis")
    .where("clusterId", "==", clusterId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as Item;
}

/**
 * List recent source items (non-synthesis) that have a dedupeGroupId.
 * Used by synthesis cluster selection.
 */
export async function listRecentSourceItems(
  sinceDaysAgo: number,
  limit: number = 500,
): Promise<Item[]> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);
  const sinceTimestamp = Timestamp.fromDate(since);

  const snap = await collection()
    .where("createdAt", ">=", sinceTimestamp)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Item)
    .filter((item) => !!item.dedupeGroupId && item.itemType !== "synthesis");
}

/** Set lastMajorUpdateAt to server timestamp (for synthesis living updates). */
export async function setLastMajorUpdate(id: string): Promise<void> {
  await collection().doc(id).update({
    lastMajorUpdateAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * List items that have no imageSource field yet and meet the minimum score
 * threshold for image generation (audienceFitScore >= 0.5).
 *
 * Uses a Firestore inequality filter on audienceFitScore so low-value items
 * are excluded at the query level. The imageSource check is still done
 * in-memory because Firestore can't query for missing fields.
 */
/**
 * Image sources that the new pipeline considers "stale" — items with these
 * sources AND no imageConfidence field were processed by the old code and
 * should be re-processed through the upgraded 4-tier pipeline.
 */
const STALE_IMAGE_SOURCES = new Set(["screenshot", "fallback", "generated"]);

export async function listItemsNeedingImages(limit: number): Promise<Item[]> {
  const IMAGE_SCORE_THRESHOLD = 0.5;

  const snap = await collection()
    .where("audienceFitScore", ">=", IMAGE_SCORE_THRESHOLD)
    .orderBy("audienceFitScore", "desc") // highest-value items first
    .limit(limit * 30) // over-fetch to account for items that already have good images
    .get();

  const results: Item[] = [];
  for (const doc of snap.docs) {
    const data = doc.data() as Item;

    // No imageSource at all → needs processing
    const needsImage = !data.imageSource;

    // Old stale source with no confidence → re-process through new pipeline
    const isStale =
      !!data.imageSource &&
      STALE_IMAGE_SOURCES.has(data.imageSource) &&
      (data.imageConfidence === undefined || data.imageConfidence === null);

    if (!needsImage && !isStale) continue;

    results.push({ ...data, id: doc.id });
    if (results.length >= limit) break;
  }
  return results;
}
