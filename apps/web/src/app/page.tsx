/**
 * Accueil — EdLight News editorial homepage.
 *
 * Design philosophy: text-first, newspaper density.
 *  Sections (top → bottom):
 *  1. Dateline bar
 *  2. Front page — lead (headline + compact image) + 3-col secondary text grid
 *  3. News grid — 6 articles, no images, 3 columns
 *  4. Latest + Trending — text feed (left) + ranked sidebar (right)
 *  5. Histoire du jour — compact dark band
 *  6. Opportunités — 2-col text list
 *  7. Newsletter
 */

import Link from "next/link";
import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import {
  fetchEnrichedFeed,
  fetchTrending,
  getLangFromSearchParams,
} from "@/lib/content";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { NewsletterForm } from "@/components/NewsletterForm";
import { CategoryBadge } from "@/components/CategoryBadge";
import { isTauxDuJourArticle } from "@/lib/tauxFilter";
import { contentLooksLikeOpportunity } from "@/lib/opportunityClassifier";
import { buildOgMetadata } from "@/lib/og";
import { withLangParam, formatRelativeDate, categoryLabel } from "@/lib/utils";
import { rankFeed } from "@/lib/ranking";
import type { FeedItem } from "@/components/news-feed";

export const revalidate = 60;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr
    ? "EdLight News — Actualités éducatives pour étudiants haïtiens"
    : "EdLight News — Nouvèl edikasyon pou elèv ayisyen yo";
  const description = fr
    ? "Bourses, calendrier, ressources et actualités pour les étudiants haïtiens."
    : "Bous, kalandriye, resous ak nouvèl pou elèv ayisyen yo.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/", lang }),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const OPPORTUNITY_CATS = new Set([
  "scholarship",
  "opportunity",
  "bourses",
  "concours",
  "stages",
  "programmes",
]);

function isOpportunity(a: FeedItem): boolean {
  const catIsOpp =
    a.vertical === "opportunites" || OPPORTUNITY_CATS.has(a.category ?? "");
  if (!catIsOpp) return false;
  return contentLooksLikeOpportunity(a.title ?? "", a.summary);
}

function normalizedCategory(a: FeedItem): string | null {
  const cat = a.category ?? "";
  if (!cat) return null;

  const haitiLike = a.geoTag === "HT" || a.vertical === "haiti";

  // Prevent misclassified opportunity tags on regular news.
  if ((a.vertical === "opportunites" || OPPORTUNITY_CATS.has(cat)) && !isOpportunity(a)) {
    return haitiLike ? "local_news" : "news";
  }

  // Utility facts often come through as "resource" but read like news.
  if (cat === "resource" && a.itemType === "utility" && a.utilityType === "daily_fact") {
    return haitiLike ? "local_news" : "news";
  }

  return cat;
}

function categoryTagText(a: FeedItem, lang: ContentLanguage): string | null {
  const key = normalizedCategory(a);
  if (!key) return null;
  return categoryLabel(key, lang);
}

