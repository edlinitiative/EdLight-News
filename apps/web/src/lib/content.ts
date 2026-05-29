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
  const out: EnrichedArticle[] = [];
  for (const cv of cvs) {
    try {
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

      out.push({
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
        opportunityScore: item?.opportunityScore,
        // Pass the full structured opportunity payload (kind / audience /
        // funding / lifecycle / etc.) to the client so /opportunites can
        // expose fine-grained filters without re-running the classifier.
        opportunity: item?.opportunity
          ? {
              deadline: item.opportunity.deadline,
              kind: item.opportunity.kind,
              audience: item.opportunity.audience,
              fundingType: item.opportunity.fundingType,
              locationType: item.opportunity.locationType,
              haitiEligible: item.opportunity.haitiEligible,
              eligibleRegions: item.opportunity.eligibleRegions,
              lifecycle: item.opportunity.lifecycle,
              trustTier: item.opportunity.trustTier,
              eligibility: item.opportunity.eligibility,
              coverage: item.opportunity.coverage,
              howToApply: item.opportunity.howToApply,
              officialLink: item.opportunity.officialLink,
              applicationSteps: item.opportunity.applicationSteps,
            }
          : undefined,
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
      });
    } catch (err) {
      // One bad doc must not poison the entire feed. Skip it and log
      // server-side so we can chase the root cause without taking down
      // the page.
      console.error(
        `[EdLight] enrichArticles: skipped cv=${cv?.id ?? "?"} item=${cv?.itemId ?? "?"}:`,
        err instanceof Error ? err.stack ?? err.message : err,
      );
    }
  }
  return out;
}

// ── Convenience wrapper ──────────────────────────────────────────────────────

/**
 * One-call helper: fetch → enrich → return EnrichedArticle[].
 * Used by every page route. Cached for 5 minutes via unstable_cache
 * so concurrent/near-simultaneous page renders share the same result.
 */
export const fetchEnrichedFeed = unstable_cache(
  async (lang: ContentLanguage, limit: number = 200): Promise<EnrichedArticle[]> => {
    // IMPORTANT: catch inside the cached body so failures (e.g. Firestore
    // "Quota exceeded") get stored as an empty result for the full revalidate
    // window. Otherwise unstable_cache discards the rejection and every
    // subsequent request retries, burning even more Firestore reads.
    try {
      const cvs = await fetchContentVersions({ lang, limit });
      const itemMap = await fetchItemsByIds(cvs.map((cv) => cv.itemId));
      return enrichArticles(cvs, itemMap);
    } catch (err) {
      console.error(
        `[EdLight] fetchEnrichedFeed failed (lang=${lang}, limit=${limit}):`,
        err instanceof Error ? err.stack ?? err.message : err,
      );
      return [];
    }
  },
  // Cache key suffix bumped to v3 (2026-05): after the aggregator + non-Haiti
  // news purges (PRs #103-#106), the v2 namespace still served stale homepage
  // results pointing to deleted items (manifesting as "Not found" tiles and
  // off-mission articles like Cuba scenarios / Brazil sports). Bumping the
  // key forces a fresh cache namespace so the next render reflects the
  // cleaned-up Firestore state.
  ["enriched-feed", "v3"],
  // 30 min — content updates rarely; this is the primary read driver.
  { revalidate: 1800, tags: ["feed"] },
);

// ── Vertical-scoped feed (fast path for /opportunites etc.) ──────────────────

/**
 * Fetch a feed scoped to a single vertical (e.g. "opportunites").
 *
 * Uses the composite index `(vertical ASC, publishedAt DESC)` on `items` to
 * pull only the docs we actually need, then resolves each one's matching
 * `content_version` via the composite `(itemId, channel, status, language)`
 * index. This avoids over-fetching ~800 mixed-vertical content_versions just
 * to throw 90 % away in memory.
 *
 * Cached for 5 minutes per (vertical, lang, limit) tuple.
 */
