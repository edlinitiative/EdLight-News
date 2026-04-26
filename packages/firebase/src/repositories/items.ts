import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type { Item, ImageSource, ImageAttribution, EntityRef, ImageMeta } from "@edlight-news/types";
import { createItemSchema, type CreateItem } from "@edlight-news/types";

/** Fields that can be updated on an item (superset of CreateItem for image pipeline). */
export type ItemUpdate = Partial<CreateItem> & {
  imageConfidence?: number;
  imageAttribution?: ImageAttribution;
  entity?: EntityRef;
  generationAttempts?: number;
  scholarshipPromotion?: "promoted" | "rejected" | "failed";
  scholarshipPromotionAttempts?: number;
  opportunity?: {
    deadline?: string;
    eligibility?: string[];
    coverage?: string;
    howToApply?: string;
    officialLink?: string;
  };
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

/**
 * List items in the opportunites vertical that have not yet had a Gemini
 * generation attempt. Used by the generate step as a second pass so that
 * scholarships ingested days ago (already out of the recent-items window)
 * still get a chance to produce content_versions.
 *
 * Uses a single-field where("vertical") (auto-indexed) and sorts in-memory
 * so the query works without the (vertical, createdAt) composite index.
 * That index ships in firestore.indexes.json + deploy-worker.yml but
 * relying on it caused the entire generate phase to throw whenever the
 * index hadn't propagated, halting all content_versions creation and
 * starving every downstream queue (IG, FB) of non-staple posts.
 */
export async function listOpportunitiesNeedingGeneration(
  limit = 50,
  maxAttempts = 3,
): Promise<Item[]> {
  const snap = await collection()
    .where("vertical", "==", "opportunites")
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Item)
    .filter((it) => (it.generationAttempts ?? 0) < maxAttempts)
    .sort((a, b) => {
      const aMs = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
      const bMs = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
      return bMs - aMs;
    })
    .slice(0, limit);
}

/**
 * List `vertical=opportunites` items that have not yet been evaluated for
 * promotion to the structured `scholarships` collection (or whose promotion
 * failed transiently and should be retried).
 *
 * Uses single-field where + in-memory sort (see listOpportunitiesNeedingGeneration
 * for why we avoid the (vertical, createdAt) composite index here).
 */
export async function listOpportunitiesNeedingScholarshipPromotion(
  limit = 5,
  maxAttempts = 2,
): Promise<Item[]> {
  const snap = await collection()
    .where("vertical", "==", "opportunites")
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Item)
    .filter((it) => {
      // Definitively rejected → skip
      if (it.scholarshipPromotion === "rejected") return false;
      // Already promoted AND has opportunity data → skip (no work to do)
      if (it.scholarshipPromotion === "promoted" && it.opportunity) return false;
      // Already promoted but MISSING opportunity data → re-process
      // (This handles items promoted before discoverScholarships started
      //  writing back item.opportunity, which is the bridge to the IG queue)
      if (it.scholarshipPromotion === "promoted" && !it.opportunity) {
        console.warn(`[items] re-processing ${it.id}: promoted but missing opportunity data`);
      }
      // Failed attempts past the cap → skip
      if ((it.scholarshipPromotionAttempts ?? 0) >= maxAttempts) return false;
      // Need a URL and some text to extract from
      if (!it.canonicalUrl) return false;
      if (!it.extractedText && !it.summary) return false;
      return true;
    })
    .sort((a, b) => {
      const aMs = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
      const bMs = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
      return bMs - aMs;
    })
    .slice(0, limit);
}

export async function listRecentByItemType(
  itemType: string,
  limit = 50,
): Promise<Item[]> {
  const snap = await collection()
    .where("itemType", "==", itemType)
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

/**
 * Find a recent utility item with the given dedupeGroupId.
 * Used to prevent the utility engine from creating duplicate daily_fact /
 * scholarship / career items about the same underlying story.
 */
export async function findRecentUtilityByDedupeGroup(
  dedupeGroupId: string,
  sinceDaysAgo: number = 3,
): Promise<Item | null> {
  const since = new Date();
  since.setDate(since.getDate() - sinceDaysAgo);
  const sinceTimestamp = Timestamp.fromDate(since);

  const snap = await collection()
    .where("itemType", "==", "utility")
    .where("dedupeGroupId", "==", dedupeGroupId)
    .where("createdAt", ">=", sinceTimestamp)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0]!;
  return { id: doc.id, ...doc.data() } as Item;
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
  limit: number = 150,
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
    .limit(limit * 8) // over-fetch to account for items that already have good images
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
