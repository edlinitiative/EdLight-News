/**
 * /business — Business & Economy category page.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { TrendingUp } from "lucide-react";
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
  const title = fr ? "Business & Économie · EdLight News" : "Biznis & Ekonomi · EdLight News";
  const description = fr
    ? "Économie haïtienne, entrepreneuriat, marchés mondiaux et carrières pour les jeunes professionnels."
    : "Ekonomi ayisyen, antreprenè, mache mondyal ak karyè pou jèn pwofesyonèl yo.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/business", lang }),
  };
}

const BUSINESS_CATS = new Set([
  "business", "economy", "finance", "entrepreneurship", "market", "career",
  "economics", "startup", "work", "employment",
]);

const BUSINESS_KEYWORDS = [
  "économie", "economy", "business", "entreprise", "startup", "marché",
  "finance", "emploi", "carrière", "investissement", "croissance",
  "commerce", "salaire", "travail", "entrepwenè", "ekonomi", "biznis",
];

function isBusinessArticle(a: { category?: string | null; title?: string | null; summary?: string | null; vertical?: string | null }): boolean {
  if (BUSINESS_CATS.has(a.category ?? "")) return true;
  if (a.vertical === "business") return true;
  const text = `${a.title ?? ""} ${a.summary ?? ""}`.toLowerCase();
  return BUSINESS_KEYWORDS.some((kw) => text.includes(kw));
}

export default async function BusinessPage({
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
    console.error("[EdLight] /business fetch failed:", err);
    allArticles = [];
  }

  const OPPORTUNITY_CATS = new Set([
    "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
  ]);

  const businessPool = allArticles.filter((a) => {
    if (OPPORTUNITY_CATS.has(a.category ?? "") || a.vertical === "opportunites") return false;
    return isBusinessArticle(a);
  });

  const articles = rankAndDeduplicate(businessPool, {
    audienceFitThreshold: 0.3,
    publisherCap: 4,
    topN: 40,
  });

  const sourceCount = new Set(articles.map((a) => a.sourceName).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <PageHero
        variant="success"
        eyebrow={fr ? "Business & Économie" : "Biznis & Ekonomi"}
        title={
          fr
            ? "Économie, entrepreneuriat et carrières."
            : "Ekonomi, antreprenèrya ak karyè."
        }
        description={
          fr
            ? "Actualités économiques haïtiennes et mondiales, conseils carrière, entrepreneuriat et tendances des marchés."
            : "Nouvèl ekonomik ayisyen ak mondyal, konsèy karyè, antreprenèrya ak tandans mache yo."
        }
        icon={<TrendingUp className="h-5 w-5" />}
        actions={[
          { href: l("/opportunites"), label: fr ? "Voir les opportunités" : "Wè okazyon yo" },
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
