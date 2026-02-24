/**
 * /ressources — Resources feed.
 *
 * Server component: includes category=resource items AND utility magazine
 * posts (series: Career, StudyAbroad, HaitiHistory, HaitiFactOfTheDay,
 * HaitianOfTheWeek).
 * Client component (SectionFeed): handles sort toggle (Pertinence / Dernières).
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { SectionFeed } from "@/components/SectionFeed";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  return {
    title: fr ? "Ressources · EdLight News" : "Resous · EdLight News",
    description: fr
      ? "Guides, carrière, étudier à l'étranger, histoire — tout pour les étudiants haïtiens."
      : "Gid, karyè, etidye aletranje, istwa — tout pou elèv ayisyen.",
  };
}

/** Series that surface on /ressources */
const RESOURCE_SERIES = new Set([
  "Career",
  "StudyAbroad",
  "HaitiHistory",
  "HaitiFactOfTheDay",
  "HaitianOfTheWeek",
  "HaitiEducationCalendar",
]);

export default async function RessourcesPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  let allArticles: Awaited<ReturnType<typeof fetchEnrichedFeed>>;
  try {
    allArticles = await fetchEnrichedFeed(lang, 200);
  } catch (err) {
    console.error("[EdLight] /ressources fetch failed:", err);
    allArticles = [];
  }

  const resourcePool = allArticles.filter(
    (a) =>
      a.category === "resource" ||
      (a.itemType === "utility" && a.series && RESOURCE_SERIES.has(a.series)),
  );

  const articles = rankAndDeduplicate(resourcePool, {
    audienceFitThreshold: 0.60,
    publisherCap: 4,
    topN: 50,
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
            ? "Guides, carrière, étudier à l'étranger, histoire — tout pour les étudiants haïtiens."
            : "Gid, karyè, etidye aletranje, istwa — tout pou elèv ayisyen."}
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
