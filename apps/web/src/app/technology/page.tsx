/**
 * /technology — Technology category page.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Cpu } from "lucide-react";
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
  const title = fr ? "Technologie · EdLight News" : "Teknoloji · EdLight News";
  const description = fr
    ? "IA, numérique, innovation technologique et leur impact sur la jeunesse haïtienne."
    : "AI, dijital, inovasyon teknolojik ak enpak yo sou jèn ayisyen yo.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/technology", lang }),
  };
}

const TECH_CATS = new Set([
  "technology", "tech", "digital", "ai", "innovation", "science", "coding", "internet",
]);

const TECH_KEYWORDS = [
  "technologie", "technology", "numérique", "digital", "intelligence artificielle",
  "ia", "ai", "innovation", "startup tech", "internet", "application", "logiciel",
  "code", "programmation", "données", "data", "cybersécurité", "teknoloji",
];

function isTechArticle(a: { category?: string | null; title?: string | null; summary?: string | null; vertical?: string | null }): boolean {
  if (TECH_CATS.has(a.category ?? "")) return true;
  if (a.vertical === "technology") return true;
  const text = `${a.title ?? ""} ${a.summary ?? ""}`.toLowerCase();
  return TECH_KEYWORDS.some((kw) => text.includes(kw));
}

export default async function TechnologyPage({
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
    console.error("[EdLight] /technology fetch failed:", err);
    allArticles = [];
  }

  const OPPORTUNITY_CATS = new Set([
    "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
  ]);

  const techPool = allArticles.filter((a) => {
    if (OPPORTUNITY_CATS.has(a.category ?? "") || a.vertical === "opportunites") return false;
    return isTechArticle(a);
  });

  const articles = rankAndDeduplicate(techPool, {
    audienceFitThreshold: 0.3,
    publisherCap: 4,
    topN: 40,
  });

  const sourceCount = new Set(articles.map((a) => a.sourceName).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <PageHero
        variant="news"
        eyebrow={fr ? "Technologie & Innovation" : "Teknoloji & Inovasyon"}
        title={
          fr
            ? "La tech qui transforme le monde haïtien."
            : "Teknoloji ki ap transfòme mond ayisyen an."
        }
        description={
          fr
            ? "Intelligence artificielle, numérique, innovation et leur impact sur l'éducation, l'emploi et la société haïtienne."
            : "Entèlijans atifisyèl, dijital, inovasyon ak enpak yo sou edikasyon, travay ak sosyete ayisyen an."
        }
        icon={<Cpu className="h-5 w-5" />}
        actions={[
          { href: l("/explainers"), label: fr ? "Voir les explainers" : "Wè eksplike yo" },
          { href: l("/news"), label: fr ? "Toutes les actualités" : "Tout nouvèl yo" },
        ]}
        stats={[
          { value: String(articles.length), label: fr ? "articles" : "atik" },
          { value: String(sourceCount), label: fr ? "sources" : "sous" },
        ]}
      />

      <section className="pb-10">
        <NewsFeed
          articles={articles}
          serverLang={lang}
          preRanked
        />
      </section>
    </div>
  );
}