/** Thin rule with centred label + optional "voir tout" link */
function SectionRule({
  label,
  href,
  linkLabel,
}: {
  label: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.22em] text-stone-900 dark:text-white">
        {label}
      </span>
      <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      {href && linkLabel && (
        <Link
          href={href}
          className="shrink-0 text-[10px] font-semibold text-primary hover:underline"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

/** Left-ruled section header (used inside multi-column areas) */
function ColumnHeader({ label }: { label: string }) {
  return (
    <p className="mb-3 border-t-2 border-stone-900 dark:border-white pt-2 text-[10px] font-black uppercase tracking-[0.22em] text-stone-900 dark:text-white">
      {label}
    </p>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AccueilPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";
  const lq = (path: string) => withLangParam(path, lang);
  const fr = lang === "fr";

  const safeFetch = async <T,>(
    fn: () => Promise<T>,
    fallback: T,
    label: string,
  ): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      console.error(`[EdLight] ${label} fetch failed:`, err);
      return fallback;
    }
  };

  const [rawFeed, trendingArticles] = await Promise.all([
    safeFetch(() => fetchEnrichedFeed(lang, 100), [], "enrichedFeed"),
    safeFetch(() => fetchTrending(lang, 8), [], "trending"),
  ]);

  const filteredFeed = rawFeed.filter((a) => !isTauxDuJourArticle(a));

  const rankedFeed = rankFeed(filteredFeed, {
    audienceFitThreshold: 0.3,
    publisherCap: 3,
    topN: 30,
  });

  // ── Segments ──────────────────────────────────────────────────────────────
  const opportunities = rankedFeed.filter(isOpportunity);
  const newsPool = rankedFeed.filter((a) => !isOpportunity(a));

  // Lead: prefer articles with images
  const leadArticle = newsPool.find((a) => !!a.imageUrl) ?? newsPool[0] ?? null;
  const usedIds = new Set(leadArticle ? [leadArticle.id] : []);

  // Secondary (right of lead) — 3 text-only articles
  const secondaryHero = newsPool
    .filter((a) => !usedIds.has(a.id))
    .slice(0, 3);
  secondaryHero.forEach((a) => usedIds.add(a.id));

  // News grid — 6 articles, text-only 3-col, after the front page
  const newsGrid = newsPool
    .filter((a) => !usedIds.has(a.id))
    .slice(0, 6);
  newsGrid.forEach((a) => usedIds.add(a.id));

  // Latest — chronological, not utility, skip already shown
  const latestNews = filteredFeed
    .filter(
      (a) => !usedIds.has(a.id) && !isOpportunity(a) && a.itemType !== "utility",
    )
    .slice(0, 8);
  const latestNewsIds = new Set(latestNews.map((a) => a.id));

  const histoireArticle =
    filteredFeed.find(
      (a) => a.itemType === "utility" && a.utilityType === "history",
    ) ?? null;

  const featuredOpp = opportunities[0] ?? null;
  const moreOpps = opportunities.slice(1, 6);

  const trendingStories = (() => {
    const deduped = trendingArticles.filter(
      (a) => !usedIds.has(a.id) && !latestNewsIds.has(a.id),
    );
    return (
      deduped.length >= 3
        ? deduped
        : trendingArticles.filter((a) => !usedIds.has(a.id))
    ).slice(0, 6);
  })();

  // ── Dateline ──────────────────────────────────────────────────────────────
  const todayLabel = new Date()
    .toLocaleDateString(fr ? "fr-FR" : "ht-HT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Port-au-Prince",
    })
    .replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="pb-24">

      {/* ── Dateline bar ─────────────────────────────────────────────────── */}
      <div className="border-b border-stone-200 dark:border-stone-800 py-2">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <p className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-600 capitalize">
            {todayLabel}
          </p>
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.22em] text-stone-900 dark:text-white">
            EdLight News
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          1. FRONT PAGE — Lead + secondary columns
             Lead: compact image + big headline (left 8 cols)
             Secondary: 3 text-only stories stacked (right 4 cols)
         ══════════════════════════════════════════════════════════════════════ */}
      {leadArticle && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-8 sm:py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">

              {/* ── Lead article (8 cols) ── */}
              <div className="lg:col-span-8 lg:border-r lg:border-stone-200 lg:dark:border-stone-800 lg:pr-10">
                {/* À la une label */}
                <ColumnHeader label={fr ? "À la une" : "Alaune"} />

                {/* Compact image — only if available, kept modest */}
                {leadArticle.imageUrl && (
                  <Link href={lq(`/news/${leadArticle.id}`)} className="group mb-4 block">
                    <div className="relative aspect-[16/7] overflow-hidden rounded-md bg-stone-100 dark:bg-stone-900">
                      <ImageWithFallback
                        src={leadArticle.imageUrl}
                        alt={leadArticle.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                      />
                    </div>
                  </Link>
                )}

                {/* Headline */}
                <Link href={lq(`/news/${leadArticle.id}`)} className="group block">
                  <h1 className="font-serif text-3xl font-black leading-[1.1] tracking-tight text-stone-950 dark:text-white group-hover:text-primary transition-colors sm:text-4xl lg:text-[2.6rem]">
                    {leadArticle.title}
                  </h1>
                </Link>

                {/* Summary — deck paragraph */}
                {leadArticle.summary && (
                  <p className="mt-3 text-base leading-relaxed text-stone-600 dark:text-stone-400 line-clamp-3 border-l-2 border-stone-300 dark:border-stone-700 pl-4">
                    {leadArticle.summary}
                  </p>
                )}

                {/* Byline */}
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                  {leadArticle.sourceName && (
                    <span className="font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                      {leadArticle.sourceName}
                    </span>
                  )}
                  {leadArticle.publishedAt && (
                    <>
                      <span className="text-stone-300 dark:text-stone-700">·</span>
                      <span className="text-stone-500">{formatRelativeDate(leadArticle.publishedAt, lang)}</span>
                    </>
                  )}
                  {categoryTagText(leadArticle, lang) && (
                    <>
                      <span className="text-stone-300 dark:text-stone-700">·</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                        {categoryTagText(leadArticle, lang)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* ── Secondary stack (4 cols) ── */}
              {secondaryHero.length > 0 && (
                <div className="lg:col-span-4">
                  <ColumnHeader label={fr ? "À suivre" : "Plis nouvèl"} />
                  <ol className="divide-y divide-stone-100 dark:divide-stone-800">
                    {secondaryHero.map((article) => (
                      <li key={article.id} className="py-4 first:pt-0 last:pb-0">
                        <Link href={lq(`/news/${article.id}`)} className="group block">
                          {categoryTagText(article, lang) && (
                            <div className="mb-1.5">
                              <span className="inline-block text-[10px] font-black uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                                {categoryTagText(article, lang)}
                              </span>
                            </div>
                          )}
                          <h3 className="font-serif text-[15px] font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors">
                            {article.title}
                          </h3>
                          {article.summary && (
                            <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-2">
                              {article.summary}
                            </p>
                          )}
                          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-600">
                            {article.sourceName}
                            {article.publishedAt && (
                              <span className="font-normal"> · {formatRelativeDate(article.publishedAt, lang)}</span>
                            )}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. NEWS GRID — 6 articles, 3 columns, pure text
         ══════════════════════════════════════════════════════════════════════ */}
      {newsGrid.length > 0 && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionRule
              label={fr ? "Actualités" : "Nouvèl"}
              href={lq("/news")}
              linkLabel={fr ? "Voir tout" : "Wè tout"}
            />
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {newsGrid.map((article, idx) => (
                <div
                  key={article.id}
                  className={[
                    "relative",
                    // vertical rule between columns (lg only)
                    idx % 3 !== 0 ? "lg:border-l lg:border-stone-200 lg:dark:border-stone-800 lg:pl-8" : "",
                    idx % 2 !== 0 ? "sm:border-l sm:border-stone-200 sm:dark:border-stone-800 sm:pl-8 lg:border-none lg:pl-0" : "",
                    // re-apply lg rule for correct columns
                    idx % 3 !== 0 ? "lg:border-l lg:border-stone-200 lg:dark:border-stone-800 lg:pl-8" : "",
                  ].join(" ")}
                >
                  <Link href={lq(`/news/${article.id}`)} className="group block">
                    {categoryTagText(article, lang) && (
                      <div className="mb-1.5">
                        <span className="inline-block text-[10px] font-black uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                          {categoryTagText(article, lang)}
                        </span>
                      </div>
                    )}
                    <h3 className="font-serif text-base font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors">
                      {article.title}
                    </h3>
                    {article.summary && (
                      <p className="mt-1.5 text-xs leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-2">
                        {article.summary}
                      </p>
                    )}
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-600">
                      {article.sourceName}
                      {article.publishedAt && (
                        <span className="font-normal"> · {formatRelativeDate(article.publishedAt, lang)}</span>
                      )}
                    </p>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. LATEST FEED + TRENDING SIDEBAR
         ══════════════════════════════════════════════════════════════════════ */}
      {(latestNews.length > 0 || trendingStories.length > 0) && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12">

              {/* Latest — dense text list */}
              {latestNews.length > 0 && (
                <div className="lg:col-span-8">
                  <SectionRule
                    label={fr ? "Dernières actualités" : "Dènye nouvèl"}
                    href={lq("/news")}
                    linkLabel={fr ? "Voir tout" : "Wè tout"}
                  />
                  <ul className="divide-y divide-stone-100 dark:divide-stone-800/60">
                    {latestNews.map((article, idx) => (
                      <li key={article.id} className="py-3 first:pt-0 last:pb-0">
                        <Link href={lq(`/news/${article.id}`)} className="group block">
                          <div className="min-w-0">
                            {categoryTagText(article, lang) && (
                              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">
                                {categoryTagText(article, lang)}
                              </p>
                            )}
                            <h3
                              className={[
                                "font-serif font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors",
                                idx < 2 ? "text-[15px] sm:text-base" : "text-sm",
                              ].join(" ")}
                            >
                              {article.title}
                            </h3>
                            {idx === 0 && article.summary && (
                              <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-2">
                                {article.summary}
                              </p>
                            )}
                          </div>
                          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-600 pl-0">
                            {article.sourceName}
                            {article.publishedAt && (
                              <span className="font-normal"> · {formatRelativeDate(article.publishedAt, lang)}</span>
                            )}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Trending — numbered sidebar */}
              {trendingStories.length > 0 && (
                <aside className="lg:col-span-4 lg:border-l lg:border-stone-200 lg:dark:border-stone-800 lg:pl-8">
                  <SectionRule label={fr ? "Les plus lus" : "Plis li yo"} />
                  <ol className="space-y-4">
                    {trendingStories.map((article, idx) => (
                      <li key={article.id}>
                        <Link href={lq(`/news/${article.id}`)} className="group flex items-start gap-3">
                          <span className="shrink-0 min-w-[24px] text-center text-2xl font-black leading-none select-none text-stone-200 dark:text-stone-800">
                            {idx + 1}
                          </span>
                          <div>
                            <h3 className="text-[13px] font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors line-clamp-3">
                              {article.title}
                            </h3>
                            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-600">
                              {article.sourceName}
                              {article.sourceName && article.publishedAt && <span className="font-normal"> · </span>}
                              {article.publishedAt && (
                                <span className="font-normal">{formatRelativeDate(article.publishedAt, lang)}</span>
                              )}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </aside>
              )}

            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. HISTOIRE DU JOUR — compact dark band
         ══════════════════════════════════════════════════════════════════════ */}
      {histoireArticle && (
        <section className="border-b border-stone-200 dark:border-stone-800">
          <Link href={lq("/histoire")} className="group block bg-stone-950 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl flex items-center gap-6 sm:gap-10">
              <div className="shrink-0">
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-amber-400 mb-1">
                  {fr ? "Histoire du jour" : "Istwa jodi a"}
                </span>
                <span className="block text-[10px] font-semibold text-stone-600 uppercase tracking-wider">
                  {histoireArticle.publishedAt
                    ? formatRelativeDate(histoireArticle.publishedAt, lang)
                    : ""}
                </span>
              </div>
              <div className="flex-1 min-w-0 border-l border-stone-800 pl-6 sm:pl-10">
                <h2 className="font-serif text-lg font-bold leading-snug text-white group-hover:text-amber-100 transition-colors sm:text-xl line-clamp-2">
                  {histoireArticle.title}
                </h2>
                {histoireArticle.summary && (
                  <p className="mt-1.5 text-xs leading-relaxed text-stone-500 line-clamp-2 sm:text-sm sm:text-stone-400">
                    {histoireArticle.summary}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-xs font-bold text-amber-400 group-hover:text-amber-300 transition-colors hidden sm:block">
                {fr ? "Lire" : "Li"} →
              </span>
            </div>
          </Link>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          5. OPPORTUNITÉS — 2-col text list
         ══════════════════════════════════════════════════════════════════════ */}
      {(featuredOpp !== null || moreOpps.length > 0) && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionRule
              label={fr ? "Opportunités" : "Okazyon"}
              href={lq("/opportunites")}
              linkLabel={fr ? "Voir tout" : "Wè tout"}
            />

            <div className="grid gap-x-10 gap-y-0 sm:grid-cols-2">
              {/* Left col */}
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {[featuredOpp, ...moreOpps]
                  .filter(Boolean)
                  .slice(0, 3)
                  .map((opp, idx) => (
                    <li key={opp!.id} className="py-3 first:pt-0 last:pb-0">
                      <Link href={lq(`/news/${opp!.id}`)} className="group block">
                        {idx === 0 && (
                          <span className="mb-1 inline-block text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                            {fr ? "À ne pas manquer" : "Pa rate sa"}
                          </span>
                        )}
                        {opp!.category && idx > 0 && (
                          <div className="mb-1">
                            <CategoryBadge category={opp!.category} lang={lang} />
                          </div>
                        )}
                        <h3
                          className={[
                            "font-serif font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors",
                            idx === 0 ? "text-base" : "text-sm",
                          ].join(" ")}
                        >
                          {opp!.title}
                        </h3>
                        {idx === 0 && opp!.summary && (
                          <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-2">
                            {opp!.summary}
                          </p>
                        )}
                        {opp!.deadline && (
                          <p className="mt-1 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                            {fr ? "Date limite :" : "Dat limit :"} {formatRelativeDate(opp!.deadline, lang)}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>

              {/* Right col */}
              <ul className="divide-y divide-stone-100 dark:divide-stone-800 mt-0 sm:border-l sm:border-stone-200 sm:dark:border-stone-800 sm:pl-10">
                {moreOpps.slice(2, 5).map((opp) => (
                  <li key={opp.id} className="py-3 first:pt-0 last:pb-0">
                    <Link href={lq(`/news/${opp.id}`)} className="group block">
                      {opp.category && (
                        <div className="mb-1">
                          <CategoryBadge category={opp.category} lang={lang} />
                        </div>
                      )}
                      <h3 className="font-serif text-sm font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors">
                        {opp.title}
                      </h3>
                      {opp.deadline && (
                        <p className="mt-1 text-[10px] font-bold text-orange-600 dark:text-orange-400">
                          {fr ? "Date limite :" : "Dat limit :"} {formatRelativeDate(opp.deadline, lang)}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          6. NEWSLETTER
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-14 bg-stone-950">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
            {fr ? "Newsletter" : "Nyouzletè"}
          </p>
          <h2 className="font-serif text-2xl font-black tracking-tight text-white mb-2">
            {fr ? "Restez informé" : "Rete enfòme"}
          </h2>
          <p className="text-sm text-stone-400 mb-2">
            {fr
              ? "Les meilleures actualités et opportunités — une fois par semaine."
              : "Pi bon nouvèl ak okazyon yo — yon fwa pa semèn."}
          </p>
          <p className="mb-7 text-[10px] text-stone-600 uppercase tracking-widest">
            {fr
              ? "Édition quotidienne · Gratuit · Désabonnement à tout moment"
              : "Chak jou · Gratis · Dezabòne nenpòt ki lè"}
          </p>
          <div className="max-w-sm mx-auto [&_input]:border-stone-700 [&_input]:bg-stone-900 [&_input]:text-white [&_input]:placeholder-stone-500 [&_button]:bg-white [&_button]:text-stone-950 [&_button]:hover:bg-stone-100">
            <NewsletterForm lang={lang} variant="homepage" />
          </div>
        </div>
      </section>

    </div>
  );
}
