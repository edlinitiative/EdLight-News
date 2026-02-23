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

  /**
   * Content "smell test" — at least one opportunity keyword must appear in
   * the title or summary. Prevents general news articles that were
   * mis-classified with vertical=opportunites from polluting the feed.
   */
  const OPP_KEYWORDS = [
    "bourse", "bourses", "scholarship", "fellowship", "grant",
    "concours", "competition", "hackathon", "prix", "award",
    "stage", "internship", "apprentissage",
    "programme", "formation", "inscription", "admission", "candidature",
    "master", "licence", "doctorat", "diplome",
    "financement", "aide", "subvention", "allocation",
    "postuler", "apply", "deadline", "date limite", "cloture",
    "etudiant", "student", "universitaire", "university",
    "emploi", "job", "recrutement", "talent",
    "opportunit", "okazyon",
  ];

  function looksLikeOpportunity(a: typeof allArticles[number]): boolean {
    // Utility items with the ScholarshipRadar series always pass
    if (a.itemType === "utility" && a.series === "ScholarshipRadar") return true;
    const blob = `${a.title ?? ""} ${a.summary ?? ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return OPP_KEYWORDS.some((kw) => blob.includes(kw));
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
