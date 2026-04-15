/**
 * /opinion — Opinion & Insights feed page.
 *
 * Surfaces opinion-type articles: analysis, commentary, and insight pieces.
 * Filters by itemType === "opinion" from the enriched feed.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Feather } from "lucide-react";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { NewsFeed } from "@/components/news-feed";
import { PageHero } from "@/components/PageHero";
import { buildOgMetadata } from "@/lib/og";
import { withLangParam } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Opinion · EdLight News" : "Opinyon · EdLight News";
  const description = fr
    ? "Analyses, commentaires et perspectives sur l'éducation, la société et l'avenir des étudiants haïtiens."
    : "Analiz, kòmantè ak pèspektiv sou edikasyon, sosyete ak avni elèv ayisyen yo.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/opinion", lang }),
  };
}

export default async function OpinionPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const l = (href: string) => withLangParam(href, lang);
  const fr = lang === "fr";

  let allArticles: Awaited<ReturnType<typeof fetchEnrichedFeed>>;
  try {
    allArticles = await fetchEnrichedFeed(lang, 200);
  } catch (err) {
    console.error("[EdLight] /opinion fetch failed:", err);
    allArticles = [];
  }

  const opinionPool = allArticles.filter((a) => a.itemType === "opinion");

  const articles = rankAndDeduplicate(opinionPool, {
    audienceFitThreshold: 0.3,
    publisherCap: 4,
    topN: 40,
  });

  const sourceCount = new Set(articles.map((a) => a.sourceName).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <PageHero
        variant="news"
        eyebrow={fr ? "Analyse & Perspectives" : "Analiz & Pèspektiv"}
        title={
          fr
            ? "Opinions éclairées sur les sujets qui comptent."
            : "Opinyon klere sou sijè ki enpòtan yo."
        }
        description={
          fr
            ? "Analyses, commentaires et perspectives de la rédaction sur l'éducation, la société et l'avenir en Haïti."
            : "Analiz, kòmantè ak pèspektiv redaksyon an sou edikasyon, sosyete ak avni an Ayiti."
        }
        icon={<Feather className="h-5 w-5" />}
        actions={[
          { href: l("/news"), label: fr ? "Tout le fil" : "Tout fil la" },
          { href: l("/explainers"), label: fr ? "Explainers" : "Eksplike" },
        ]}
        stats={[
          { value: String(articles.length), label: fr ? "articles" : "atik" },
          { value: String(sourceCount), label: fr ? "sources" : "sous" },
        ]}
      />

      {articles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 p-10 text-center dark:border-stone-700">
          <Feather className="mx-auto h-8 w-8 text-stone-300 dark:text-stone-600" />
          <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
            {fr
              ? "Aucun article d'opinion pour le moment. Revenez bientôt !"
              : "Pa gen atik opinyon pou kounye a. Tounen byento !"}
          </p>
        </div>
      ) : (
        <section className="pb-10">
          <NewsFeed
            articles={articles}
            serverLang={lang}
            preRanked
          />
        </section>
      )}
    </div>
  );
}
