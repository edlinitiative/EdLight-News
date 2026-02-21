/**
 * Shared server-side data utilities.
 *
 * Building blocks for the fetch → enrich → rank pipeline used by all pages.
 * All functions are server-only (Firebase Admin SDK).
 */

import { contentVersionsRepo, itemsRepo } from "@edlight-news/firebase";
import type {
  ContentLanguage,
  ContentVersion,
  Item,
} from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";

/** EnrichedArticle ≡ FeedItem — one shared type across the whole app */
export type EnrichedArticle = FeedItem;

// ── Timestamp helper ─────────────────────────────────────────────────────────

/** Parse a Firestore Timestamp-like value to epoch seconds (handles both SDK shapes). */
function toEpochSecs(v: unknown): number | undefined {
  if (!v || typeof v !== "object") return undefined;
  const t = v as { seconds?: number; _seconds?: number };
  return t.seconds ?? t._seconds;
}

// ── Lang helper ──────────────────────────────────────────────────────────────

/**
 * Extract the language preference from Next.js searchParams.
 * Accepts either a plain `{ lang?: string }` (page.tsx) or a
 * `Record<string, string | string[] | undefined>` (generic).
 * Defaults to "fr".
 */
export function getLangFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): ContentLanguage {
  const raw = searchParams["lang"];
  const val = Array.isArray(raw) ? raw[0] : raw;
  return val === "ht" ? "ht" : "fr";
}

// ── Fetch content_versions ───────────────────────────────────────────────────

export async function fetchContentVersions({
  lang,
  limit = 200,
  // channel reserved for future multi-channel support
}: {
  lang: ContentLanguage;
  limit?: number;
  channel?: string;
}): Promise<ContentVersion[]> {
  return contentVersionsRepo.listPublishedForWeb(lang, limit);
}

// ── Batch-fetch items ────────────────────────────────────────────────────────

/**
 * Batch-fetch items by ID, chunking requests so Firestore isn't hammered.
 * Uses Promise.allSettled so a single missing document doesn't abort the page.
 */
export async function fetchItemsByIds(
  itemIds: string[],
  chunkSize = 20,
): Promise<Map<string, Item>> {
  const unique = [...new Set(itemIds)];
  const itemMap = new Map<string, Item>();

  for (let i = 0; i < unique.length; i += chunkSize) {
    const batch = unique.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      batch.map((id) => itemsRepo.getItem(id)),
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        itemMap.set(r.value.id, r.value);
      }
    }
  }

  return itemMap;
}

// ── Enrich content_versions with item metadata ───────────────────────────────

/**
 * Merge content_version (rendered text) with parent item metadata (v2 fields).
 * The result is a fully-populated EnrichedArticle / FeedItem ready for display.
 */
export function enrichArticles(
  cvs: ContentVersion[],
  itemMap: Map<string, Item>,
): EnrichedArticle[] {
  return cvs.map((cv): EnrichedArticle => {
    const item = itemMap.get(cv.itemId);

    const cvSecs = toEpochSecs(cv.createdAt);
    const itemPubSecs = toEpochSecs(item?.publishedAt);
    const publishedAt = itemPubSecs
      ? new Date(itemPubSecs * 1000).toISOString()
      : cvSecs
        ? new Date(cvSecs * 1000).toISOString()
        : null;

    return {
      id: cv.id,
      itemId: cv.itemId,
      title: cv.title,
      summary: cv.summary,
      body: cv.body,
      status: cv.status,
      category: cv.category ?? item?.category,
      draftReason: cv.draftReason,
      citations: cv.citations ?? [],
      // v2 enrichment from parent item
      sourceName: item?.source?.name ?? cv.citations?.[0]?.sourceName,
      sourceUrl:
        item?.source?.originalUrl ?? cv.citations?.[0]?.sourceUrl,
      weakSource: item?.qualityFlags?.weakSource,
      missingDeadline: item?.qualityFlags?.missingDeadline,
      offMission: item?.qualityFlags?.offMission,
      audienceFitScore: item?.audienceFitScore,
      dedupeGroupId: item?.dedupeGroupId,
      geoTag: item?.geoTag,
      deadline: item?.deadline,
      publishedAt,
      // image fields
      imageUrl: item?.imageUrl ?? null,
      imageSource: item?.imageSource,
    };
  });
}

// ── Convenience wrapper ──────────────────────────────────────────────────────

/**
 * One-call helper: fetch → enrich → return EnrichedArticle[].
 * Used by every page route.
 */
export async function fetchEnrichedFeed(
  lang: ContentLanguage,
  limit = 200,
): Promise<EnrichedArticle[]> {
  const cvs = await fetchContentVersions({ lang, limit });
  const itemMap = await fetchItemsByIds(cvs.map((cv) => cv.itemId));
  return enrichArticles(cvs, itemMap);
}

// ── Success keyword matcher (shared by homepage + /succes page) ──────────────

const SUCCES_KEYWORDS_FR = [
  "accepté",
  "acceptée",
  "bourse obtenue",
  "admis",
  "diplômé",
  "recruté",
  "sélectionné",
  "récompense",
  "startup",
  "prix",
  "lauréat",
  "réussi",
  "médaille",
  "distinction",
  "mention",
  "gagnant",
  "remporté",
];

const SUCCES_KEYWORDS_HT = [
  "aksepte",
  "diplome",
  "rekrite",
  "siksè",
  "reyisi",
  "laurea",
  "bous",
  "pri",
];

export function isSuccessArticle(article: EnrichedArticle): boolean {
  if (article.category === "succes") return true;
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return (
    SUCCES_KEYWORDS_FR.some((k) => text.includes(k)) ||
    SUCCES_KEYWORDS_HT.some((k) => text.includes(k))
  );
}
