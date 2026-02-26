/**
 * /succes — Success & Inspiration feed.
 *
 * Strict gating: only items with successTag === true
 * OR utilityMeta.series === "HaitianOfTheWeek" are shown.
 * No fallback to generic news.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Award } from "lucide-react";
import { fetchEnrichedFeed, getLangFromSearchParams, isSuccessArticle } from "@/lib/content";
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
  const title = fr ? "Succès & Inspiration · EdLight News" : "Siksè & Enspirasyon · EdLight News";
  const description = fr
    ? "Des histoires de réussite qui inspirent la communauté haïtienne."
    : "Istwa siksè ki enspire kominote ayisyèn nan.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/succes", lang }),
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
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          {fr ? "Succès & Inspiration" : "Siksè & Enspirasyon"}
        </h1>
        <p className="max-w-2xl text-gray-600 dark:text-slate-300">
          {fr
            ? "Histoires de réussite et profils inspirants pour la communauté haïtienne."
            : "Istwa siksè ak pwofil ki enspire kominote ayisyèn nan."}
        </p>
      </header>

      {articles.length > 0 ? (
        <SectionFeed
          articles={articles}
          lang={lang}
          defaultSort="relevance"
        />
      ) : (
        <div className="section-shell border-2 border-dashed py-24 text-center text-gray-400 dark:text-slate-500">
          <p className="text-lg font-medium">
            {fr ? "Aucun profil publié récemment." : "Pa gen pwofil pibliye dènyèman."}
          </p>
        </div>
      )}
    </div>
  );
}
