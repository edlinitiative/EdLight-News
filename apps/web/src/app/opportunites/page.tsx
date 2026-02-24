/**
 * /opportunites — Opportunities feed.
 *
 * Server component: fetches + filters scholarship/opportunity articles.
 * Client component (OpportunitiesFeed): handles subcategory pills,
 * sort (deadline / pertinence / dernières), and "inclure sans deadline" toggle.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { OpportunitiesFeed } from "@/components/OpportunitiesFeed";
import { contentLooksLikeOpportunity } from "@/lib/opportunityClassifier";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  return {
    title: fr ? "Opportunités · EdLight News" : "Okazyon · EdLight News",
    description: fr
      ? "Bourses, concours, stages et programmes pour étudiants haïtiens."
      : "Bous, konkou, estaj ak pwogram pou elèv ayisyen.",
  };
}

export default async function OpportunitesPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  let allArticles: Awaited<ReturnType<typeof fetchEnrichedFeed>>;
  try {
    allArticles = await fetchEnrichedFeed(lang, 200);
  } catch (err) {
    console.error("[EdLight] /opportunites fetch failed:", err);
    allArticles = [];
  }

  // Keep all opportunity-type items: by vertical, legacy categories, and new subcategories.
  // Items without deadlines are included — the client handles sort/filter logic.
  const OPPORTUNITY_CATEGORIES = new Set([
    "scholarship",
    "opportunity",
    "bourses",
    "concours",
    "stages",
    "programmes",
  ]);

  function looksLikeOpportunity(a: typeof allArticles[number]): boolean {
    // Utility items with the ScholarshipRadar series always pass
    if (a.itemType === "utility" && a.series === "ScholarshipRadar") return true;
    return contentLooksLikeOpportunity(a.title ?? "", a.summary);
  }

  const opportunityPool = allArticles.filter(
    (a) =>
      (a.vertical === "opportunites" ||
        OPPORTUNITY_CATEGORIES.has(a.category ?? "") ||
        (a.itemType === "utility" && a.series === "ScholarshipRadar")) &&
      looksLikeOpportunity(a),
  );

  const articles = rankAndDeduplicate(opportunityPool, {
    audienceFitThreshold: 0.65,
    publisherCap: 3,
    topN: 40,
  });

  const fr = lang === "fr";

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight dark:text-white">
          {fr ? "Opportunités" : "Okazyon"}
        </h1>
        <p className="text-gray-500 dark:text-slate-400">
          {fr
            ? "Bourses, concours, stages et programmes pour étudiants haïtiens."
            : "Bous, konkou, estaj ak pwogram pou elèv ayisyen."}
        </p>
      </div>

      {/* Client feed with full interactivity */}
      <OpportunitiesFeed articles={articles} lang={lang} />
    </div>
  );
}
