/**
 * Accueil — EdLight News editorial homepage.
 *
 * Design: image-forward, strong visual hierarchy.
 *  1. Dateline bar
 *  2. Mega hero (lead + secondary grid)
 *  3. Latest news + Trending (2-col)
 *  4. Histoire du jour (cinematic strip)
 *  5. Opportunities
 *  6. Newsletter
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
import { withLangParam, formatRelativeDate } from "@/lib/utils";
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

const HAITI_TITLE_RE =
  /\b(?:ha[iï]ti|ayiti|port[- ]au[- ]prince|cap[- ]ha[iï]tien|p[ée]tion[- ]ville|ha[iï]tien(?:ne)?s?|gonaives|jacmel|j[ée]r[ée]mie|les\s+cayes)\b/i;

function isHaiti(a: FeedItem): boolean {
  if (a.vertical === "haiti" || a.geoTag === "HT" || a.category === "local_news")
    return true;
  const blob = `${a.title ?? ""} ${a.summary ?? ""}`;
  return HAITI_TITLE_RE.test(blob);
}

/** Section divider with centered label */
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
    <div className="mb-6 flex items-center gap-3">
      <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      <span className="shrink-0 text-[11px] font-black uppercase tracking-[0.2em] text-stone-900 dark:text-white">
        {label}
      </span>
      <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      {href && linkLabel && (
        <Link
          href={href}
          className="shrink-0 text-[11px] font-semibold text-primary hover:underline"
        >
          {linkLabel} →
        </Link>
      )}
    </div>
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
    safeFetch(() => fetchEnrichedFeed(lang, 80), [], "enrichedFeed"),
    safeFetch(() => fetchTrending(lang, 8), [], "trending"),
  ]);

  const filteredFeed = rawFeed.filter((a) => !isTauxDuJourArticle(a));

  const rankedFeed = rankFeed(filteredFeed, {
    audienceFitThreshold: 0.3,
    publisherCap: 3,
    topN: 20,
  });

  // ── Segments ──────────────────────────────────────────────────────────────
  const opportunities = rankedFeed.filter(isOpportunity);

  const heroPool = rankedFeed.filter((a) => !isOpportunity(a));
  const heroWithImage = heroPool.filter((a) => !!a.imageUrl);
  const heroFallback = heroPool.filter((a) => !a.imageUrl);
  const heroArticles = [...heroWithImage, ...heroFallback].slice(0, 4);
  const heroIds = new Set(heroArticles.map((a) => a.id));

  const leadArticle = heroArticles[0] ?? null;
  const secondaryHero = heroArticles.slice(1, 4);

  const latestNews = filteredFeed
    .filter(
      (a) =>
        !heroIds.has(a.id) &&
        !isOpportunity(a) &&
        a.itemType !== "utility",
    )
    .slice(0, 7);
  const latestNewsIds = new Set(latestNews.map((a) => a.id));

  const histoireArticle =
    filteredFeed.find(
      (a) => a.itemType === "utility" && a.utilityType === "history",
    ) ?? null;

  const featuredOpp = opportunities[0] ?? null;
  const moreOpps = opportunities.slice(1, 5);

  const trendingStories = (() => {
    const deduped = trendingArticles.filter(
      (a) => !heroIds.has(a.id) && !latestNewsIds.has(a.id),
    );
    return (
      deduped.length >= 3
        ? deduped
        : trendingArticles.filter((a) => !heroIds.has(a.id))
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
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 flex items-center gap-4">
          <p className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-stone-400 dark:text-stone-600 capitalize">
            {todayLabel}
          </p>
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          <p className="shrink-0 text-[11px] font-black uppercase tracking-[0.2em] text-stone-900 dark:text-white">
            EdLight News
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          1. HERO — Mega lead article + secondary grid
         ══════════════════════════════════════════════════════════════════════ */}
      {leadArticle && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-10 sm:py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

            {/* Lead — image left, text right */}
            <div className="grid gap-6 lg:grid-cols-12 lg:gap-10 items-start">

              {leadArticle.imageUrl && (
                <Link
                  href={lq(`/news/${leadArticle.id}`)}
                  className="group block lg:col-span-7"
                >
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-900">
                    <ImageWithFallback
                      src={leadArticle.imageUrl}
                      alt={leadArticle.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                    {leadArticle.category && (
                      <div className="absolute top-3 left-3">
                        <CategoryBadge
                          category={leadArticle.category}
                          lang={lang}
                          pill
                        />
                      </div>
                    )}
                  </div>
                </Link>
              )}

              <div className={leadArticle.imageUrl ? "lg:col-span-5" : "lg:col-span-12"}>
                <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-primary dark:text-indigo-400">
                  {fr ? "À la une" : "Alaune"}
                </p>

                <Link href={lq(`/news/${leadArticle.id}`)} className="group block">
                  <h1
                    className={[
                      "font-serif font-black leading-[1.1] tracking-tight text-stone-950 dark:text-white",
                      "group-hover:text-primary transition-colors duration-200",
                      leadArticle.imageUrl
                        ? "text-2xl sm:text-3xl xl:text-[2rem]"
                        : "text-3xl sm:text-5xl xl:text-6xl",
                    ].join(" ")}
                  >
                    {leadArticle.title}
                  </h1>
                </Link>

                {leadArticle.summary && (
                  <p className="mt-4 text-sm leading-relaxed text-stone-600 dark:text-stone-400 sm:text-base line-clamp-4">
                    {leadArticle.summary}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-500">
                  {leadArticle.sourceName && (
                    <span className="font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                      {leadArticle.sourceName}
                    </span>
                  )}
                  {leadArticle.publishedAt && (
                    <span>{formatRelativeDate(leadArticle.publishedAt, lang)}</span>
                  )}
                </div>

                <Link
                  href={lq(`/news/${leadArticle.id}`)}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary dark:bg-white dark:text-stone-950 dark:hover:bg-primary dark:hover:text-white"
                >
                  {fr ? "Lire l'article" : "Li atik la"}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>

            {/* Secondary grid */}
            {secondaryHero.length > 0 && (
              <div className="mt-8 border-t border-stone-200 dark:border-stone-800 pt-8 grid gap-5 sm:grid-cols-3">
                {secondaryHero.map((article) => (
                  <Link
                    key={article.id}
                    href={lq(`/news/${article.id}`)}
                    className="group block"
                  >
                    {article.imageUrl && (
                      <div className="relative mb-3 aspect-[3/2] overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-900">
                        <ImageWithFallback
                          src={article.imageUrl}
                          alt={article.title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                        />
                      </div>
                    )}
                    {article.category && (
                      <div className="mb-1.5">
                        <CategoryBadge category={article.category} lang={lang} pill />
                      </div>
                    )}
                    <h3 className="font-serif text-[15px] font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors line-clamp-3">
                      {article.title}
                    </h3>
                    <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-600">
                      {article.sourceName}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          2. LATEST NEWS + TRENDING — 2-col editorial feed
         ══════════════════════════════════════════════════════════════════════ */}
      {(latestNews.length > 0 || trendingStories.length > 0) && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12">

              {latestNews.length > 0 && (
                <div className="lg:col-span-8">
                  <SectionRule
                    label={fr ? "Dernières actualités" : "Dènye nouvèl"}
                    href={lq("/news")}
                    linkLabel={fr ? "Voir tout" : "Wè tout"}
                  />
                  <ul className="divide-y divide-stone-100 dark:divide-stone-800/60">
                    {latestNews.map((article, idx) => (
                      <li key={article.id} className="py-4 first:pt-0 last:pb-0">
                        <Link
                          href={lq(`/news/${article.id}`)}
                          className="group flex gap-4"
                        >
                          {article.imageUrl && (
                            <div className="shrink-0 mt-0.5">
                              <div className="relative h-16 w-24 overflow-hidden rounded-md bg-stone-100 dark:bg-stone-900">
                                <ImageWithFallback
                                  src={article.imageUrl}
                                  alt={article.title}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {article.category && (
                              <div className="mb-1">
                                <CategoryBadge category={article.category} lang={lang} />
                              </div>
                            )}
                            <h3
                              className={[
                                "font-serif font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors",
                                idx === 0 ? "text-base sm:text-lg" : "text-sm sm:text-[15px]",
                              ].join(" ")}
                            >
                              {article.title}
                            </h3>
                            {idx === 0 && article.summary && (
                              <p className="mt-1 text-sm leading-relaxed text-stone-500 dark:text-stone-400 line-clamp-2">
                                {article.summary}
                              </p>
                            )}
                            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-600">
                              {article.sourceName && (
                                <span className="font-bold uppercase tracking-wider">
                                  {article.sourceName}
                                </span>
                              )}
                              {article.publishedAt && (
                                <>
                                  <span>·</span>
                                  <span>{formatRelativeDate(article.publishedAt, lang)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {trendingStories.length > 0 && (
                <aside className="lg:col-span-4 lg:border-l lg:border-stone-200 lg:dark:border-stone-800 lg:pl-8">
                  <SectionRule label={fr ? "Les plus lus" : "Plis li yo"} />
                  <ol className="space-y-5">
                    {trendingStories.map((article, idx) => (
                      <li key={article.id}>
                        <Link
                          href={lq(`/news/${article.id}`)}
                          className="group flex items-start gap-3"
                        >
                          <span className="shrink-0 min-w-[28px] text-center text-[26px] font-black leading-none select-none text-stone-200 dark:text-stone-800">
                            {idx + 1}
                          </span>
                          <div>
                            <h3 className="text-sm font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors line-clamp-3">
                              {article.title}
                            </h3>
                            <p className="mt-1 text-[11px] text-stone-400 dark:text-stone-600">
                              {article.sourceName && (
                                <span className="font-semibold uppercase tracking-wider">
                                  {article.sourceName}
                                </span>
                              )}
                              {article.sourceName && article.publishedAt && <span> · </span>}
                              {article.publishedAt &&
                                formatRelativeDate(article.publishedAt, lang)}
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
          3. HISTOIRE DU JOUR — Cinematic full-width strip
         ══════════════════════════════════════════════════════════════════════ */}
      {histoireArticle && (
        <section className="border-b border-stone-200 dark:border-stone-800 overflow-hidden">
          <Link href={lq("/histoire")} className="group relative block">
            {histoireArticle.imageUrl ? (
              <div className="absolute inset-0 z-0">
                <ImageWithFallback
                  src={histoireArticle.imageUrl}
                  alt={histoireArticle.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-950/75 to-stone-950/20" />
              </div>
            ) : (
              <div className="absolute inset-0 z-0 bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/50" />
            )}

            <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
              <span className="mb-4 inline-block rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-amber-400">
                {fr ? "Histoire du jour" : "Istwa jodi a"}
              </span>
              <h2 className="font-serif text-2xl font-black leading-tight tracking-tight text-white group-hover:text-amber-100 transition-colors sm:text-3xl lg:text-4xl max-w-2xl">
                {histoireArticle.title}
              </h2>
              {histoireArticle.summary && (
                <p className="mt-4 text-sm leading-relaxed text-white/60 line-clamp-2 max-w-xl sm:text-base">
                  {histoireArticle.summary}
                </p>
              )}
              <span className="mt-7 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-300 transition group-hover:bg-amber-400/20">
                {fr ? "Lire" : "Li"} →
              </span>
            </div>
          </Link>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. OPPORTUNITIES
         ══════════════════════════════════════════════════════════════════════ */}
      {(featuredOpp !== null || moreOpps.length > 0) && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <SectionRule
              label={fr ? "Opportunités" : "Okazyon"}
              href={lq("/opportunites")}
              linkLabel={fr ? "Voir tout" : "Wè tout"}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredOpp && (
                <Link
                  href={lq(`/news/${featuredOpp.id}`)}
                  className="group rounded-2xl border border-amber-200 bg-amber-50 p-5 transition hover:border-amber-300 hover:bg-amber-100/60 dark:border-amber-800/50 dark:bg-amber-950/20 dark:hover:border-amber-700/60"
                >
                  <span className="mb-3 inline-block text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                    {fr ? "À ne pas manquer" : "Pa rate sa"}
                  </span>
                  <h3 className="font-serif text-base font-bold leading-snug text-stone-900 dark:text-white group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors line-clamp-4">
                    {featuredOpp.title}
                  </h3>
                  {featuredOpp.summary && (
                    <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400 line-clamp-3">
                      {featuredOpp.summary}
                    </p>
                  )}
                  {featuredOpp.deadline && (
                    <p className="mt-3 text-xs font-bold text-orange-600 dark:text-orange-400">
                      {fr ? "Date limite :" : "Dat limit :"}{" "}
                      {formatRelativeDate(featuredOpp.deadline, lang)}
                    </p>
                  )}
                </Link>
              )}

              {moreOpps.map((opp) => (
                <Link
                  key={opp.id}
                  href={lq(`/news/${opp.id}`)}
                  className="group rounded-2xl border border-stone-200 bg-stone-50 p-5 transition hover:border-stone-300 hover:bg-white dark:border-stone-800 dark:bg-stone-900/40 dark:hover:border-stone-700"
                >
                  {opp.category && (
                    <div className="mb-2">
                      <CategoryBadge category={opp.category} lang={lang} pill />
                    </div>
                  )}
                  <h3 className="font-serif text-sm font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors line-clamp-3">
                    {opp.title}
                  </h3>
                  {opp.deadline && (
                    <p className="mt-2 text-xs font-semibold text-orange-600 dark:text-orange-400">
                      {fr ? "Date limite :" : "Dat limit :"}{" "}
                      {formatRelativeDate(opp.deadline, lang)}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          5. NEWSLETTER
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="py-16 bg-stone-950">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.2em] text-stone-500">
            {fr ? "Newsletter" : "Nyouzletè"}
          </p>
          <h2 className="font-serif text-3xl font-black tracking-tight text-white mb-3">
            {fr ? "Restez informé" : "Rete enfòme"}
          </h2>
          <p className="text-sm text-stone-400 mb-6">
            {fr
              ? "Les meilleures actualités et opportunités — une fois par semaine."
              : "Pi bon nouvèl ak okazyon yo — yon fwa pa semèn."}
          </p>
          <p className="mb-8 text-[11px] text-stone-600 uppercase tracking-widest">
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
