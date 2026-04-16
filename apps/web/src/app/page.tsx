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

  return (
    <div className="pb-20">

      {/* ══════════════════════════════════════════════════════════════════════
          1. HERO EDITORIAL — Asymmetric lead + Today's Essentials sidebar
         ══════════════════════════════════════════════════════════════════════ */}
      <HeroEditorial lead={leadArticle} secondary={secondaryHero} lang={lang} />

      {/* ══════════════════════════════════════════════════════════════════════
          2. LATEST NEWS WIRE — Editorial cards with grayscale→color hover
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="-mx-4 sm:-mx-6 lg:-mx-8 bg-gradient-to-b from-stone-50/80 to-white py-16 dark:from-stone-900/40 dark:to-stone-950 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            eyebrow={fr ? "Fil d'actualité" : "Fil aktyalite"}
            title={fr ? "Dernières nouvelles" : "Dènye nouvèl"}
            href={lq("/news")}
            linkLabel={fr ? "Voir tout" : "Wè tout"}
          />
          {latestNews.length > 0 ? (
            <>
              {/* Top row — premium editorial cards */}
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {latestNews.slice(0, 3).map((article) => (
                  <EditorialCard
                    key={article.id}
                    article={article}
                    lang={lang}
                    displayCategory={displayCategory(article)}
                  />
                ))}
              </div>
              {/* Second row — compact ArticleCards for remaining items */}
              {latestNews.length > 3 && (
                <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {latestNews.slice(3, 6).map((article) => (
                    <ArticleCard key={article.id} article={article} lang={lang} variant="compact" />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="py-8 text-center text-stone-400">
              {fr ? "Aucun article disponible." : "Pa gen atik disponib."}
            </p>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          3. TRENDING — Horizontal scroll / grid
         ══════════════════════════════════════════════════════════════════════ */}
      {trendingArticles.length > 0 && (
        <section className="-mx-4 sm:-mx-6 lg:-mx-8 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <TrendingSection articles={trendingArticles} lang={lang} />
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. OPPORTUNITIES & SCHOLARSHIPS — Bento-inspired layout
         ══════════════════════════════════════════════════════════════════════ */}
      {(featuredOpp !== null || moreOpps.length > 0 || closingScholarships.length > 0) && (
        <section className="-mx-4 sm:-mx-6 lg:-mx-8 bg-gradient-to-b from-indigo-50/40 via-indigo-50/20 to-white py-16 dark:from-indigo-950/15 dark:via-indigo-950/5 dark:to-stone-950 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              eyebrow={fr ? "Bourses & Carrières" : "Bous & Karyè"}
              title={fr ? "Opportunités" : "Okazyon"}
              href={lq("/opportunites")}
              linkLabel={fr ? "Toutes les opportunités" : "Tout okazyon yo"}
            />

            <div className="grid gap-8 lg:grid-cols-12">
              {/* Featured opportunity — spans 7 cols */}
              {featuredOpp && (
                <div className="lg:col-span-7">
                  <Link
                    href={lq(`/news/${featuredOpp.id}`)}
                    className="group block overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-indigo-900/30 dark:bg-stone-900"
                  >
                    {featuredOpp.imageUrl && (
                      <div className="relative aspect-video overflow-hidden bg-stone-100 dark:bg-stone-800">
                        <ImageWithFallback
                          src={featuredOpp.imageUrl}
                          alt={featuredOpp.title}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                        />
                      </div>
                    )}
                    <div className="flex flex-col gap-3 p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <CategoryBadge category={displayCategory(featuredOpp)} lang={lang} pill />
                        <DeadlinePill deadline={featuredOpp.deadline} lang={lang} />
                      </div>
                      <h3
                        className="text-xl font-bold leading-snug tracking-tight text-stone-900 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-400 sm:text-2xl"
                        style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
                      >
                        {featuredOpp.title}
                      </h3>
                      {featuredOpp.summary && (
                        <p className="text-sm leading-relaxed text-stone-500 line-clamp-3 dark:text-stone-400">
                          {featuredOpp.summary}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-sm">
                        {featuredOpp.sourceName && (
                          <span className="font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                            via {featuredOpp.sourceName}
                          </span>
                        )}
                        {featuredOpp.publishedAt && (
                          <span className="text-stone-400">
                            {formatRelativeDate(featuredOpp.publishedAt, lang)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              )}

              {/* Smaller opportunity cards — 5 cols */}
              <div className={featuredOpp ? "lg:col-span-5" : "lg:col-span-12"}>
                {moreOpps.length > 0 && (
                  <div className="space-y-3">
                    {moreOpps.map((opp) => (
                      <Link
                        key={opp.id}
                        href={lq(`/news/${opp.id}`)}
                        className="group flex items-start gap-4 rounded-xl border border-stone-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
                      >
                        {opp.imageUrl && (
                          <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
                            <ImageWithFallback
                              src={opp.imageUrl}
                              alt={opp.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <CategoryBadge category={displayCategory(opp)} lang={lang} pill />
                            <DeadlinePill deadline={opp.deadline} lang={lang} />
                          </div>
                          <h4 className="text-sm font-bold leading-snug text-stone-900 line-clamp-2 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-400">
                            {opp.title}
                          </h4>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                {/* Closing-soon scholarships fallback */}
                {featuredOpp === null && moreOpps.length === 0 && closingScholarships.length > 0 && (
                  <div className="space-y-3">
                    {closingScholarships.slice(0, 5).map((s) => (
                      <Link
                        key={s.id}
                        href={lq("/bourses")}
                        className="group flex items-start gap-3 rounded-xl border border-stone-100 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:bg-purple-950/30 dark:text-purple-300">
                              {fr ? "Bourse" : "Bous"}
                            </span>
                            {s.deadline?.dateISO && (
                              <DeadlinePill deadline={s.deadline.dateISO} lang={lang} />
                            )}
                          </div>
                          <h4 className="text-sm font-bold leading-snug text-stone-900 line-clamp-2 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-400">
                            {s.name}
                          </h4>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="mt-10 text-center">
              <Link
                href={lq("/opportunites")}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-md transition-all hover:bg-indigo-500 hover:shadow-lg active:scale-95"
              >
                {fr ? "Voir toutes les opportunités" : "Wè tout okazyon yo"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}



      {/* ══════════════════════════════════════════════════════════════════════
          7. STAY UPDATED — Newsletter + Instagram (premium dark band)
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="-mx-4 sm:-mx-6 lg:-mx-8 relative overflow-hidden border-t border-stone-200 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 py-16 dark:border-stone-700 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-blue-900 sm:py-20">
        {/* Decorative gradient orb */}
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -right-1/4 -top-1/4 h-96 w-96 rounded-full bg-blue-500 blur-3xl"></div>
          <div className="absolute -bottom-1/4 -left-1/4 h-96 w-96 rounded-full bg-indigo-500 blur-3xl"></div>
        </div>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 z-10">
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">

            {/* ── Newsletter panel ── */}
            <div className="flex flex-col gap-5">
              <div>
                <span className="inline-block rounded-full bg-blue-500/20 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-300">
                  {fr ? "Newsletter" : "Nyouzletè"}
                </span>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                  {fr ? "Restez informé" : "Rete enfòme"}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-stone-400">
                  {fr
                    ? "Bourses, actualités et opportunités sélectionnées — directement dans votre boîte mail, gratuitement."
                    : "Bous, nouvèl ak okazyon chwazi — dirèkteman nan bwat imèl ou, gratis."}
                </p>
              </div>
              <div className="[&_input]:border-stone-700 [&_input]:bg-stone-800 [&_input]:text-white [&_input]:placeholder-stone-500 [&_button]:bg-blue-500 [&_button]:hover:bg-blue-400 [&_p]:text-stone-500">
                <NewsletterForm lang={lang} variant="homepage" />
              </div>
            </div>

            {/* ── Instagram panel ── */}
            <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-stone-700 bg-stone-800/50 p-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-lg shadow-fuchsia-500/20">
                <Instagram className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold tracking-tight text-white">
                  {fr ? "Suivez-nous sur Instagram" : "Swiv nou sou Instagram"}
                </h3>
                <p className="mt-1 text-sm text-stone-400">
                  {fr
                    ? "Bourses et actualités en visuels — chaque jour."
                    : "Bous ak nouvèl an vizyal — chak jou."}
                </p>
              </div>
              <a
                href="https://www.instagram.com/edlightnews/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:opacity-90 active:scale-95"
              >
                <Instagram className="h-4 w-4" />
                @edlightnews
              </a>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}
