/**
 * Server-side data fetching helper.
 * Fetches published content_versions and enriches them with parent item
 * metadata (audienceFitScore, dedupeGroupId, geoTag, source, …).
 *
 * Used by both the homepage and /news page so the enrichment logic
 * lives in exactly one place.
 */

import { contentVersionsRepo, itemsRepo } from "@edlight-news/firebase";
import type { ContentLanguage, Item } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";

export async function fetchEnrichedArticles(
  language: ContentLanguage,
  limit = 200,
): Promise<FeedItem[]> {
  const all = await contentVersionsRepo.listPublishedForWeb(language, limit);

  // Batch-fetch parent items (10 at a time) for v2 field denormalization.
  // allSettled so a single missing item doesn't crash the page.
  const itemIds = [...new Set(all.map((a) => a.itemId))];
  const itemMap = new Map<string, Item>();
  for (let i = 0; i < itemIds.length; i += 10) {
    const batch = itemIds.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map((id) => itemsRepo.getItem(id)),
    );
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        itemMap.set(r.value.id, r.value);
      }
    }
  }

  return all.map((cv): FeedItem => {
    const item = itemMap.get(cv.itemId);

    // Firestore Timestamp → epoch seconds (handles both Admin SDK shapes)
    type TsLike = { seconds?: number; _seconds?: number };
    const toSecs = (v: unknown): number | undefined => {
      if (!v || typeof v !== "object") return undefined;
      const t = v as TsLike;
      return t.seconds ?? t._seconds;
    };

    const cvSecs = toSecs(cv.createdAt);
    const itemPubSecs = toSecs(item?.publishedAt);
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
      sourceUrl: item?.source?.originalUrl ?? cv.citations?.[0]?.sourceUrl,
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
    };
  });
}
