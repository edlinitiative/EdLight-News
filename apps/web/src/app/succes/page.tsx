/**
 * /succes — Success & Inspiration feed.
 *
 * Strict gating: only items with successTag === true
 * OR utilityMeta.series === "HaitianOfTheWeek" are shown.
 * No fallback to generic news.
 */

import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams, isSuccessArticle } from "@/lib/content";
import { SectionFeed } from "@/components/SectionFeed";

export const dynamic = "force-dynamic";

export default async function SuccesPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  const allArticles = await fetchEnrichedFeed(lang, 200);

  // Strict gating — no keyword fallback
  const articles = allArticles
    .filter(isSuccessArticle)
    .sort((a, b) => {
      const tA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tB - tA;
    })
    .slice(0, 12);

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
