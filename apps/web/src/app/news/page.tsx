import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Newspaper } from "lucide-react";
import { NewsFeed } from "@/components/news-feed";
import { PageHeader } from "@/components/PageHeader";
import { TauxDuJourWidget } from "@/components/TauxDuJourWidget";
import { fetchTauxBRH } from "@/lib/brh";
import { fetchEnrichedFeed } from "@/lib/content";
import { rankFeed } from "@/lib/ranking";
import { getLangFromSearchParams } from "@/lib/content";
import { Suspense } from "react";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 60;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  try {
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
  } catch (err) {
    console.error(
      "[EdLight] /news generateMetadata failed:",
      err instanceof Error ? err.stack ?? err.message : err,
    );
    return {
      title: "Fil — Actualités · EdLight News",
      description: "Toute l'actualité éducative pour les étudiants haïtiens.",
    };
  }
}

export default async function NewsPage({
  searchParams,
}: {
  searchParams: { lang?: string; category?: string; mode?: string };
}) {
  const language: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";

  // ── Defensive data prep ──────────────────────────────────────────────────
  // Every individual fetch and the post-processing pipeline is wrapped in a
  // try/catch so a single bad item or transient Firestore error can't crash
  // the entire route segment. The actual error (with full stack) is logged
  // server-side so it shows up in Vercel logs even though the client only
  // sees the production-stripped digest.
  let taux: Awaited<ReturnType<typeof fetchTauxBRH>> = null;
  try {
    taux = await fetchTauxBRH();
  } catch (err) {
    console.error("[EdLight] /news fetchTauxBRH failed:", err);
  }

  let enrichedRaw: Awaited<ReturnType<typeof fetchEnrichedFeed>> = [];
  try {
    enrichedRaw = await fetchEnrichedFeed(language, 200);
  } catch (err) {
    console.error(
      "[EdLight] /news fetchEnrichedFeed failed:",
      err instanceof Error ? err.stack ?? err.message : err,
    );
  }

  let articles: Awaited<ReturnType<typeof fetchEnrichedFeed>> = [];
  let synthesisCount = 0;
  let haitiCount = 0;
  try {
    // Drop utility items (histoire du jour, daily facts, scholarship radar,
    // etc.). They have dedicated surfaces (/histoire, /opportunites,
    // /ressources) and their summaries are structured chronologies that
    // don't render as standalone news cards.
    const enriched = enrichedRaw.filter((a) => a.itemType !== "utility");

    // Server-side ranking:
    //   - drop offMission items
    //   - drop scored items below 0.40 (legacy/unscored items always pass)
    //   - dedupe by dedupeGroupId (keep newest publishedAt)
    //   - sort by audienceFitScore desc → publishedAt desc
    //   - max 3 articles from same publisher within top 20
    articles = rankFeed(enriched, {
      audienceFitThreshold: 0.40,
      publisherCap: 3,
      topN: 20,
    });
    synthesisCount = articles.filter((a) => a.itemType === "synthesis").length;
    haitiCount = articles.filter((a) => a.geoTag === "HT").length;
  } catch (err) {
    // Don't rethrow — render an empty feed rather than crashing /news.
    console.error(
      "[EdLight] /news rankFeed/processing failed:",
      err instanceof Error ? err.stack ?? err.message : err,
    );
    articles = [];
  }

  const fr = language === "fr";

  return (
    <div className="space-y-8">
      {/* Daily exchange-rate widget (UI-only feature) */}
      <TauxDuJourWidget lang={language} data={taux} />

      <PageHeader
        eyebrow={fr ? "Fil éditorial" : "Fil editoryal"}
        title={
          fr
            ? "Toute l'actualité utile aux étudiants haïtiens."
            : "Tout nouvèl itil pou elèv ayisyen yo."
        }
        icon={<Newspaper className="h-4 w-4" />}
        stats={[
          { value: String(articles.length), label: fr ? "articles" : "atik" },
          { value: String(synthesisCount), label: fr ? "synthèses" : "sentèz" },
          { value: String(haitiCount), label: fr ? "Haïti" : "Ayiti" },
        ]}
      />

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
