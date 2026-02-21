import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { fetchEnrichedArticles } from "@/lib/feed";
import { rankFeed } from "@/lib/ranking";
import { categoryLabel, CATEGORY_COLORS } from "@/lib/utils";

export const dynamic = "force-dynamic";

// ── Article card ────────────────────────────────────────────────────────────

function ArticleCard({
  article,
  lang,
}: {
  article: FeedItem;
  lang: ContentLanguage;
}) {
  const catColor =
    article.category && article.category !== "news"
      ? (CATEGORY_COLORS[article.category] ?? "bg-gray-100 text-gray-600")
      : null;

  return (
    <a
      href={"/news/" + article.id + "?lang=" + lang}
      className="group block rounded-lg border p-5 transition hover:border-brand-300 hover:shadow-md"
    >
      {catColor && (
        <span
          className={
            "mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium " +
            catColor
          }
        >
          {categoryLabel(article.category, lang)}
        </span>
      )}
      <h2 className="mb-2 text-base font-semibold leading-snug group-hover:text-brand-700">
        {article.title}
      </h2>
      <p className="line-clamp-2 text-sm text-gray-500">
        {article.summary || article.body.slice(0, 150)}
      </p>
      {article.sourceName && (
        <p className="mt-3 text-xs text-gray-400">{article.sourceName}</p>
      )}
    </a>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default async function HomePage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";

  // Fetch a generous pool then rank down to 6 curated articles.
  // Threshold 0.80: only high-confidence, on-mission articles surface.
  // Publisher cap 2-in-top-6: no single source dominates the homepage.
  const enriched = await fetchEnrichedArticles(lang, 50);
  const ranked = rankFeed(enriched, {
    audienceFitThreshold: 0.80,
    publisherCap: 2,
    topN: 6,
  });
  const featured = ranked.slice(0, 6);

  const newsHref = "/news" + (lang === "ht" ? "?lang=ht" : "");

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="space-y-4 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">
          {lang === "fr"
            ? "Bienvenu sur EdLight News"
            : "Byenveni sou EdLight News"}
        </h1>
        <p className="mx-auto max-w-xl text-lg text-gray-600">
          {lang === "fr"
            ? "Actualités éducatives, bourses et opportunités pour les étudiants haïtiens — en français et en créole."
            : "Nouvèl edikasyon, bous detid, ak opòtinite pou elèv ayisyen yo — an fransè ak kreyòl."}
        </p>
        <Link
          href={newsHref}
          className="inline-block rounded-lg bg-brand-600 px-6 py-3 text-white hover:bg-brand-700"
        >
          {lang === "fr" ? "Voir toutes les actualités →" : "Wè tout nouvèl yo →"}
        </Link>
      </section>

      {/* Curated featured articles */}
      {featured.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {lang === "fr" ? "Dernières nouvelles" : "Dènye nouvèl"}
            </h2>
            <Link
              href={newsHref}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              {lang === "fr" ? "Voir tout →" : "Wè tout →"}
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((article) => (
              <ArticleCard key={article.id} article={article} lang={lang} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
