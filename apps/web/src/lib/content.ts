/**
 * Shared server-side data utilities.
 *
 * Building blocks for the fetch → enrich → rank pipeline used by all pages.
 * All functions are server-only (Firebase Admin SDK).
 */

import { unstable_cache } from "next/cache";
import { contentVersionsRepo, getDb, itemsRepo } from "@edlight-news/firebase";
import { formatContentVersion } from "@edlight-news/generator";
import type {
  ContentLanguage,
  ContentVersion,
  Item,
} from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { daysUntil, parseISODateSafe } from "@/lib/deadlines";

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
  const db = getDb();

  for (let i = 0; i < unique.length; i += chunkSize) {
    const batch = unique.slice(i, i + chunkSize);
    try {
      const refs = batch.map((id) => db.collection("items").doc(id));
      const snaps = await db.getAll(...refs);
      for (const snap of snaps) {
        if (!snap.exists) continue;
        itemMap.set(snap.id, { id: snap.id, ...snap.data() } as Item);
      }
    } catch {
      // Fallback safety net if batch get fails for any reason.
      const results = await Promise.allSettled(
        batch.map((id) => itemsRepo.getItem(id)),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          itemMap.set(r.value.id, r.value);
        }
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
      imageMeta: item?.imageMeta
        ? { width: item.imageMeta.width, height: item.imageMeta.height }
        : undefined,
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
      authorSlug: item?.authorSlug,
    };
  });
}

// ── Convenience wrapper ──────────────────────────────────────────────────────

/**
 * One-call helper: fetch → enrich → return EnrichedArticle[].
 * Used by every page route. Cached for 5 minutes via unstable_cache
 * so concurrent/near-simultaneous page renders share the same result.
 */
export const fetchEnrichedFeed = unstable_cache(
  async (lang: ContentLanguage, limit: number = 200): Promise<EnrichedArticle[]> => {
    const cvs = await fetchContentVersions({ lang, limit });
    const itemMap = await fetchItemsByIds(cvs.map((cv) => cv.itemId));
    return enrichArticles(cvs, itemMap);
  },
  ["enriched-feed"],
  { revalidate: 300, tags: ["feed"] },
);

// ── Trending articles (by viewCount) ─────────────────────────────────────────

/**
 * Fetch the most-viewed articles.
 * Queries items ordered by viewCount desc, then enriches them with
 * matching content_versions in the requested language.
 * Cached for 5 minutes to avoid hammering Firestore.
 */
export const fetchTrending = unstable_cache(
  async (lang: ContentLanguage, limit: number = 8): Promise<EnrichedArticle[]> => {
    const db = getDb();

    // Query items with highest viewCount
    const snapshot = await db
      .collection("items")
      .where("viewCount", ">", 0)
      .orderBy("viewCount", "desc")
      .limit(limit * 2) // over-fetch since some may lack content_versions
      .get();

    if (snapshot.empty) return [];

    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Item));
    const itemMap = new Map(items.map((i) => [i.id, i]));
    const itemIds = items.map((i) => i.id);

    // Find matching content_versions for these items.
    // Use chunked parallel requests (instead of sequential) to reduce tail latency.
    const cvs: import("@edlight-news/types").ContentVersion[] = [];
    const chunkSize = 8;
    for (let i = 0; i < itemIds.length && cvs.length < limit; i += chunkSize) {
      const chunk = itemIds.slice(i, i + chunkSize);
      const settled = await Promise.allSettled(
        chunk.map((itemId) => contentVersionsRepo.listByItemId(itemId)),
      );

      for (const r of settled) {
        if (r.status !== "fulfilled") continue;
        const match = r.value.find(
          (v) => v.language === lang && v.channel === "web" && v.status === "published",
        );
        if (match) cvs.push(match);
        if (cvs.length >= limit) break;
      }
    }

    return enrichArticles(cvs, itemMap).slice(0, limit);
  },
  ["trending-feed"],
  { revalidate: 300, tags: ["trending"] },
);

// ── Strict success gating (shared by homepage + /succes page) ────────────────

/**
 * Hard-exclusion tags — if ANY of these appear in synthesisTags,
 * the article is rejected UNLESS successTag is explicitly true.
 */
const SUCCESS_BLOCKED_TAGS = [
  "politique", "inflation", "crise", "violence",
];

/**
 * Opportunity-like keywords — articles dominated by these are likely
 * opportunities (scholarships, contests, deadlines) not success stories.
 * The LLM backfill sometimes misclassifies these.
 */
const OPPORTUNITY_SIGNAL_KW = [
  "postuler", "candidature", "candidater", "apply",
  "date limite", "deadline", "cloture",
  "inscription", "admissions",
  "prix", "award", "recompense", "competition",
  "appel a candidatures",
];

/**
 * Positive success-story keywords — at least one must appear for
 * articles gated solely via successTag (LLM-assigned).
 */
const SUCCESS_POSITIVE_KW = [
  "reussite", "succes", "inspire", "parcours", "fierte",
  "accomplissement", "distinction", "honneur", "pionnier",
  "premiere", "premier", "laureat", "excellence",
  "diaspora", "communaute", "haitien", "haitienne",
  "nomination", "elu", "fondateur", "fondatrice",
  "portrait", "profil", "temoignage",
];

function _normForSuccess(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Strict gate: only articles explicitly tagged as success stories
 * or HaitianOfTheWeek utility items pass through.
 *
 * Rules:
 *  1. itemType == "utility" AND series == "HaitianOfTheWeek" → allowed
 *  2. successTag == true → allowed (any itemType)
 *     - but rejected if blocked tags present
 *     - but rejected if text is dominated by opportunity keywords
 *       without any positive success keywords (catches LLM mis-tags)
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

    // Guard against LLM mis-tags: if the article reads like an opportunity
    // (awards, deadlines, competitions) and has no positive success signals,
    // reject it.
    const blob = _normForSuccess(
      `${article.title ?? ""} ${article.summary ?? ""}`,
    );
    const hasOppSignal = OPPORTUNITY_SIGNAL_KW.some((kw) => blob.includes(kw));
    if (hasOppSignal) {
      const hasSuccessSignal = SUCCESS_POSITIVE_KW.some((kw) =>
        blob.includes(kw),
      );
      if (!hasSuccessSignal) return false;
    }

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

  const upcoming = rawDeadlines
    .filter((d) => {
      const date = parseISODateSafe(d.dateISO);
      return date ? daysUntil(date) >= 0 : false;
    })
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  const recent = rawDeadlines
    .filter((d) => d.dateISO && d.dateISO.length > 0)
    .sort((a, b) => b.dateISO.localeCompare(a.dateISO));

  const hasUpcoming = upcoming.length > 0;
  const deadlines = hasUpcoming ? upcoming : recent;

  return { item: calItem, deadlines, hasUpcoming };
}
