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
import { PageHero } from "@/components/PageHero";
import { fetchEnrichedFeed, getLangFromSearchParams, isSuccessArticle } from "@/lib/content";
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
  const l = (href: string) => withLangParam(href, lang);

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
    audienceFitThreshold: 0.40,
    publisherCap: 4,
    topN: 12,
  });

  const fr = lang === "fr";
  const profileCount = articles.filter((article) => article.itemType === "utility").length;
  const storyCount = articles.length - profileCount;

  return (
    <div className="space-y-7">
      <PageHero
        variant="success"
        eyebrow={fr ? "Portraits et trajectoires" : "Pòtrè ak trajè"}
        title={
          fr
            ? "Les parcours qui élargissent l'horizon."
            : "Pakou ki louvri plis pòt devan nou."
        }
        description={
          fr
            ? "Des histoires de réussite, de leadership et de persévérance pour montrer ce qui est possible dans la communauté haïtienne."
            : "Istwa siksè, lidèchip ak pèseverans pou montre sa ki posib nan kominote ayisyèn nan."
        }
        icon={<Award className="h-5 w-5" />}
        actions={[
          { href: l("/news"), label: fr ? "Retour au fil" : "Retounen nan fil la" },
          { href: l("/ressources"), label: fr ? "Voir les ressources" : "Wè resous yo" },
        ]}
        stats={[
          { value: String(articles.length), label: fr ? "récits" : "istwa" },
          { value: String(profileCount), label: fr ? "portraits" : "pòtrè" },
          { value: String(storyCount), label: fr ? "articles" : "atik" },
        ]}
      />

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
