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
import { PageHero } from "@/components/PageHero";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { SectionFeed } from "@/components/SectionFeed";
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
  const l = (href: string) => withLangParam(href, lang);

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
    audienceFitThreshold: 0.40,
    publisherCap: 4,
    topN: 50,
  });

  const fr = lang === "fr";
  const utilityCount = articles.filter((article) => article.itemType === "utility").length;
  const seriesCount = new Set(
    resourcePool.map((article) => article.series).filter(Boolean),
  ).size;

  return (
    <div className="space-y-8">
      <PageHero
        variant="resources"
        eyebrow={fr ? "Guides et repères" : "Gid ak referans"}
        title={
          fr
            ? "Des ressources pratiques pour avancer plus vite."
            : "Resous pratik pou avanse pi vit."
        }
        description={
          fr
            ? "Guides, carrière, études à l'étranger, histoire et contenu utilitaire pour passer de l'information à l'action."
            : "Gid, karyè, etid aletranje, istwa ak kontni itil pou pase soti nan enfòmasyon rive nan aksyon."
        }
        icon={<BookOpen className="h-5 w-5" />}
        actions={[
          { href: l("/parcours"), label: fr ? "Explorer les parcours" : "Eksplore pakou yo" },
          { href: l("/histoire"), label: fr ? "Voir l'histoire" : "Wè istwa a" },
        ]}
        stats={[
          { value: String(articles.length), label: fr ? "ressources" : "resous" },
          { value: String(utilityCount), label: fr ? "formats utiles" : "fòma itil" },
          { value: String(seriesCount), label: fr ? "séries" : "seri" },
        ]}
      />

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
