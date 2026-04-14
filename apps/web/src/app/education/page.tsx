/**
 * /education — Education category page.
 *
 * Surfaces education-tagged articles from the enriched feed.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { BookOpen } from "lucide-react";
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
  const title = fr ? "Éducation · EdLight News" : "Edikasyon · EdLight News";
  const description = fr
    ? "Politique éducative, universités, enseignement supérieur et tendances mondiales en éducation."
    : "Politik edikasyon, inivèsite, ansèyman siperyè ak tandans mondyal nan edikasyon.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/education", lang }),
  };
}

// Education is identified by vertical + keyword matching
// (no ItemCategory value exists for "education" — the enum is for content types)
const EDUCATION_KEYWORDS = [
  "université", "school", "éducation", "education", "enseignement",
  "étudiant", "académique", "lycée", "formation",
  "inivèsite", "elèv", "edikasyon", "recherche", "research",
];

function isEducationArticle(a: { category?: string | null; title?: string | null; summary?: string | null; vertical?: string | null }): boolean {
  if (a.vertical === "education") return true;
  const text = `${a.title ?? ""} ${a.summary ?? ""}`.toLowerCase();
  return EDUCATION_KEYWORDS.some((kw) => text.includes(kw));
}

export default async function EducationPage({
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
    console.error("[EdLight] /education fetch failed:", err);
    allArticles = [];
  }

  const OPPORTUNITY_CATS = new Set([
    "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
  ]);

  const educationPool = allArticles.filter((a) => {
    if (OPPORTUNITY_CATS.has(a.category ?? "") || a.vertical === "opportunites") return false;
    return isEducationArticle(a);
  });

  const articles = rankAndDeduplicate(educationPool, {
    audienceFitThreshold: 0.3,
    publisherCap: 4,
    topN: 40,
  });

  const sourceCount = new Set(articles.map((a) => a.sourceName).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <PageHero
        variant="resources"
        eyebrow={fr ? "Politique et actualité éducatives" : "Politik ak aktualite edikasyon"}
        title={
          fr
            ? "L'éducation au cœur de l'actualité."
            : "Edikasyon nan kè aktualite a."
        }
        description={
          fr
            ? "Universités, réformes éducatives, politiques d'accès et tendances mondiales de l'enseignement."
            : "Inivèsite, refòm edikasyon, politik aksè ak tandans mondyal ansèyman."
        }
        icon={<BookOpen className="h-5 w-5" />}
        actions={[
          { href: l("/bourses"), label: fr ? "Voir les bourses" : "Wè bous yo" },
          { href: l("/opportunites"), label: fr ? "Opportunités" : "Okazyon" },
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
