import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Newspaper } from "lucide-react";
import { NewsFeed } from "@/components/news-feed";
import { PageHero } from "@/components/PageHero";
import { TauxDuJourWidget } from "@/components/TauxDuJourWidget";
import { fetchTauxBRH } from "@/lib/brh";
import { fetchEnrichedFeed } from "@/lib/content";
import { rankFeed } from "@/lib/ranking";
import { getLangFromSearchParams } from "@/lib/content";
import { Suspense } from "react";
import { buildOgMetadata } from "@/lib/og";
import { withLangParam } from "@/lib/utils";

export const revalidate = 60;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Fil — Actualités · EdLight News" : "Fil — Nouvèl · EdLight News";
  const description = fr
    ? "Toute l'actualité éducative pour les étudiants haïtiens."
    : "Tout nouvèl edikasyon pou elèv ayisyen yo.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/news", lang }),
  };
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: { lang?: string; category?: string; mode?: string };
}) {
  const language: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";
  const l = (href: string) => withLangParam(href, language);

  // Fetch BRH rates + enriched articles in parallel
  const [taux, enrichedRaw] = await Promise.all([
    fetchTauxBRH().catch(() => null),
    fetchEnrichedFeed(language, 200).catch((err) => {
      console.error("[EdLight] /news fetch failed:", err);
      return [] as Awaited<ReturnType<typeof fetchEnrichedFeed>>;
    }),
  ]);
  const enriched = enrichedRaw;

  // Server-side ranking:
  //   - drop offMission items
  //   - drop scored items below 0.65 (legacy/unscored items always pass)
  //   - dedupe by dedupeGroupId (keep newest publishedAt)
  //   - sort by audienceFitScore desc → publishedAt desc
  //   - max 3 articles from same publisher within top 20
  const articles = rankFeed(enriched, {
    audienceFitThreshold: 0.40,
    publisherCap: 3,
    topN: 20,
  });

  const fr = language === "fr";
  const synthesisCount = articles.filter((article) => article.itemType === "synthesis").length;
  const haitiCount = articles.filter((article) => article.geoTag === "HT").length;

  return (
    <div className="space-y-8">
      {/* Daily exchange-rate widget (UI-only feature) */}
      <TauxDuJourWidget lang={language} data={taux} />

      <PageHero
        variant="news"
        eyebrow={fr ? "Fil éditorial EdLight" : "Fil editoryal EdLight"}
        title={
          fr
            ? "Toute l'actualité utile aux étudiants haïtiens."
            : "Tout nouvèl itil pou elèv ayisyen yo."
        }
        description={
          fr
            ? "Un fil éditorial trié pour l'utilité étudiante, avec synthèses, contexte local et mises à jour rapides."
            : "Yon fil editoryal ki klase pou itilite etidyan yo, ak sentèz, kontèks lokal ak mizajou rapid."
        }
        icon={<Newspaper className="h-5 w-5" />}
        actions={[
          { href: l("/haiti"), label: fr ? "Voir Haïti" : "Gade Ayiti" },
          { href: l("/succes"), label: fr ? "Succès & inspiration" : "Siksè & enspirasyon" },
        ]}
        stats={[
          { value: String(articles.length), label: fr ? "articles" : "atik" },
          { value: String(synthesisCount), label: fr ? "synthèses" : "sentèz" },
          { value: String(haitiCount), label: fr ? "sujets Haïti" : "sijè Ayiti" },
        ]}
      >
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            fr ? "Vérifié et synthétisé" : "Verifye epi senteze",
            fr ? "Classement étudiant d'abord" : "Klasman etidyan an premye",
            fr ? "Sources multiples" : "Plizyè sous",
          ].map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-stone-200/80 bg-white px-3.5 py-1 text-xs font-semibold text-stone-600 shadow-sm ring-1 ring-inset ring-stone-200/50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-600/30"
            >
              {chip}
            </span>
          ))}
        </div>
      </PageHero>

      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="h-64 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-800" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-stone-100 dark:bg-stone-800" />
              ))}
            </div>
          </div>
        }
      >
        <NewsFeed articles={articles} serverLang={language} preRanked />
      </Suspense>
    </div>
  );
}
