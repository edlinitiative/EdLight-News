/**
 * /search — Full-featured search page with category, type, and text filters.
 *
 * Server component: fetches full enriched feed, passes to client SearchFeed.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { buildOgMetadata } from "@/lib/og";
import { SearchFeed } from "@/components/SearchFeed";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Recherche · EdLight News" : "Rechèch · EdLight News";
  const description = fr
    ? "Recherchez des articles, bourses, opportunités et explainers sur EdLight News."
    : "Chèche atik, bous, okazyon ak eksplikasyon sou EdLight News.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/search", lang }),
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { lang?: string; q?: string; category?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";

  let articles: Awaited<ReturnType<typeof fetchEnrichedFeed>> = [];
  try {
    const all = await fetchEnrichedFeed(lang, 300);
    // Utility items (histoire du jour, daily facts, scholarship radar) live
    // on dedicated surfaces and shouldn't pollute generic search results.
    articles = all.filter((a) => a.itemType !== "utility");
  } catch (err) {
    console.error("[EdLight] /search fetch failed:", err);
  }

  const ranked = rankAndDeduplicate(articles, {
    audienceFitThreshold: 0.2,
    publisherCap: 5,
    topN: 200,
  });

  return (
    <div className="pb-20">
      <SearchFeed articles={ranked} lang={lang} initialQuery={searchParams.q ?? ""} />
    </div>
  );
}
