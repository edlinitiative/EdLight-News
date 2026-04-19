/**
 * Accueil — Editorial news homepage (NYT-style).
 *
 * Minimalist, text-driven layout:
 *  - Compact hero image + lead article
 *  - Latest news feed (no images)
 *  - Breaking news brief (text snippets)
 *  - Opportunities (compact list, no images)
 *  - Trending (simple titles)
 *  - Newsletter CTA
 */

import Link from "next/link";
import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, fetchTrending, getLangFromSearchParams } from "@/lib/content";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { NewsletterForm } from "@/components/NewsletterForm";
import { isTauxDuJourArticle } from "@/lib/tauxFilter";
import { contentLooksLikeOpportunity } from "@/lib/opportunityClassifier";
import { buildOgMetadata } from "@/lib/og";
import {
  withLangParam,
  formatRelativeDate,
} from "@/lib/utils";
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

// ── Constants ─────────────────────────────────────────────────────────────────

const OPPORTUNITY_CATS = new Set([
  "scholarship",
  "opportunity",
  "bourses",
  "concours",
  "stages",
  "programmes",
]);

function isOpportunity(a: FeedItem): boolean {
  // Must pass a content smell test — prevents misclassified news (e.g. crime
  // stories with category="bourses") from polluting the Opportunities section.
  // NOTE: we do NOT bypass the smell test for utility items; calendar/daily_fact
  // utilities are not opportunities even if their vertical is "opportunites".
  const catIsOpp = a.vertical === "opportunites" || OPPORTUNITY_CATS.has(a.category ?? "");
  if (!catIsOpp) return false;
  return contentLooksLikeOpportunity(a.title ?? "", a.summary);
}

const HAITI_TITLE_RE = /\b(?:ha[iï]ti|ayiti|port[- ]au[- ]prince|cap[- ]ha[iï]tien|p[ée]tion[- ]ville|ha[iï]tien(?:ne)?s?|gonaives|jacmel|j[ée]r[ée]mie|les\s+cayes)\b/i;

