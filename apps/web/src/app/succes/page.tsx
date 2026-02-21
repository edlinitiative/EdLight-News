/**
 * /succes — Success & Inspiration feed.
 *
 * Server component: filters articles by category=succes OR keyword inference
 * (see lib/content.ts :: isSuccessArticle).
 * Renders a placeholder section when no matching articles are found.
 */

import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams, isSuccessArticle } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { SectionFeed } from "@/components/SectionFeed";

export const dynamic = "force-dynamic";

export default async function SuccesPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  const allArticles = await fetchEnrichedFeed(lang, 200);

  const succesPool = allArticles.filter(isSuccessArticle);

  const articles = rankAndDeduplicate(succesPool, {
    audienceFitThreshold: 0.60,
    publisherCap: 3,
    topN: 40,
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
            {fr ? "Bientôt…" : "Byento…"}
          </p>
          <p className="mt-2 text-sm">
            {fr
              ? "Des histoires de succès arrivent bientôt. Revenez vite !"
              : "Istwa siksè ap vini byento. Tounen vit !"}
          </p>
        </div>
      )}
    </div>
  );
}
