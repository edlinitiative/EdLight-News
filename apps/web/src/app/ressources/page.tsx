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
import { BookOpen } from "lucide-react";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { SectionFeed } from "@/components/SectionFeed";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Ressources · EdLight News" : "Resous · EdLight News";
  const description = fr
    ? "Guides, carrière, étudier à l'étranger, histoire — tout pour les étudiants haïtiens."
    : "Gid, karyè, etidye aletranje, istwa — tout pou elèv ayisyen.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/ressources", lang }),
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
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          <BookOpen className="mr-1.5 inline h-7 w-7 text-brand-600 dark:text-brand-400" />
          {fr ? "Ressources" : "Resous"}
        </h1>
        <p className="max-w-2xl text-gray-600 dark:text-slate-300">
          {fr
            ? "Guides, carrière, études à l’étranger, histoire et contenu utilitaire pour progresser plus vite."
            : "Gid, karyè, etid aletranje, istwa ak kontni itil pou avanse pi vit."}
        </p>
      </header>

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
