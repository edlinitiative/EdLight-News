/**
 * /ressources — Resources feed.
 *
 * Server component: filters articles by category=resource.
 * Client component (SectionFeed): handles sort toggle (Pertinence / Dernières).
 */

import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { SectionFeed } from "@/components/SectionFeed";

export const dynamic = "force-dynamic";

export default async function RessourcesPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  const allArticles = await fetchEnrichedFeed(lang, 200);

  const resourcePool = allArticles.filter((a) => a.category === "resource");

  const articles = rankAndDeduplicate(resourcePool, {
    audienceFitThreshold: 0.65,
    publisherCap: 4,
    topN: 40,
  });

  const fr = lang === "fr";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {fr ? "Ressources" : "Resous"}
        </h1>
        <p className="text-gray-500">
          {fr
            ? "Guides, outils et ressources pour les étudiants haïtiens."
            : "Gid, zouti ak resous pou elèv ayisyen."}
        </p>
      </div>

      <SectionFeed
        articles={articles}
        lang={lang}
        defaultSort="relevance"
        emptyMessage={{
          fr: "Aucune ressource disponible pour le moment.",
          ht: "Pa gen resous disponib kounye a.",
        }}
      />
    </div>
  );
}
