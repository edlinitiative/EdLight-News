/**
 * /haiti — Haiti student news feed.
 *
 * Server component: filters articles by geoTag=HT or category=local_news.
 * Client component (SectionFeed): handles sort toggle (Pertinence / Dernières).
 */

import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { SectionFeed } from "@/components/SectionFeed";

export const dynamic = "force-dynamic";

export default async function HaitiPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  const allArticles = await fetchEnrichedFeed(lang, 200);

  const haitiPool = allArticles.filter(
    (a) => a.geoTag === "HT" || a.category === "local_news",
  );

  const articles = rankAndDeduplicate(haitiPool, {
    audienceFitThreshold: 0.65,
    publisherCap: 4,
    topN: 40,
  });

  const fr = lang === "fr";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {fr ? "Haïti" : "Ayiti"}
        </h1>
        <p className="text-gray-500">
          {fr
            ? "Nouvelles locales et actus éducatives directement d'Haïti."
            : "Nouvèl lokal ak aktualite edikasyon dirèkteman nan Ayiti."}
        </p>
      </div>

      <SectionFeed
        articles={articles}
        lang={lang}
        defaultSort="latest"
        emptyMessage={{
          fr: "Aucun article haïtien disponible pour le moment.",
          ht: "Pa gen atik ayisyen disponib kounye a.",
        }}
      />
    </div>
  );
}
