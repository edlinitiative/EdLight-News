/**
 * /opportunites — Opportunities feed.
 *
 * Server component: fetches + filters scholarship/opportunity articles.
 * Client component (OpportunitiesFeed): handles subcategory pills,
 * sort (deadline / pertinence / dernières), and "inclure sans deadline" toggle.
 */

import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { OpportunitiesFeed } from "@/components/OpportunitiesFeed";

export const dynamic = "force-dynamic";

export default async function OpportunitesPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  const allArticles = await fetchEnrichedFeed(lang, 200);

  // Keep scholarship + opportunity categories; off-mission and dedup handled
  // by rankAndDeduplicate, but keep limit generous so client sort/filter works.
  const opportunityPool = allArticles.filter(
    (a) => a.category === "scholarship" || a.category === "opportunity",
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
        <h1 className="text-3xl font-extrabold tracking-tight">
          {fr ? "Opportunités" : "Okazyon"}
        </h1>
        <p className="text-gray-500">
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
