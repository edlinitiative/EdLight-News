/**
 * /opportunites — Opportunities feed.
 *
 * Server component: fetches + filters scholarship/opportunity articles.
 * Client component (OpportunitiesFeed): handles subcategory pills,
 * sort (deadline / pertinence / dernières), and "inclure sans deadline" toggle.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Sparkles, Briefcase, Clock3 } from "lucide-react";
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
      <section className="section-shell p-0">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-35" />
          <div className="pointer-events-none absolute -right-10 top-0 h-44 w-44 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/15" />
          <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                {fr ? "Opportunités premium" : "Okazyon premium"}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight dark:text-white sm:text-4xl">
                <Briefcase className="mr-1.5 inline h-7 w-7 text-brand-600 dark:text-brand-400" />
                {fr ? "Opportunités" : "Okazyon"}
              </h1>
              <p className="text-gray-600 dark:text-slate-300">
                {fr
                  ? "Bourses, concours, stages et programmes pour étudiants haïtiens avec filtres par type, deadline et pertinence."
                  : "Bous, konkou, estaj ak pwogram pou elèv ayisyen ak filtè pa tip, dat limit ak pètinans."}
              </p>
            </div>
            <aside className="premium-glass p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Résultats" : "Rezilta"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{articles.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Tri" : "Tri"}</p>
                  <p className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white"><Clock3 className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />{fr ? "Deadline / Pertinence" : "Dat limit / Pètinans"}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Client feed with full interactivity */}
      <OpportunitiesFeed articles={articles} lang={lang} />
    </div>
  );
}
