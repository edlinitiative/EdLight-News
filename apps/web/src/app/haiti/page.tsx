/**
 * /haiti — Haiti student news feed.
 *
 * Server component: fetches candidate articles, then hard-filters through
 * `getItemGeo` so **only** Haiti-relevant items reach the client.
 *
 * Client component (HaitiFeed): handles sort + optional "Étudiants" toggle.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Sparkles, MapPin, Newspaper } from "lucide-react";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { getItemGeo } from "@/lib/itemGeo";
import { HaitiFeed } from "@/components/HaitiFeed";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  return {
    title: fr ? "Haïti · EdLight News" : "Ayiti · EdLight News",
    description: fr
      ? "Nouvelles locales et actualités éducatives directement d'Haïti."
      : "Nouvèl lokal ak aktualite edikasyon dirèkteman nan Ayiti.",
  };
}

export default async function HaitiPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  let allArticles: Awaited<ReturnType<typeof fetchEnrichedFeed>>;
  try {
    allArticles = await fetchEnrichedFeed(lang, 200);
  } catch (err) {
    console.error("[EdLight] /haiti fetch failed:", err);
    allArticles = [];
  }

  // ── Candidate pool: same broad query as before ──────────────────────────
  const candidatePool = allArticles.filter(
    (a) => a.geoTag === "HT" || a.category === "local_news",
  );

  // ── Hard geo filter: only truly Haiti-related items survive ─────────────
  const haitiOnly = candidatePool.filter(
    (a) => getItemGeo({ ...a, summary: a.summary ?? "" }) === "Haiti",
  );

  const articles = rankAndDeduplicate(haitiOnly, {
    audienceFitThreshold: 0.65,
    publisherCap: 4,
    topN: 40,
  });

  const fr = lang === "fr";

  return (
    <div className="space-y-8">
      <section className="section-shell p-0">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-35" />
          <div className="pointer-events-none absolute -left-10 top-0 h-44 w-44 rounded-full bg-red-200/35 blur-3xl dark:bg-red-500/12" />
          <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                {fr ? "Fil local premium" : "Fil lokal premium"}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight dark:text-white sm:text-4xl">
                <MapPin className="mr-1.5 inline h-7 w-7 text-brand-600 dark:text-brand-400" />
                {fr ? "Haïti" : "Ayiti"}
              </h1>
              <p className="text-gray-600 dark:text-slate-300">
                {fr
                  ? "Nouvelles locales et actualités éducatives directement d’Haïti, avec tri et filtre étudiant."
                  : "Nouvèl lokal ak aktualite edikasyon dirèkteman nan Ayiti, ak tri ak filtè etidyan."}
              </p>
            </div>
            <aside className="premium-glass p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Articles" : "Atik"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{articles.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Focus" : "Fokus"}</p>
                  <p className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white"><Newspaper className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />{fr ? "Local + étudiant" : "Lokal + etidyan"}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <HaitiFeed articles={articles} lang={lang} />
    </div>
  );
}
