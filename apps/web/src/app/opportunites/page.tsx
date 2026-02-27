/**
 * /opportunites — Opportunities feed (v2 — premium redesign).
 *
 * Server component: fetches + filters scholarship/opportunity articles,
 * serialises them, and delegates filtering/rendering to client components.
 *
 * Layout (mirrors /bourses):
 *   1) Header — title, subtitle, count badge
 *   2) Catalogue — sticky filter bar + search + card grid
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Suspense } from "react";
import { Briefcase } from "lucide-react";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { OpportunitiesFeed } from "@/components/OpportunitiesFeed";
import { contentLooksLikeOpportunity } from "@/lib/opportunityClassifier";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Opportunités · EdLight News" : "Okazyon · EdLight News";
  const description = fr
    ? "Bourses, concours, stages et programmes pour étudiants haïtiens."
    : "Bous, konkou, estaj ak pwogram pou elèv ayisyen.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/opportunites", lang }),
  };
}

export default async function OpportunitesPage({
  searchParams,
}: {
  searchParams: { lang?: string; [key: string]: string | string[] | undefined };
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
      {/* ─── Section 1: Header ─── */}
      <header className="space-y-3 pt-2">
        <div className="section-rule" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white sm:text-3xl">
              <Briefcase className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              {fr ? "Opportunités" : "Okazyon"}
            </h1>
            <p className="max-w-2xl text-sm text-stone-500 dark:text-stone-400">
              {fr
                ? "Bourses, concours, stages et programmes pour étudiants haïtiens. Filtrez par type, deadline ou pertinence."
                : "Bous, konkou, estaj ak pwogram pou elèv ayisyen. Filtre pa tip, dat limit oswa pètinans."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
              {articles.length} {fr ? "opportunités" : "okazyon"}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Section 2: Catalogue (filters + cards) ─── */}
      <section className="pb-8">
        <Suspense fallback={null}>
          <OpportunitiesFeed articles={articles} lang={lang} />
        </Suspense>
      </section>
    </div>
  );
}