function isHaiti(a: FeedItem): boolean {
  if (a.vertical === "haiti" || a.geoTag === "HT" || a.category === "local_news") return true;
  // Catch articles *about* Haiti even when upstream metadata is missing
  const blob = `${a.title ?? ""} ${a.summary ?? ""}`;
  return HAITI_TITLE_RE.test(blob);
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
    safeFetch(() => fetchEnrichedFeed(lang, 80), [], "enrichedFeed"),
    safeFetch(() => fetchTrending(lang, 8), [], "trending"),
  ]);

  // Remove exchange-rate filler articles
  const filteredFeed = rawFeed.filter((a) => !isTauxDuJourArticle(a));

  // Rank the feed
  const rankedFeed = rankFeed(filteredFeed, {
    audienceFitThreshold: 0.3,
    publisherCap: 3,
    topN: 20,
  });

  // ── Segment the feed ──────────────────────────────────────────────────────
  const opportunities = rankedFeed.filter(isOpportunity);

  // Hero: pick top articles with images first, prefer non-opportunity
  const heroPool = rankedFeed.filter((a) => !isOpportunity(a));
  const heroWithImage = heroPool.filter((a) => !!a.imageUrl);
  const heroFallback = heroPool.filter((a) => !a.imageUrl);
  const heroArticles = [...heroWithImage, ...heroFallback].slice(0, 4);
  const heroIds = new Set(heroArticles.map((a) => a.id));

  const leadArticle = heroArticles[0] ?? null;
  const secondaryHero = heroArticles.slice(1, 4);

  // Latest news: chronological (most recent first), skip opportunities and
  // utility items so the section feels like a real "breaking news" feed.
  const latestNews = filteredFeed
    .filter((a) => !heroIds.has(a.id) && !isOpportunity(a) && a.itemType !== "utility")
    .slice(0, 6);
  const latestNewsIds = new Set(latestNews.map((a) => a.id));

  // Histoire du jour — most recent history utility item
  const histoireArticle = filteredFeed.find(
    (a) =>
      a.itemType === "utility" &&
      (a.utilityType === "history"),
  ) ?? null;

  // Opportunities spotlight
  const featuredOpp = opportunities[0] ?? null;
  const moreOpps = opportunities.slice(1, 6);
  const trendingStories = (() => {
    const deduped = trendingArticles.filter(
      (a) => !heroIds.has(a.id) && !latestNewsIds.has(a.id),
    );
    if (deduped.length >= 3) return deduped.slice(0, 5);

    return trendingArticles
      .filter((a) => !heroIds.has(a.id))
      .slice(0, 5);
  })();
  const editionLinks = [
    {
      href: lq("/news"),
      label: fr ? "Actualités" : "Nouvèl",
      value: latestNews.length,
    },
    {
      href: lq("/opportunites"),
      label: fr ? "Opportunités" : "Okazyon",
      value: opportunities.length,
    },
    {
      href: lq("/histoire"),
      label: fr ? "Histoire" : "Istwa",
      value: histoireArticle ? 1 : 0,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  // Today's date label for the editorial dateline
  const todayLabel = new Date()
    .toLocaleDateString(fr ? "fr-FR" : "ht-HT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Port-au-Prince",
    })
    .replace(/^./, (char) => char.toUpperCase());

  return (
    <div className="pb-20">

      {/* ══════════════════════════════════════════════════════════════════════
          EDITORIAL DATELINE — newspaper-style date bar
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="border-b border-stone-200 dark:border-stone-800 py-2">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-600 capitalize">
            {todayLabel}
          </p>
          <div className="h-px flex-1 mx-4 bg-stone-200 dark:bg-stone-800" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-600">
            EdLight News
          </p>
        </div>
      </div>

      <section className="border-b border-stone-200 dark:border-stone-800 py-8 sm:py-10">
        <div className="mx-auto grid max-w-4xl gap-6 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:px-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400 dark:text-stone-600">
              {fr ? "Édition du jour" : "Edisyon jodi a"}
            </p>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-600 dark:text-stone-400 sm:text-lg">
              {fr
                ? "Une lecture claire de l'actualité, des opportunités et des repères utiles pour les étudiants haïtiens et la diaspora."
                : "Yon lekti klè sou nouvèl, okazyon ak repè itil pou elèv ayisyen yo ak dyaspora a."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={lq("/news")}
                className="inline-flex items-center rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-400 hover:bg-stone-50 dark:border-stone-700 dark:text-white dark:hover:border-stone-600 dark:hover:bg-stone-900"
              >
                {fr ? "Lire les actualités" : "Li nouvèl yo"}
              </Link>
              <Link
                href={lq("/opportunites")}
                className="inline-flex items-center rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-400 hover:bg-stone-50 dark:border-stone-700 dark:text-white dark:hover:border-stone-600 dark:hover:bg-stone-900"
              >
                {fr ? "Voir les opportunités" : "Wè okazyon yo"}
              </Link>
              <Link
                href={lq("/histoire")}
                className="inline-flex items-center rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-400 hover:bg-stone-50 dark:border-stone-700 dark:text-white dark:hover:border-stone-600 dark:hover:bg-stone-900"
              >
                {fr ? "Explorer l'histoire" : "Eksplore istwa a"}
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 lg:grid-cols-1 lg:gap-2.5">
            {editionLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 transition hover:border-stone-300 hover:bg-white dark:border-stone-800 dark:bg-stone-900/50 dark:hover:border-stone-700"
              >
                <p className="text-xl font-black tracking-tight text-stone-900 dark:text-white">
                  {link.value}
                </p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.15em] text-stone-500 dark:text-stone-400">
                  {link.label}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          1. HERO — Lead article, tall and editorial
         ══════════════════════════════════════════════════════════════════════ */}
      {leadArticle && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-12 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 items-center">
              {/* Lead article text */}
              <div className="lg:col-span-7">
                <Link href={lq(`/news/${leadArticle.id}`)} className="group block">
                  <div className="space-y-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-stone-400 dark:text-stone-600">
                      {fr ? "À la une" : "Alaune"}
                    </p>
                    <h1
                      className="text-4xl font-extrabold leading-[1.1] tracking-tight text-stone-900 dark:text-white group-hover:text-primary transition-colors sm:text-5xl"
                    >
                      {leadArticle.title}
                    </h1>
                    {leadArticle.summary && (
                      <p className="text-base leading-relaxed text-stone-600 dark:text-stone-400 sm:text-lg">
                        {leadArticle.summary}
                      </p>
                    )}
                    <div className="pt-1">
                      <span className="inline-flex items-center rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-900 transition group-hover:border-stone-400 group-hover:bg-stone-50 dark:border-stone-700 dark:text-white dark:group-hover:border-stone-600 dark:group-hover:bg-stone-900">
                        {fr ? "Lire l'article" : "Li atik la"}
                      </span>
                    </div>
                    <div className="pt-1 flex items-center gap-2 text-xs text-stone-500 dark:text-stone-500">
                      {leadArticle.sourceName && (
                        <span className="font-bold uppercase tracking-wider">{leadArticle.sourceName}</span>
                      )}
                      {leadArticle.publishedAt && (
                        <>
                          <span className="text-stone-300 dark:text-stone-700">—</span>
                          <span>{formatRelativeDate(leadArticle.publishedAt, lang)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              </div>

              {/* Lead image */}
              {leadArticle.imageUrl && (
                <div className="lg:col-span-5">
                  <Link href={lq(`/news/${leadArticle.id}`)} className="group block">
                    <div className="relative aspect-[3/2] overflow-hidden rounded-sm bg-stone-100 dark:bg-stone-800">
                      <ImageWithFallback
                        src={leadArticle.imageUrl}
                        alt={leadArticle.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      />
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Secondary headlines below the hero */}
            {secondaryHero.length > 0 && (
              <div className="mt-8 pt-6 border-t border-stone-200 dark:border-stone-800 grid gap-6 sm:grid-cols-3">
                {secondaryHero.slice(0, 3).map((article) => (
                  <Link key={article.id} href={lq(`/news/${article.id}`)} className="group block">
                    <h3 className="text-sm font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors line-clamp-3">
                      {article.title}
                    </h3>
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-500">
                      {article.sourceName && (
                        <span className="font-semibold uppercase">{article.sourceName}</span>
                      )}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. AUJOURD'HUI DANS L'HISTOIRE — Tall, centred editorial feature
         ══════════════════════════════════════════════════════════════════════ */}
      {histoireArticle && (
        <section className="border-b border-stone-200 dark:border-stone-800 overflow-hidden">
          <Link href={lq("/histoire")} className="group block relative">
            {/* Background image with dark overlay */}
            {histoireArticle.imageUrl ? (
              <div className="absolute inset-0 z-0">
                <ImageWithFallback
                  src={histoireArticle.imageUrl}
                  alt={histoireArticle.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/60 to-stone-950/30" />
              </div>
            ) : (
              <div className="absolute inset-0 z-0 bg-gradient-to-br from-stone-900 via-stone-800 to-amber-950/60 dark:from-stone-950 dark:via-stone-900 dark:to-amber-950/40" />
            )}

            {/* Content — centred vertically and horizontally, constrained width */}
            <div className="relative z-10 flex min-h-[340px] sm:min-h-[420px] flex-col items-center justify-center py-12 px-4 text-center sm:px-8">
              <div className="max-w-4xl w-full">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400/90 whitespace-nowrap overflow-hidden text-ellipsis">
                  {fr ? "Histoire du jour" : "Istwa jodi a"}
                </p>
                <h2 className="max-w-3xl mx-auto text-xl sm:text-3xl font-extrabold leading-tight tracking-tight text-white group-hover:text-amber-100 transition-colors">
                  {histoireArticle.title}
                </h2>
                {histoireArticle.summary && (
                  <p className="mt-4 max-w-2xl mx-auto text-sm leading-relaxed text-white/70 sm:text-base line-clamp-3">
                    {histoireArticle.summary}
                  </p>
                )}
                <span className="mt-8 inline-flex items-center gap-1.5 rounded-full border border-white/30 px-5 py-2 text-xs font-semibold uppercase tracking-widest text-white/80 transition group-hover:bg-white/10">
                  {fr ? "Lire" : "Li"} →
                </span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          3. LATEST + TRENDING — Two-column editorial layout
         ══════════════════════════════════════════════════════════════════════ */}
      {(latestNews.length > 0 || trendingStories.length > 0) && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-10">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12">

              {/* Latest news — 8-col wide */}
              {latestNews.length > 0 && (
                <div className="lg:col-span-8">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-white border-b-2 border-stone-900 dark:border-white pb-1">
                      {fr ? "Dernières actualités" : "Dènye nouvèl"}
                    </h2>
                    <Link href={lq("/news")} className="text-xs font-semibold text-stone-500 hover:text-primary transition">
                      {fr ? "Voir tout" : "Wè tout"} →
                    </Link>
                  </div>
                  <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                    {latestNews.slice(0, 6).map((article) => (
                      <li key={article.id} className="py-4 first:pt-0">
                        <Link href={lq(`/news/${article.id}`)} className="group block">
                          <h3 className="text-base font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors">
                            {article.title}
                          </h3>
                          {article.summary && (
                            <p className="mt-1 text-sm leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-2">
                              {article.summary}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-600">
                            {article.sourceName && (
                              <span className="font-bold uppercase tracking-wider">{article.sourceName}</span>
                            )}
                            {article.publishedAt && (
                              <>
                                <span>·</span>
                                <span>{formatRelativeDate(article.publishedAt, lang)}</span>
                              </>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Trending — 4-col sidebar */}
              {trendingStories.length > 0 && (
                <div className="lg:col-span-4 lg:border-l lg:border-stone-200 lg:dark:border-stone-800 lg:pl-8">
                  <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-white border-b-2 border-stone-900 dark:border-white pb-1">
                    {fr ? "Les plus lus" : "Plis li yo"}
                  </h2>
                  <ol className="space-y-5">
                    {trendingStories.map((article, idx) => (
                      <li key={article.id}>
                        <Link href={lq(`/news/${article.id}`)} className="group flex gap-3">
                          <span className="mt-0.5 shrink-0 text-2xl font-black leading-none text-stone-200 dark:text-stone-800">
                            {idx + 1}
                          </span>
                          <div>
                            <h3 className="text-sm font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors">
                              {article.title}
                            </h3>
                            {(article.sourceName || article.publishedAt) && (
                              <p className="mt-1 text-[11px] text-stone-500 dark:text-stone-500">
                                {article.sourceName && (
                                  <span className="font-semibold uppercase tracking-wider">{article.sourceName}</span>
                                )}
                                {article.sourceName && article.publishedAt && <span> · </span>}
                                {article.publishedAt && formatRelativeDate(article.publishedAt, lang)}
                              </p>
                            )}
                          </div>
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
          4. OPPORTUNITIES — Compact text list
         ══════════════════════════════════════════════════════════════════════ */}
      {(featuredOpp !== null || moreOpps.length > 0) && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-10">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-white border-b-2 border-stone-900 dark:border-white pb-1">
                {fr ? "Opportunités" : "Okazyon"}
              </h2>
              <Link href={lq("/opportunites")} className="text-xs font-semibold text-stone-500 hover:text-primary transition">
                {fr ? "Voir tout" : "Wè tout"} →
              </Link>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              {/* Featured opportunity */}
              {featuredOpp && (
                <Link href={lq(`/news/${featuredOpp.id}`)} className="group block col-span-full sm:col-span-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary mb-2">
                    {fr ? "À ne pas manquer" : "Pa rate sa"}
                  </p>
                  <h3 className="text-lg font-extrabold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors">
                    {featuredOpp.title}
                  </h3>
                  {featuredOpp.summary && (
                    <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-3">
                      {featuredOpp.summary}
                    </p>
                  )}
                  {featuredOpp.deadline && (
                    <p className="mt-3 text-xs font-semibold text-orange-600 dark:text-orange-400">
                      {fr ? "Date limite :" : "Dat limit :"} {formatRelativeDate(featuredOpp.deadline, lang)}
                    </p>
                  )}
                </Link>
              )}

              {/* More opportunities */}
              {moreOpps.length > 0 && (
                <ul className="divide-y divide-stone-100 dark:divide-stone-800 col-span-full sm:col-span-1">
                  {moreOpps.slice(0, 4).map((opp) => (
                    <li key={opp.id} className="py-3 first:pt-0 last:pb-0">
                      <Link href={lq(`/news/${opp.id}`)} className="group block">
                        <h4 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-primary transition-colors">
                          {opp.title}
                        </h4>
                        {opp.deadline && (
                          <p className="mt-0.5 text-xs text-orange-600 dark:text-orange-400">
                            {fr ? "Date limite :" : "Dat limit :"} {formatRelativeDate(opp.deadline, lang)}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          5. NEWSLETTER — Clean, minimal CTA
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="bg-stone-50 dark:bg-stone-900/30 py-14">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-400 dark:text-stone-600 mb-3">
            {fr ? "Newsletter" : "Nyouzletè"}
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white mb-3">
            {fr ? "Restez informé" : "Rete enfòme"}
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-8">
            {fr
              ? "Les meilleures actualités et opportunités — une fois par semaine."
              : "Pi bon nouvèl ak okazyon yo — yon fwa pa semèn."}
          </p>
          <div className="max-w-sm mx-auto [&_input]:border-stone-300 [&_input]:bg-white [&_input]:text-stone-900 [&_input]:placeholder-stone-500 [&_button]:bg-stone-900 [&_button]:hover:bg-stone-800 dark:[&_input]:border-stone-700 dark:[&_input]:bg-stone-800 dark:[&_input]:text-white dark:[&_button]:bg-white dark:[&_button]:text-stone-900 dark:[&_button]:hover:bg-stone-100">
            <NewsletterForm lang={lang} variant="homepage" />
          </div>
        </div>
      </section>

    </div>
  );
}
