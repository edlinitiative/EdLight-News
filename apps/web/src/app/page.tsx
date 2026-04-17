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
import { ArrowRight, Instagram } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, fetchTrending, getLangFromSearchParams } from "@/lib/content";
import { fetchScholarshipsClosingSoon } from "@/lib/datasets";
import { TrendingSection } from "@/components/TrendingSection";
import { ArticleCard } from "@/components/ArticleCard";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { NewsletterForm } from "@/components/NewsletterForm";
import { HeroEditorial } from "@/components/HeroEditorial";
import { EditorialCard } from "@/components/EditorialCard";
import { FlashCard } from "@/components/FlashCard";
import { SectionHeader } from "@/components/SectionHeader";
import { CategoryBadge } from "@/components/CategoryBadge";
import { DeadlinePill } from "@/components/DeadlinePill";
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

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Compute the display category for an article, remapping misleading
 * upstream categories so the badge shown to the user is accurate.
 *
 * Handles two known data-quality issues:
 *  1. HaitiFactOfTheDay utility items stored with category="resource"
 *     — these are daily news, not educational resources.
 *  2. Opportunity-adjacent categories (bourses, concours, stages, programmes)
 *     on articles that aren't actually opportunities (classifier false positives).
 */
function displayCategory(a: FeedItem): string {
  const cat = a.category ?? "";
  // Utility daily-fact items are news, not resources
  if (cat === "resource" && a.itemType === "utility" && a.utilityType === "daily_fact") {
    return a.geoTag === "HT" ? "local_news" : "news";
  }
  // Opportunity-adjacent categories on non-opportunity articles → remap.
  // Use content smell test (not isOpportunity() which also checks the category
  // set, creating a tautology that prevents the remap from ever firing).
  if (OPPORTUNITY_CATS.has(cat)) {
    const looksLikeOpp = contentLooksLikeOpportunity(a.title ?? "", a.summary);
    if (!looksLikeOpp) {
      return a.geoTag === "HT" || a.vertical === "haiti" ? "local_news" : "news";
    }
  }
  return cat;
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

  const [rawFeed, closingScholarships, trendingArticles] = await Promise.all([
    safeFetch(() => fetchEnrichedFeed(lang, 80), [], "enrichedFeed"),
    safeFetch(() => fetchScholarshipsClosingSoon(60), [], "scholarships"),
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
  const haitiArticles = rankedFeed.filter((a) => isHaiti(a) && !isOpportunity(a));
  // General news: not opportunities, not haiti-specific
  const generalNews = rankedFeed.filter((a) => !isOpportunity(a) && !isHaiti(a));

  // Hero: pick top articles with images first, prefer non-opportunity
  const heroPool = rankedFeed.filter((a) => !isOpportunity(a));
  const heroWithImage = heroPool.filter((a) => !!a.imageUrl);
  const heroFallback = heroPool.filter((a) => !a.imageUrl);
  const heroArticles = [...heroWithImage, ...heroFallback].slice(0, 4);

  const leadArticle = heroArticles[0] ?? null;
  const secondaryHero = heroArticles.slice(1, 4);

  // Latest news: chronological (most recent first), skip opportunities and
  // utility items so the section feels like a real "breaking news" feed.
  const latestNews = filteredFeed
    .filter((a) => !isOpportunity(a) && a.itemType !== "utility")
    .slice(0, 6);

  // Histoire du jour — most recent HaitiHistory or daily_fact utility item
  const histoireArticle = filteredFeed.find(
    (a) =>
      a.itemType === "utility" &&
      (a.utilityType === "history"),
  ) ?? null;

  // Opportunities spotlight
  const featuredOpp = opportunities[0] ?? null;
  const moreOpps = opportunities.slice(1, 6);

  // World articles (international, non-Haiti)
  const WORLD_KEYWORDS = [
    "international", "géopolitique", "diplomatie", "monde", "world",
    "global", "ONU", "nations unies", "conflict", "conflit",
    "migration", "climat", "économie mondiale",
  ];
  const worldArticles = rankedFeed.filter(
    (a) =>
      !isOpportunity(a) &&
      !isHaiti(a) &&
      (a.vertical === "world" ||
        a.geoTag === "Global" ||
        (a.category === "news" &&
          WORLD_KEYWORDS.some((kw) =>
            `${a.title ?? ""} ${a.summary ?? ""}`.toLowerCase().includes(kw.toLowerCase()),
          ))),
  );

  // Education articles — use word-boundary regex to avoid substring matches
  // (e.g. "informations" should not match "formation").
  // Dropped "étudiant" (too ambiguous: music articles "inspire les étudiants")
  // and "formation" (matches "information", military training, etc.).
  const EDUCATION_RE = /\b(?:universit[eé]|education|[eé]ducation|enseignement|school|lyc[eé]e|academic|iniv[eè]site|edikasyon|UEH|MENFP|facult[eé]|scolaire)\b/i;
  const educationArticles = rankedFeed.filter(
    (a) =>
      !isOpportunity(a) &&
      (a.vertical === "education" ||
        EDUCATION_RE.test(`${a.title ?? ""} ${a.summary ?? ""}`)),
  );

  // Business articles — word-boundary regex to avoid false positives.
  // Dropped ambiguous terms: "marché" (physical markets / street vendors),
  // "finance/financement" (crime financing), "commerce" (street commerce).
  const BUSINESS_RE = /\b(?:[eé]conomie|economy|business|entreprise|startup|carri[eè]re|investissement|entrepreneurship|ekonomi|biznis|PIB|croissance\s+[eé]conomique)\b/i;
  const businessArticles = rankedFeed.filter(
    (a) =>
      !isOpportunity(a) &&
      (a.vertical === "business" ||
        BUSINESS_RE.test(`${a.title ?? ""} ${a.summary ?? ""}`)),
  );

  // Category highlights
  const topHaiti = haitiArticles[0] ?? null;
  const moreHaiti = haitiArticles.slice(1, 4);
  const topWorld = worldArticles[0] ?? null;
  const moreWorld = worldArticles.slice(1, 4);
  const topEdu = educationArticles[0] ?? null;
  const moreEdu = educationArticles.slice(1, 4);
  const topBusiness = businessArticles[0] ?? null;
  const moreBusiness = businessArticles.slice(1, 4);

  // Editor's picks: high-quality articles not yet shown in other sections
  const shownIds = new Set(
    [
      leadArticle?.id,
      ...secondaryHero.map((a) => a.id),
      ...latestNews.map((a) => a.id),
      featuredOpp?.id,
      ...moreOpps.map((a) => a.id),
      topHaiti?.id, ...moreHaiti.map((a) => a.id),
      topWorld?.id, ...moreWorld.map((a) => a.id),
      topEdu?.id, ...moreEdu.map((a) => a.id),
      topBusiness?.id, ...moreBusiness.map((a) => a.id),
    ].filter(Boolean),
  );
  const editorPicks = rankedFeed
    .filter((a) => !shownIds.has(a.id) && a.imageUrl)
    .slice(0, 4);

  // ── Render ────────────────────────────────────────────────────────────────

  // Today's date label for the editorial dateline
  const todayLabel = new Date().toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Port-au-Prince",
  });

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
      {(latestNews.length > 0 || trendingArticles.length > 0) && (
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
              {trendingArticles.length > 0 && (
                <div className="lg:col-span-4 lg:border-l lg:border-stone-200 lg:dark:border-stone-800 lg:pl-8">
                  <h2 className="mb-5 text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-white border-b-2 border-stone-900 dark:border-white pb-1">
                    {fr ? "Les plus lus" : "Plis li yo"}
                  </h2>
                  <ol className="space-y-5">
                    {trendingArticles.slice(0, 5).map((article, idx) => (
                      <li key={article.id}>
                        <Link href={lq(`/news/${article.id}`)} className="group flex gap-3">
                          <span className="shrink-0 text-2xl font-black leading-none text-stone-200 dark:text-stone-800 mt-0.5">
                            {idx + 1}
                          </span>
                          <h3 className="text-sm font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors">
                            {article.title}
                          </h3>
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
