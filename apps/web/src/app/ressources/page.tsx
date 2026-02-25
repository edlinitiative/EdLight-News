/**
 * /ressources — Resources feed.
 *
 * Server component: includes category=resource items AND utility magazine
 * posts (series: Career, StudyAbroad, HaitiHistory, HaitiFactOfTheDay,
 * HaitianOfTheWeek).
 * Client component (SectionFeed): handles sort toggle (Pertinence / Dernières).
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { BookOpen, Sparkles, Library } from "lucide-react";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { SectionFeed } from "@/components/SectionFeed";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  return {
    title: fr ? "Ressources · EdLight News" : "Resous · EdLight News",
    description: fr
      ? "Guides, carrière, étudier à l'étranger, histoire — tout pour les étudiants haïtiens."
      : "Gid, karyè, etidye aletranje, istwa — tout pou elèv ayisyen.",
  };
}

/** Series that surface on /ressources */
const RESOURCE_SERIES = new Set([
  "Career",
  "StudyAbroad",
  "HaitiHistory",
  "HaitiFactOfTheDay",
  "HaitianOfTheWeek",
  "HaitiEducationCalendar",
]);

export default async function RessourcesPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  let allArticles: Awaited<ReturnType<typeof fetchEnrichedFeed>>;
  try {
    allArticles = await fetchEnrichedFeed(lang, 200);
  } catch (err) {
    console.error("[EdLight] /ressources fetch failed:", err);
    allArticles = [];
  }

  const resourcePool = allArticles.filter(
    (a) =>
      a.category === "resource" ||
      (a.itemType === "utility" && a.series && RESOURCE_SERIES.has(a.series)),
  );

  const articles = rankAndDeduplicate(resourcePool, {
    audienceFitThreshold: 0.60,
    publisherCap: 4,
    topN: 50,
  });

  const fr = lang === "fr";

  return (
    <div className="space-y-8">
      <section className="section-shell p-0">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-35" />
          <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-emerald-200/35 blur-3xl dark:bg-emerald-500/12" />
          <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                {fr ? "Bibliothèque premium" : "Bibliyotèk premium"}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight dark:text-white sm:text-4xl">
                <BookOpen className="mr-1.5 inline h-7 w-7 text-brand-600 dark:text-brand-400" />
                {fr ? "Ressources" : "Resous"}
              </h1>
              <p className="text-gray-600 dark:text-slate-300">
                {fr
                  ? "Guides, carrière, études à l’étranger, histoire et contenu utilitaire pour progresser plus vite."
                  : "Gid, karyè, etid aletranje, istwa ak kontni itil pou avanse pi vit."}
              </p>
            </div>
            <aside className="premium-glass p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Articles" : "Atik"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{articles.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Tri par défaut" : "Tri default"}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{fr ? "Pertinence" : "Pètinans"}</p>
                </div>
              </div>
              <p className="mt-3 inline-flex items-center gap-1 text-xs text-gray-600 dark:text-slate-300">
                <Library className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                {fr ? "Inclut guides utilitaires + séries étudiantes" : "Gen gid itil + seri pou elèv"}
              </p>
            </aside>
          </div>
        </div>
      </section>

      <SectionFeed
        articles={articles}
        lang={lang}
        defaultSort="relevance"
        emptyMessage={{
          fr: "Aucune ressource disponible pour le moment.",
          ht: "Pa gen resous disponib kounye a.",
        }}
      />
    </div>
  );
}