export const fetchEnrichedFeedByVertical = unstable_cache(
  async (
    vertical: string,
    lang: ContentLanguage,
    limit: number = 200,
  ): Promise<EnrichedArticle[]> => {
   try {
    const db = getDb();

    // 1. Query items by vertical, newest first. Over-fetch slightly so we
    //    still have `limit` results after dropping items missing a published
    //    content_version in the requested language.
    //
    // Falls back to an unsorted query when the composite index isn't ready
    // yet (returns FAILED_PRECONDITION). This happens right after a fresh
    // index deploy — Firestore can take 5-30 min to build a new composite,
    // and we'd rather show stale-but-correct results than an empty page.
    let snap;
    try {
      snap = await db
        .collection("items")
        .where("vertical", "==", vertical)
        .orderBy("publishedAt", "desc")
        .limit(Math.ceil(limit * 1.5))
        .get();
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      // 9 = FAILED_PRECONDITION (missing index). Re-throw anything else.
      if (code !== 9) throw err;
      console.warn(
        `[content] composite index for ${vertical}+publishedAt not ready, falling back to unsorted scan`,
      );
      snap = await db
        .collection("items")
        .where("vertical", "==", vertical)
        .limit(Math.ceil(limit * 1.5))
        .get();
    }

    if (snap.empty) return [];

    const items = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() }) as Item,
    );
    const itemMap = new Map(items.map((i) => [i.id, i]));

    // 2. Resolve one content_version per item using batched `itemId in […]`
    //    queries (Firestore caps `in` at 30 values). This collapses what was
    //    an N+1 (one round-trip per item) into ⌈N/30⌉ round-trips, which is
    //    the single biggest contributor to read-quota burn here.
    const cvs: ContentVersion[] = [];
    const cvCol = db.collection("content_versions");
    const inChunkSize = 30;
    for (let i = 0; i < items.length && cvs.length < limit; i += inChunkSize) {
      const ids = items.slice(i, i + inChunkSize).map((it) => it.id);
      const snap = await cvCol
        .where("itemId", "in", ids)
        .where("channel", "==", "web")
        .where("status", "==", "published")
        .where("language", "==", lang)
        .get();
      for (const d of snap.docs) {
        cvs.push({ id: d.id, ...d.data() } as ContentVersion);
        if (cvs.length >= limit) break;
      }
    }

    return enrichArticles(cvs, itemMap);
   } catch (err) {
     console.error(
       `[EdLight] fetchEnrichedFeedByVertical failed (vertical=${vertical}, lang=${lang}):`,
       err instanceof Error ? err.stack ?? err.message : err,
     );
     return [];
   }
  },
  // See fetchEnrichedFeed above for rationale on the v3 suffix.
  ["enriched-feed-by-vertical", "v3"],
  { revalidate: 1800, tags: ["feed"] },
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
   try {
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

    // Batched `itemId in […]` (Firestore caps `in` at 30) instead of one
    // listByItemId per item. Cuts trending fetch from O(N) round-trips to
    // O(⌈N/30⌉) — usually 1 query for the homepage trending block.
    const cvs: import("@edlight-news/types").ContentVersion[] = [];
    const cvCol = db.collection("content_versions");
    const inChunkSize = 30;
    for (let i = 0; i < itemIds.length && cvs.length < limit; i += inChunkSize) {
      const ids = itemIds.slice(i, i + inChunkSize);
      const snap = await cvCol
        .where("itemId", "in", ids)
        .where("channel", "==", "web")
        .where("status", "==", "published")
        .where("language", "==", lang)
        .get();
      for (const d of snap.docs) {
        cvs.push({ id: d.id, ...d.data() } as import("@edlight-news/types").ContentVersion);
        if (cvs.length >= limit) break;
      }
    }

    return enrichArticles(cvs, itemMap).slice(0, limit);
   } catch (err) {
     console.error(
       `[EdLight] fetchTrending failed (lang=${lang}, limit=${limit}):`,
       err instanceof Error ? err.stack ?? err.message : err,
     );
     return [];
   }
  },
  // v3 suffix added 2026-05 in line with the enriched-feed bump after the
  // aggregator + non-Haiti purges (PRs #103-#106).
  ["trending-feed", "v3"],
  { revalidate: 1800, tags: ["trending"] },
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
