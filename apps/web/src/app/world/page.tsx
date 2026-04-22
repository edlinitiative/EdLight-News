/**
 * /world — World news category page.
 *
 * Filters the enriched feed for international/world articles,
 * then renders using the shared NewsFeed component.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Globe } from "lucide-react";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { NewsFeed } from "@/components/news-feed";
import { PageHeader } from "@/components/PageHeader";
import { buildOgMetadata } from "@/lib/og";
import { isTauxDuJourArticle } from "@/lib/tauxFilter";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Monde · EdLight News" : "Mond · EdLight News";
  const description = fr
    ? "Actualités internationales : géopolitique, économie mondiale, éducation et innovation."
    : "Nouvèl entènasyonal : jewopolitik, ekonomi mondyal, edikasyon ak inovasyon.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/world", lang }),
  };
}

// Categories that map to "world / international" content
// Only "news" exists in ItemCategory — others are keyword-fallback targets
const WORLD_CATS = new Set(["news"]);

const WORLD_KEYWORDS = [
  "international", "geopolitics", "géopolitique", "diplomacy", "diplomatie",
  "monde", "world", "global", "ONU", "nations unies", "united nations",
  "union européenne", "NATO", "OTAN", "G7", "G20", "conflict", "conflit",
  "migration", "climat", "climate", "economy", "économie mondiale",
  "mond", "entènasyonal", "jewopolitik",
];

export default async function WorldPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";

  let allArticles: Awaited<ReturnType<typeof fetchEnrichedFeed>>;
  try {
    allArticles = await fetchEnrichedFeed(lang, 200);
  } catch (err) {
    console.error("[EdLight] /world fetch failed:", err);
    allArticles = [];
  }

  // World = not Haiti-specific, not opportunity-only
  const OPPORTUNITY_CATS = new Set([
    "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
  ]);

  const worldPool = allArticles.filter((a) => {
    if (a.itemType === "utility") return false;
    if (isTauxDuJourArticle(a)) return false;
    if (a.geoTag === "HT" || a.category === "local_news") return false;
    if (OPPORTUNITY_CATS.has(a.category ?? "") || a.vertical === "opportunites") return false;
    // Accept world/international articles via category, geoTag, vertical, or keywords
    if (WORLD_CATS.has(a.category ?? "")) return true;
    if (a.vertical === "world") return true;
    if (a.geoTag === "Global" || a.geoTag === "Diaspora") return true;
    // Keyword fallback: scan title+summary for world/international signals
    const text = `${a.title ?? ""} ${a.summary ?? ""}`.toLowerCase();
    return WORLD_KEYWORDS.some((kw) => text.toLowerCase().includes(kw.toLowerCase()));
  });

  const articles = rankAndDeduplicate(worldPool, {
    audienceFitThreshold: 0.35,
    publisherCap: 4,
    topN: 40,
  });

  const sourceCount = new Set(articles.map((a) => a.sourceName).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={fr ? "Monde" : "Mond"}
        title={fr ? "Le monde, pour les lecteurs haïtiens." : "Mond lan, pou lektè ayisyen yo."}
        icon={<Globe className="h-4 w-4" />}
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
