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

  const articles = rankAndDeduplicate(haitiOnly, {
    audienceFitThreshold: 0.65,
    publisherCap: 4,
    topN: 40,
  });

  const fr = lang === "fr";

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-stone-900 dark:text-white sm:text-4xl">
          <MapPin className="mr-1.5 inline h-7 w-7 text-blue-600 dark:text-blue-400" />
          {fr ? "Haïti" : "Ayiti"}
        </h1>
        <p className="max-w-2xl text-stone-600 dark:text-stone-300">
          {fr
            ? "Nouvelles locales et actualités éducatives directement d’Haïti."
            : "Nouvèl lokal ak aktualite edikasyon dirèkteman nan Ayiti."}
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {articles.length} {fr ? "articles" : "atik"}
        </p>
      </header>

      <HaitiFeed articles={articles} lang={lang} />
    </div>
  );
}
