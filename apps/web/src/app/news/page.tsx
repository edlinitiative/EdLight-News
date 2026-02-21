import { contentVersionsRepo, itemsRepo } from "@edlight-news/firebase";
import type { ContentLanguage, Item } from "@edlight-news/types";
import { NewsFeed, type FeedItem } from "@/components/news-feed";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function NewsPage({
  searchParams,
}: {
  searchParams: { lang?: string; category?: string };
}) {
  const language: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";

  // Fetch published web content versions (up to 200)
  const all = await contentVersionsRepo.listPublishedForWeb(language, 200);

  // Batch-fetch parent items for v2 field denormalization
  const itemIds = [...new Set(all.map((a) => a.itemId))];
  const itemMap = new Map<string, Item>();
  // Fetch in parallel batches of 10
  for (let i = 0; i < itemIds.length; i += 10) {
    const batch = itemIds.slice(i, i + 10);
    const results = await Promise.all(
      batch.map((id) => itemsRepo.getItem(id)),
    );
    for (const item of results) {
      if (item) itemMap.set(item.id, item);
    }
  }

  // Build serializable FeedItem array
  const articles: FeedItem[] = all.map((cv) => {
    const item = itemMap.get(cv.itemId);
    const ts = cv.createdAt as { seconds?: number; _seconds?: number } | undefined;
    const secs = ts?.seconds ?? (ts as Record<string, number> | undefined)?._seconds;
    const publishedAtItem = item?.publishedAt as { seconds?: number; _seconds?: number } | null | undefined;
    const pubSecs = publishedAtItem?.seconds ?? (publishedAtItem as Record<string, number> | null)?._seconds;

    return {
      id: cv.id,
      title: cv.title,
      summary: cv.summary,
      body: cv.body,
      status: cv.status,
      category: cv.category ?? item?.category,
      draftReason: cv.draftReason,
      citations: cv.citations ?? [],
      // v2 fields from parent item
      sourceName: item?.source?.name ?? cv.citations?.[0]?.sourceName,
      sourceUrl: item?.source?.originalUrl ?? cv.citations?.[0]?.sourceUrl,
      weakSource: item?.qualityFlags?.weakSource,
      missingDeadline: item?.qualityFlags?.missingDeadline,
      offMission: item?.qualityFlags?.offMission,
      audienceFitScore: item?.audienceFitScore,
      dedupeGroupId: item?.dedupeGroupId,
      geoTag: item?.geoTag,
      deadline: item?.deadline,
      publishedAt: pubSecs
        ? new Date(pubSecs * 1000).toISOString()
        : secs
          ? new Date(secs * 1000).toISOString()
          : null,
    };
  });

  return (
    <Suspense fallback={<div className="animate-pulse h-96 rounded-lg bg-gray-100" />}>
      <NewsFeed articles={articles} serverLang={language} />
    </Suspense>
  );
}
