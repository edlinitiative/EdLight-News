import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Newspaper, Sparkles, ShieldCheck } from "lucide-react";
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
      <section className="section-shell p-0">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-35" />
          <div className="pointer-events-none absolute -right-12 -top-8 h-44 w-44 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/20" />
          <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                {fr ? "Fil premium" : "Fil premium"}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                <Newspaper className="mr-1.5 inline h-7 w-7 text-brand-600 dark:text-brand-400" />
                {fr ? "Fil — Actualités" : "Fil — Nouvèl"}
              </h1>
              <p className="text-gray-600 dark:text-slate-300">
                {fr
                  ? "Flux complet d’actualités éducatives, classé et dédupliqué pour une lecture plus utile."
                  : "Fil nouvèl edikasyon konplè, klase ak retire doublon pou li pi itil."}
              </p>
            </div>
            <aside className="premium-glass p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Articles" : "Atik"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{articles.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Mode" : "Mòd"}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{fr ? "Étudiant / Tout" : "Etidyan / Tout"}</p>
                </div>
              </div>
              <p className="mt-3 inline-flex items-center gap-1 text-xs text-gray-600 dark:text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                {fr ? "Pré-trié côté serveur (qualité + équilibre éditeurs)" : "Pre-triye sou sèvè a (kalite + ekilib editè)"}
              </p>
            </aside>
          </div>
        </div>
      </section>

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
