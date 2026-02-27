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
    <div className="space-y-6">
      <header>
        <div className="section-rule" />
        <div className="mt-3 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-stone-900 dark:text-white">
            <Award className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            {fr ? "Succès & Inspiration" : "Siksè & Enspirasyon"}
          </h1>
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {articles.length} {fr ? "articles" : "atik"}
          </span>
        </div>
      </header>

      {articles.length > 0 ? (
        <SectionFeed
          articles={articles}
          lang={lang}
          defaultSort="relevance"
        />
      ) : (
        <div className="section-shell border-2 border-dashed py-24 text-center text-stone-400 dark:text-stone-500">
          <p className="text-lg font-medium">
            {fr ? "Aucun profil publié récemment." : "Pa gen pwofil pibliye dènyèman."}
          </p>
        </div>
      )}
    </div>
  );
}
