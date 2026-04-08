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
import { PageHero } from "@/components/PageHero";
import { buildOgMetadata } from "@/lib/og";
import { withLangParam } from "@/lib/utils";
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
const WORLD_CATS = new Set([
  "news",
  "world",
  "international",
  "geopolitics",
  "economy",
  "global",
]);

export default async function WorldPage({
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
    console.error("[EdLight] /world fetch failed:", err);
    allArticles = [];
  }

  // World = not Haiti-specific, not opportunity-only
  const OPPORTUNITY_CATS = new Set([
    "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
  ]);

  const worldPool = allArticles.filter((a) => {
    if (isTauxDuJourArticle(a)) return false;
    if (a.geoTag === "HT" || a.category === "local_news") return false;
    if (OPPORTUNITY_CATS.has(a.category ?? "") || a.vertical === "opportunites") return false;
    // Accept broad news / world category items, including untagged general news
    return (
      WORLD_CATS.has(a.category ?? "") ||
      a.category === "news" ||
      a.geoTag === "GLOBAL" ||
      a.geoTag == null ||
      a.geoTag === ""
    );
  });

  const articles = rankAndDeduplicate(worldPool, {
    audienceFitThreshold: 0.35,
    publisherCap: 4,
    topN: 40,
  });

  const sourceCount = new Set(articles.map((a) => a.sourceName).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <PageHero
        variant="news"
        eyebrow={fr ? "Actualités internationales" : "Nouvèl entènasyonal"}
        title={fr ? "Le monde, pour les lecteurs haïtiens." : "Mond lan, pou lektè ayisyen yo."}
        description={
          fr
            ? "Géopolitique, économie mondiale, innovation, droits humains — une lecture internationale utile et accessible."
            : "Jewopolitik, ekonomi mondyal, inovasyon, dwa moun — yon lekti entènasyonal itil ak aksesib."
        }
        icon={<Globe className="h-5 w-5" />}
        actions={[
          { href: l("/haiti"), label: fr ? "Voir Haïti" : "Wè Ayiti" },
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
