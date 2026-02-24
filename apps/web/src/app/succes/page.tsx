/**
 * /succes — Success & Inspiration feed.
 *
 * Strict gating: only items with successTag === true
 * OR utilityMeta.series === "HaitianOfTheWeek" are shown.
 * No fallback to generic news.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams, isSuccessArticle } from "@/lib/content";
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
    title: fr ? "Succès & Inspiration · EdLight News" : "Siksè & Enspirasyon · EdLight News",
    description: fr
      ? "Des histoires de réussite qui inspirent la communauté haïtienne."
      : "Istwa siksè ki enspire kominote ayisyèn nan.",
  };
}

export default async function SuccesPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  let allArticles: Awaited<ReturnType<typeof fetchEnrichedFeed>>;
  try {
    allArticles = await fetchEnrichedFeed(lang, 200);
  } catch (err) {
    console.error("[EdLight] /succes fetch failed:", err);
    allArticles = [];
  }

  // Strict gating — no keyword fallback
  const successPool = allArticles.filter(isSuccessArticle);

  // Deduplicate + rank (same pipeline as other pages)
  const articles = rankAndDeduplicate(successPool, {
    audienceFitThreshold: 0.5,
    publisherCap: 4,
    topN: 12,
  });

  const fr = lang === "fr";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">
          {fr ? "Succès & Inspiration" : "Siksè & Enspirasyon"}
        </h1>
        <p className="text-gray-500">
          {fr
            ? "Des histoires de réussite qui inspirent la communauté haïtienne."
            : "Istwa siksè ki enspire kominote ayisyèn nan."}
        </p>
      </div>

      {articles.length > 0 ? (
        <SectionFeed
          articles={articles}
          lang={lang}
          defaultSort="relevance"
        />
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-24 text-center text-gray-400">
          <p className="text-lg font-medium">
            {fr ? "Aucun profil publié récemment." : "Pa gen pwofil pibliye dènyèman."}
          </p>
        </div>
      )}
    </div>
  );
}
