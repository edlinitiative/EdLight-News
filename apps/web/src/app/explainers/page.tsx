/**
 * /explainers — Explainers & analysis category page.
 *
 * Surfaces synthesis / explainer-type content from the enriched feed.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Lightbulb } from "lucide-react";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { NewsFeed } from "@/components/news-feed";
import { PageHeader } from "@/components/PageHeader";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Explainers · EdLight News" : "Eksplikasyon · EdLight News";
  const description = fr
    ? "Des dossiers clairs pour comprendre les enjeux complexes : politique, économie, science, droits."
    : "Dosye klè pou konprann pwoblèm konplèks: politik, ekonomi, syans, dwa.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/explainers", lang }),
  };
}

const EXPLAINER_CATS = new Set([
  "explainer", "explainers", "analysis", "synthesis", "analysis", "feature",
  "deep_dive", "guide", "dossier",
]);

const EXPLAINER_KEYWORDS = [
  "explainer", "expliqué", "dossier", "analyse", "analysis", "comprendre",
  "pourquoi", "comment fonctionne", "ce qu'il faut savoir", "tout savoir",
  "guide", "décryptage", "en bref", "eksplike", "konprann",
];

function isExplainerArticle(a: {
  itemType?: string | null;
  category?: string | null;
  title?: string | null;
  summary?: string | null;
  vertical?: string | null;
}): boolean {
  if (a.itemType === "synthesis") return true;
  if (EXPLAINER_CATS.has(a.category ?? "")) return true;
  if (a.vertical === "explainers") return true;
  const text = `${a.title ?? ""} ${a.summary ?? ""}`.toLowerCase();
  return EXPLAINER_KEYWORDS.some((kw) => text.includes(kw));
}

export default async function ExplainersPage({
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
    console.error("[EdLight] /explainers fetch failed:", err);
    allArticles = [];
  }

  const explainersPool = allArticles.filter(
    (a) => a.itemType !== "utility" && isExplainerArticle(a),
  );

  const articles = rankAndDeduplicate(explainersPool, {
    audienceFitThreshold: 0.25,
    publisherCap: 5,
    topN: 40,
  });

  const sourceCount = new Set(articles.map((a) => a.sourceName).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={fr ? "Explainers" : "Eksplikasyon"}
        title={
          fr
            ? "Comprendre les enjeux qui comptent."
            : "Konprann pwoblèm ki enpòtan yo."
        }
        icon={<Lightbulb className="h-4 w-4" />}
        stats={[
          { value: String(articles.length), label: fr ? "explainers" : "eksplikasyon" },
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
