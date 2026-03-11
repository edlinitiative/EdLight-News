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
import { MapPin } from "lucide-react";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { getItemGeo } from "@/lib/itemGeo";
import { isTauxDuJourArticle } from "@/lib/tauxFilter";
import { HaitiFeed } from "@/components/HaitiFeed";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Haïti · EdLight News" : "Ayiti · EdLight News";
  const description = fr
    ? "Nouvelles locales et actualités éducatives directement d'Haïti."
    : "Nouvèl lokal ak aktualite edikasyon dirèkteman nan Ayiti.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/haiti", lang }),
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

  const ranked = rankAndDeduplicate(haitiOnly, {
    audienceFitThreshold: 0.40,
    publisherCap: 4,
    topN: 40,
  });

  // Suppress "taux du jour" articles — the TauxDuJourWidget handles rates
  const articles = ranked.filter((a) => !isTauxDuJourArticle(a));

  const fr = lang === "fr";

  return (
    <div className="space-y-6">
      <header>
        <div className="section-rule" />
        <div className="mt-3 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-stone-900 dark:text-white">
            <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            {fr ? "Haïti" : "Ayiti"}
          </h1>
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {articles.length} {fr ? "articles" : "atik"}
          </span>
        </div>
      </header>

      <HaitiFeed articles={articles} lang={lang} />
    </div>
  );
}
