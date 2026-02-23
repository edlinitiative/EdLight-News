import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { NewsFeed } from "@/components/news-feed";
import { fetchEnrichedArticles } from "@/lib/feed";
import { rankFeed } from "@/lib/ranking";
import { Suspense } from "react";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Fil — EdLight News",
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: { lang?: string; category?: string };
}) {
  const language: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";

  // Fetch enriched articles (content_versions + parent item metadata)
  let enriched: Awaited<ReturnType<typeof fetchEnrichedArticles>>;
  try {
    enriched = await fetchEnrichedArticles(language, 200);
  } catch (err) {
    console.error("[EdLight] /news fetch failed:", err);
    enriched = [];
  }

  // Server-side ranking:
  //   - drop offMission items
  //   - drop scored items below 0.65 (legacy/unscored items always pass)
  //   - dedupe by dedupeGroupId (keep newest publishedAt)
  //   - sort by audienceFitScore desc → publishedAt desc
  //   - max 3 articles from same publisher within top 20
  const articles = rankFeed(enriched, {
    audienceFitThreshold: 0.65,
    publisherCap: 3,
    topN: 20,
  });

  return (
    <Suspense
      fallback={
        <div className="animate-pulse h-96 rounded-lg bg-gray-100" />
      }
    >
      {/*
        preRanked=true tells NewsFeed to skip its own score filter / dedup
        since the server already applied them above.
        Category filter, search, and sort remain fully client-side.
      */}
      <NewsFeed articles={articles} serverLang={language} preRanked />
    </Suspense>
  );
}
