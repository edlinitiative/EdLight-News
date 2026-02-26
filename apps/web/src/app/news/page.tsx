import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Newspaper } from "lucide-react";
import { NewsFeed } from "@/components/news-feed";
import { fetchEnrichedArticles } from "@/lib/feed";
import { rankFeed } from "@/lib/ranking";
import { getLangFromSearchParams } from "@/lib/content";
import { Suspense } from "react";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Fil — Actualités · EdLight News" : "Fil — Nouvèl · EdLight News";
  const description = fr
    ? "Toute l'actualité éducative pour les étudiants haïtiens."
    : "Tout nouvèl edikasyon pou elèv ayisyen yo.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/news", lang }),
  };
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: { lang?: string; category?: string; mode?: string };
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

  const fr = language === "fr";

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          <Newspaper className="mr-1.5 inline h-7 w-7 text-brand-600 dark:text-brand-400" />
          {fr ? "Fil — Actualités" : "Fil — Nouvèl"}
        </h1>
        <p className="max-w-2xl text-gray-600 dark:text-slate-300">
          {fr
            ? "Flux complet d’actualités éducatives, classé et dédupliqué pour une lecture plus utile."
            : "Fil nouvèl edikasyon konplè, klase ak retire doublon pou li pi itil."}
        </p>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          {articles.length} {fr ? "articles" : "atik"}
        </p>
      </header>

      <Suspense
        fallback={
          <div className="section-shell h-96 animate-pulse bg-gray-100 dark:bg-slate-800" />
        }
      >
        <NewsFeed articles={articles} serverLang={language} preRanked />
      </Suspense>
    </div>
  );
}
