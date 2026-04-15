/**
 * /haiti — Haiti student news feed.
 *
 * Server component: fetches candidate articles, then hard-filters through
 * `getItemGeo` so **only** Haiti-relevant items reach the client.
 *
 * Client component (HaitiFeed): handles sort + optional "Étudiants" toggle.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { MapPin } from "lucide-react";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { getItemGeo, isStudentFocused } from "@/lib/itemGeo";
import { isTauxDuJourArticle } from "@/lib/tauxFilter";
import { HaitiFeed } from "@/components/HaitiFeed";
import { buildOgMetadata } from "@/lib/og";
import { PageHero } from "@/components/PageHero";
import { withLangParam } from "@/lib/utils";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Haïti · EdLight News" : "Ayiti · EdLight News";
  const description = fr
    ? "Nouvelles locales et actualités éducatives directement d'Haïti."
    : "Nouvèl lokal ak aktualite edikasyon dirèkteman nan Ayiti.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/haiti", lang }),
  };
}

export default async function HaitiPage({
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
    console.error("[EdLight] /haiti fetch failed:", err);
    allArticles = [];
  }

  // ── Candidate pool: same broad query as before ──────────────────────────
  const candidatePool = allArticles.filter(
    (a) => a.vertical === "haiti" || a.geoTag === "HT" || a.category === "local_news",
  );

  // ── Hard geo filter: only truly Haiti-related items survive ─────────────
  const haitiOnly = candidatePool.filter(
    (a) => getItemGeo({ ...a, summary: a.summary ?? "" }) === "Haiti",
  );

  const ranked = rankAndDeduplicate(haitiOnly, {
    audienceFitThreshold: 0.40,
    publisherCap: 4,
    topN: 40,
  });

  // Suppress "taux du jour" articles — the TauxDuJourWidget handles rates
  const articles = ranked.filter((a) => !isTauxDuJourArticle(a));

  const fr = lang === "fr";
  const studentFocusedCount = articles.filter((article) => isStudentFocused(article)).length;
  const sourceCount = new Set(articles.map((article) => article.sourceName).filter(Boolean)).size;

  return (
    <div className="space-y-7">
      <PageHero
        variant="news"
        eyebrow={fr ? "Edition locale" : "Edisyon lokal"}
        title={fr ? "L'actualité étudiante vue depuis Haïti." : "Aktyalite etidyan an dirèk depi Ayiti."}
        description={
          fr
            ? "Un flux resserré sur les annonces, examens, campus et nouvelles locales qui comptent vraiment pour les étudiants haïtiens."
            : "Yon fil pi sere sou anons, egzamen, kanpis ak nouvèl lokal ki vrèman enpòtan pou elèv ayisyen yo."
        }
        icon={<MapPin className="h-5 w-5" />}
        actions={[
          { href: l("/news"), label: fr ? "Tout le fil" : "Tout fil la" },
          { href: l("/calendrier"), label: fr ? "Voir le calendrier" : "Wè kalandriye a" },
        ]}
        stats={[
          { value: String(articles.length), label: fr ? "articles" : "atik" },
          { value: String(studentFocusedCount), label: fr ? "mode étudiants" : "mòd etidyan" },
          { value: String(sourceCount), label: fr ? "sources" : "sous" },
        ]}
      />

      <HaitiFeed articles={articles} lang={lang} />
    </div>
  );
}
