/**
 * Shared server-side data utilities.
 *
 * Building blocks for the fetch → enrich → rank pipeline used by all pages.
 * All functions are server-only (Firebase Admin SDK).
 */

import { contentVersionsRepo, itemsRepo } from "@edlight-news/firebase";
import { formatContentVersion } from "@edlight-news/generator";
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

    /* ── render-time formatting pass (idempotent safety net) ── */
    const formatted = formatContentVersion({
      lang: cv.language as "fr" | "ht",
      title: cv.title ?? "",
      summary: cv.summary ?? undefined,
      body: cv.body ?? undefined,
      series: (item?.utilityMeta?.series as string) ?? "News",
    });

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
      title: formatted.title,
      summary: formatted.summary ?? cv.summary,
      body: formatted.body ?? cv.body,
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
      vertical: item?.vertical,
      deadline: item?.deadline,
      publishedAt,
      // image fields
      imageUrl: item?.imageUrl ?? null,
      imageSource: item?.imageSource,
      imageAttribution: item?.imageAttribution,
      // synthesis fields
      itemType: item?.itemType,
      utilityType: item?.utilityMeta?.utilityType,
      series: item?.utilityMeta?.series,
      sourceCount: item?.synthesisMeta?.sourceCount,
      publisherDomains: item?.synthesisMeta?.publisherDomains,
      lastMajorUpdateAt: (() => {
        const s = toEpochSecs(item?.lastMajorUpdateAt);
        return s ? new Date(s * 1000).toISOString() : null;
      })(),
      whatChanged: cv.whatChanged,
      synthesisTags: cv.synthesisTags,
      sourceList: item?.sourceList,
      successTag: item?.successTag,
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

// ── Strict success gating (shared by homepage + /succes page) ────────────────

/**
 * Hard-exclusion tags — if ANY of these appear in synthesisTags,
 * the article is rejected UNLESS successTag is explicitly true.
 */
const SUCCESS_BLOCKED_TAGS = [
  "politique", "inflation", "crise", "violence",
];

/**
 * Strict gate: only articles explicitly tagged as success stories
 * or HaitianOfTheWeek utility items pass through.
 *
 * Rules:
 *  1. itemType == "utility" AND series == "HaitianOfTheWeek" → allowed
 *  2. successTag == true → allowed (any itemType)
 *  3. Everything else → rejected
 *
 * Hard filter: if an article contains blocked tags AND successTag !== true → excluded.
 */
export function isSuccessArticle(article: EnrichedArticle): boolean {
  const hasBlockedTag =
    Array.isArray(article.synthesisTags) &&
    article.synthesisTags.some((t) =>
      SUCCESS_BLOCKED_TAGS.includes(t.toLowerCase()),
    );

  // HaitianOfTheWeek utility items are always success stories
  if (article.itemType === "utility" && article.series === "HaitianOfTheWeek") {
    // … unless they somehow carry a blocked tag without explicit successTag
    if (hasBlockedTag && article.successTag !== true) return false;
    return true;
  }

  // Explicit successTag is the primary gate
  if (article.successTag === true) {
    // Hard filter: blocked tags override even successTag
    if (hasBlockedTag) return false;
    return true;
  }

  // No fallback to keyword matching — reject everything else
  return false;
}

// ── Calendar deadline types ──────────────────────────────────────────────────

export interface CalendarDeadline {
  label: string;
  dateISO: string;
  sourceUrl: string;
}

export interface CalendarData {
  item: EnrichedArticle | null;
  deadlines: CalendarDeadline[];
  hasUpcoming: boolean;
}

/**
 * Fetch the most recent HaitiEducationCalendar item and extract its deadlines.
 * Used by the homepage calendar block and /calendrier-haiti page.
 */
export async function fetchCalendarData(
  lang: ContentLanguage,
): Promise<CalendarData> {
  const allArticles = await fetchEnrichedFeed(lang, 200);

  // Find the most recent HaitiEducationCalendar utility item
  // Sort by lastMajorUpdateAt desc (then publishedAt)
  const calendarItems = allArticles
    .filter(
      (a) =>
        a.itemType === "utility" && a.series === "HaitiEducationCalendar",
    )
    .sort((a, b) => {
      const tA = a.lastMajorUpdateAt
        ? new Date(a.lastMajorUpdateAt).getTime()
        : a.publishedAt
          ? new Date(a.publishedAt).getTime()
          : 0;
      const tB = b.lastMajorUpdateAt
        ? new Date(b.lastMajorUpdateAt).getTime()
        : b.publishedAt
          ? new Date(b.publishedAt).getTime()
          : 0;
      return tB - tA;
    });

  if (calendarItems.length === 0) {
    return { item: null, deadlines: [], hasUpcoming: false };
  }

  const calItem = calendarItems[0]!;

  // Extract deadlines from the item's body or from Firestore extractedFacts
  // We get deadlines from the parent item via itemsRepo
  const itemMap = await fetchItemsByIds([calItem.itemId ?? ""]);
  const parentItem = calItem.itemId ? itemMap.get(calItem.itemId) : undefined;
  const rawDeadlines = parentItem?.utilityMeta?.extractedFacts?.deadlines ?? [];

  const now = new Date();
  const upcoming = rawDeadlines
    .filter((d) => d.dateISO && d.dateISO.length > 0 && new Date(d.dateISO) >= now)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  const recent = rawDeadlines
    .filter((d) => d.dateISO && d.dateISO.length > 0)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));

  const hasUpcoming = upcoming.length > 0;
  const deadlines = hasUpcoming ? upcoming : recent;

  return { item: calItem, deadlines, hasUpcoming };
}
