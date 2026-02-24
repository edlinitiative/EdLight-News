/**
 * /haiti — Haiti student news feed.
 *
 * Server component: fetches candidate articles, then hard-filters through
 * `getItemGeo` so **only** Haiti-relevant items reach the client.
 *
 * Client component (HaitiFeed): handles sort + optional "Étudiants" toggle.
 */

import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { getItemGeo } from "@/lib/itemGeo";
import { HaitiFeed } from "@/components/HaitiFeed";

export const revalidate = 300;

export default async function HaitiPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  let allArticles: Awaited<ReturnType<typeof fetchEnrichedFeed>>;
  try {
    allArticles = await fetchEnrichedFeed(lang, 200);
  } catch (err) {
    console.error("[EdLight] /haiti fetch failed:", err);
    allArticles = [];
  }

  // ── Candidate pool: same broad query as before ──────────────────────────
  const candidatePool = allArticles.filter(
    (a) => a.geoTag === "HT" || a.category === "local_news",
  );

  // ── Hard geo filter: only truly Haiti-related items survive ─────────────
  const haitiOnly = candidatePool.filter(
    (a) => getItemGeo({ ...a, summary: a.summary ?? "" }) === "Haiti",
  );

  const articles = rankAndDeduplicate(haitiOnly, {
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

      <HaitiFeed articles={articles} lang={lang} />
    </div>
  );
}
