/**
 * Accueil — Premium editorial homepage.
 *
 * Layout: Hero (lead + secondary stories) → Latest News → Opportunities
 *         → Category Highlights (Haiti | Bourses) → Editor's Picks → Stay Updated
 */

import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Instagram, Newspaper } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { fetchEnrichedFeed, getLangFromSearchParams } from "@/lib/content";
import { fetchScholarshipsClosingSoon } from "@/lib/datasets";
import { ArticleCard } from "@/components/ArticleCard";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { isTauxDuJourArticle } from "@/lib/tauxFilter";
import { buildOgMetadata } from "@/lib/og";
import {
  withLangParam,
  formatRelativeDate,
  categoryLabel,
  CATEGORY_COLORS,
} from "@/lib/utils";
import { rankFeed } from "@/lib/ranking";
import type { FeedItem } from "@/components/news-feed";

export const revalidate = 300;

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
  return (
    a.vertical === "opportunites" ||
    OPPORTUNITY_CATS.has(a.category ?? "")
  );
}

function isHaiti(a: FeedItem): boolean {
  return a.geoTag === "HT" || a.category === "local_news";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-6 flex items-center gap-4">
      <h2 className="shrink-0 text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white">
        {title}
      </h2>
      <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      {href && linkLabel && (
        <Link
          href={href}
          className="shrink-0 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
        >
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

/** Small coloured category badge */
function CategoryBadge({ category, lang }: { category?: string; lang: ContentLanguage }) {
  if (!category) return null;
  const color =
    CATEGORY_COLORS[category] ??
    "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300";
  const label = categoryLabel(category, lang);
  if (!label) return null;
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

/** Deadline pill for opportunities */
function DeadlinePill({
  deadline,
  lang,
}: {
  deadline?: string | null;
  lang: ContentLanguage;
}) {
  if (!deadline) return null;
  let label = "";
  try {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft < 0) return null;
    const locale = lang === "ht" ? "fr-HT" : "fr-FR";
    const dateStr = d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    label = lang === "fr" ? `Limite : ${dateStr}` : `Limit : ${dateStr}`;
  } catch {
    return null;
  }
  return (
    <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      {label}
    </span>
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

  const [rawFeed, closingScholarships] = await Promise.all([
    safeFetch(() => fetchEnrichedFeed(lang, 80), [], "enrichedFeed"),
    safeFetch(() => fetchScholarshipsClosingSoon(60), [], "scholarships"),
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
  const boursesArticles = rankedFeed.filter(
    (a) =>
      OPPORTUNITY_CATS.has(a.category ?? "") || a.vertical === "opportunites",
  );
  // General news: not opportunities, not haiti-specific
  const generalNews = rankedFeed.filter((a) => !isOpportunity(a) && !isHaiti(a));

  // Hero: pick top articles with images first, prefer non-opportunity
  const heroPool = rankedFeed.filter((a) => !isOpportunity(a));
  const heroWithImage = heroPool.filter((a) => !!a.imageUrl);
  const heroFallback = heroPool.filter((a) => !a.imageUrl);
  const heroArticles = [...heroWithImage, ...heroFallback].slice(0, 4);

  const leadArticle = heroArticles[0] ?? null;
  const secondaryHero = heroArticles.slice(1, 4);

  // Latest news (non-opportunity, any geo)
  const latestNews = rankedFeed.filter((a) => !isOpportunity(a)).slice(0, 6);

  // Editor's picks: highest-scored articles (avoid hero duplicates)
  const heroIds = new Set(heroArticles.map((a) => a.id));
  const latestIds = new Set(latestNews.map((a) => a.id));
  const editorsPicks = rankedFeed
    .filter((a) => !heroIds.has(a.id) && !latestIds.has(a.id) && !isOpportunity(a))
    .slice(0, 5);

  // Opportunities spotlight
  const featuredOpp = opportunities[0] ?? null;
  const moreOpps = opportunities.slice(1, 6);

  // World articles (international, non-Haiti)
  const worldArticles = rankedFeed.filter(
    (a) =>
      !isOpportunity(a) &&
      !isHaiti(a) &&
      (a.vertical === "world" ||
        a.geoTag === "GLOBAL" ||
        (!a.geoTag &&
          [
            "politics", "international", "diplomacy", "conflict",
            "environment", "science", "economy",
          ].includes(a.category ?? ""))),
  );

  // Education articles
  const educationArticles = rankedFeed.filter(
    (a) =>
      !isOpportunity(a) &&
      (a.vertical === "education" ||
        ["education", "higher_education", "universities", "research", "skills"].includes(
          a.category ?? "",
        )),
  );

  // Business articles
  const businessArticles = rankedFeed.filter(
    (a) =>
      !isOpportunity(a) &&
      (a.vertical === "business" ||
        ["business", "economy", "finance", "entrepreneurship", "startup", "trade"].includes(
          a.category ?? "",
        )),
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-16 pb-20">

      {/* ══════════════════════════════════════════════════════════════════════
          1. HERO — Lead + Secondary stories
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="-mx-4 sm:-mx-6 lg:-mx-8 border-b border-stone-200 bg-white pb-10 pt-6 dark:border-stone-800 dark:bg-stone-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

          {/* Masthead eyebrow */}
          <div className="mb-6 flex items-center gap-3 border-b border-stone-200 pb-4 dark:border-stone-800">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-stone-500 dark:text-stone-400">
              EdLight News
            </span>
            <span className="h-3.5 w-px bg-stone-300 dark:bg-stone-600" />
            <span className="text-[10px] font-medium text-stone-400 dark:text-stone-500">
              {new Date().toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>

          {leadArticle ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

              {/* ── Lead story ── */}
              <Link
                href={lq(`/news/${leadArticle.id}`)}
                className="group block"
              >
                {leadArticle.imageUrl && (
                  <div className="relative mb-4 aspect-video overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800">
                    <ImageWithFallback
                      src={leadArticle.imageUrl}
                      alt={leadArticle.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    />
                    {leadArticle.imageSource === "wikidata" && (
                      <span className="absolute bottom-2 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white/70">
                        Wikimedia
                      </span>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <CategoryBadge category={leadArticle.category} lang={lang} />
                    {leadArticle.geoTag === "HT" && (
                      <span className="rounded bg-red-50 px-2 py-0.5 text-[11px] font-bold uppercase text-red-700 dark:bg-red-950/30 dark:text-red-400">
                        {fr ? "Haïti" : "Ayiti"}
                      </span>
                    )}
                  </div>
                  <h1
                    className="text-2xl font-extrabold leading-tight tracking-tight text-stone-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400 sm:text-3xl"
                    style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
                  >
                    {leadArticle.title}
                  </h1>
                  {leadArticle.summary && (
                    <p className="line-clamp-3 text-base leading-relaxed text-stone-500 dark:text-stone-400">
                      {leadArticle.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
                    {leadArticle.sourceName && (
                      <span className="font-medium text-stone-600 dark:text-stone-300">
                        {leadArticle.sourceName}
                      </span>
                    )}
                    {leadArticle.sourceName && leadArticle.publishedAt && (
                      <span>·</span>
                    )}
                    {leadArticle.publishedAt && (
                      <span>{formatRelativeDate(leadArticle.publishedAt, lang)}</span>
                    )}
                  </div>
                </div>
              </Link>

              {/* ── Secondary stories ── */}
              {secondaryHero.length > 0 && (
                <div className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
                  {secondaryHero.map((article) => (
                    <Link
                      key={article.id}
                      href={lq(`/news/${article.id}`)}
                      className="group flex items-start gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      {article.imageUrl && (
                        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
                          <ImageWithFallback
                            src={article.imageUrl}
                            alt={article.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <CategoryBadge category={article.category} lang={lang} />
                        <h3 className="text-sm font-bold leading-snug text-stone-900 line-clamp-3 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                          {article.title}
                        </h3>
                        <p className="text-xs text-stone-400">
                          {article.publishedAt
                            ? formatRelativeDate(article.publishedAt, lang)
                            : article.sourceName}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-16 text-center">
              <Newspaper className="mx-auto mb-3 h-8 w-8 text-stone-300" />
              <p className="text-stone-400">
                {fr ? "Aucun article pour le moment." : "Pa gen atik pou kounye a."}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          2. LATEST NEWS FEED PREVIEW
         ══════════════════════════════════════════════════════════════════════ */}
      <section>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            title={fr ? "Dernières nouvelles" : "Dènye nouvèl"}
            href={lq("/news")}
            linkLabel={fr ? "Voir tout" : "Wè tout"}
          />
          {latestNews.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {latestNews.map((article) => (
                <ArticleCard key={article.id} article={article} lang={lang} />
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-stone-400">
              {fr ? "Aucun article disponible." : "Pa gen atik disponib."}
            </p>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          3. OPPORTUNITIES SPOTLIGHT
         ══════════════════════════════════════════════════════════════════════ */}
      {(featuredOpp !== null || moreOpps.length > 0 || closingScholarships.length > 0) && (
        <section className="-mx-4 sm:-mx-6 lg:-mx-8 bg-indigo-50/50 py-12 dark:bg-indigo-950/10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              title={fr ? "Opportunités" : "Okazyon"}
              href={lq("/opportunites")}
              linkLabel={fr ? "Toutes les opportunités" : "Tout okazyon yo"}
            />

            <div className="grid gap-6 lg:grid-cols-2">

              {/* Featured opportunity */}
              {featuredOpp && (
                <Link
                  href={lq(`/news/${featuredOpp.id}`)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-indigo-900/30 dark:bg-stone-900"
                >
                  {featuredOpp.imageUrl && (
                    <div className="relative aspect-video overflow-hidden bg-stone-100 dark:bg-stone-800">
                      <ImageWithFallback
                        src={featuredOpp.imageUrl}
                        alt={featuredOpp.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge category={featuredOpp.category} lang={lang} />
                      <DeadlinePill deadline={featuredOpp.deadline} lang={lang} />
                    </div>
                    <h3
                      className="text-xl font-bold leading-snug text-stone-900 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-400"
                      style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
                    >
                      {featuredOpp.title}
                    </h3>
                    {featuredOpp.summary && (
                      <p className="line-clamp-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                        {featuredOpp.summary}
                      </p>
                    )}
                    <div className="mt-auto pt-2 text-xs text-stone-400">
                      {featuredOpp.publishedAt &&
                        formatRelativeDate(featuredOpp.publishedAt, lang)}
                    </div>
                  </div>
                </Link>
              )}

              {/* Grid of smaller opportunity cards */}
              {moreOpps.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                  {moreOpps.map((opp) => (
                    <Link
                      key={opp.id}
                      href={lq(`/news/${opp.id}`)}
                      className="group flex items-start gap-3 rounded-xl border border-stone-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
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
                          <CategoryBadge category={opp.category} lang={lang} />
                          <DeadlinePill deadline={opp.deadline} lang={lang} />
                        </div>
                        <h4 className="text-sm font-bold leading-snug text-stone-900 line-clamp-2 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-400">
                          {opp.title}
                        </h4>
                        {opp.summary && (
                          <p className="text-xs text-stone-500 line-clamp-1 dark:text-stone-400">
                            {opp.summary}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Closing-soon scholarships fallback (from datasets) */}
              {featuredOpp === null && moreOpps.length === 0 && closingScholarships.length > 0 && (
                <div className="grid gap-3">
                  {closingScholarships.slice(0, 5).map((s) => (
                    <Link
                      key={s.id}
                      href={lq("/bourses")}
                      className="group flex items-start gap-3 rounded-xl border border-stone-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-stone-800 dark:bg-stone-900"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded bg-purple-50 px-2 py-0.5 text-[11px] font-bold uppercase text-purple-700 dark:bg-purple-950/30 dark:text-purple-300">
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

            {/* CTA */}
            <div className="mt-8 text-center">
              <Link
                href={lq("/opportunites")}
                className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-indigo-500"
              >
                {fr
                  ? "Voir toutes les opportunités"
                  : "Wè tout okazyon yo"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          4. CATEGORY HIGHLIGHTS — Haiti | Monde | Éducation | Business
         ══════════════════════════════════════════════════════════════════════ */}
      {(topHaiti !== null || topWorld !== null || topEdu !== null || topBusiness !== null) && (
        <section>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 md:grid-cols-2">

              {/* ── Haiti block ── */}
              {(topHaiti !== null || moreHaiti.length > 0) && (
                <div>
                  <SectionHeader
                    title={fr ? "Haïti" : "Ayiti"}
                    href={lq("/haiti")}
                    linkLabel={fr ? "Voir tout" : "Wè tout"}
                  />
                  {topHaiti && (
                    <Link
                      href={lq(`/news/${topHaiti.id}`)}
                      className="group mb-4 flex items-start gap-4"
                    >
                      {topHaiti.imageUrl && (
                        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
                          <ImageWithFallback
                            src={topHaiti.imageUrl}
                            alt={topHaiti.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <CategoryBadge category={topHaiti.category} lang={lang} />
                        <h3 className="text-base font-bold leading-snug text-stone-900 line-clamp-3 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-400">
                          {topHaiti.title}
                        </h3>
                        {topHaiti.summary && (
                          <p className="text-xs text-stone-500 line-clamp-2 dark:text-stone-400">
                            {topHaiti.summary}
                          </p>
                        )}
                      </div>
                    </Link>
                  )}
                  {moreHaiti.length > 0 && (
                    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                      {moreHaiti.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={lq(`/news/${a.id}`)}
                            className="group flex items-start gap-2 py-3"
                          >
                            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500" />
                            <span className="text-sm font-medium leading-snug text-stone-800 group-hover:text-blue-700 dark:text-stone-200 dark:group-hover:text-blue-400">
                              {a.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4">
                    <Link
                      href={lq("/haiti")}
                      className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {fr ? "Toutes les actualités d'Haïti →" : "Tout nouvèl Ayiti yo →"}
                    </Link>
                  </div>
                </div>
              )}

              {/* ── Monde block ── */}
              {(topWorld !== null || moreWorld.length > 0) && (
                <div>
                  <SectionHeader
                    title={fr ? "Monde" : "Mond"}
                    href={lq("/world")}
                    linkLabel={fr ? "Voir tout" : "Wè tout"}
                  />
                  {topWorld && (
                    <Link
                      href={lq(`/news/${topWorld.id}`)}
                      className="group mb-4 flex items-start gap-4"
                    >
                      {topWorld.imageUrl && (
                        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
                          <ImageWithFallback
                            src={topWorld.imageUrl}
                            alt={topWorld.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <CategoryBadge category={topWorld.category} lang={lang} />
                        <h3 className="text-base font-bold leading-snug text-stone-900 line-clamp-3 group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-400">
                          {topWorld.title}
                        </h3>
                        {topWorld.summary && (
                          <p className="text-xs text-stone-500 line-clamp-2 dark:text-stone-400">
                            {topWorld.summary}
                          </p>
                        )}
                      </div>
                    </Link>
                  )}
                  {moreWorld.length > 0 && (
                    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                      {moreWorld.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={lq(`/news/${a.id}`)}
                            className="group flex items-start gap-2 py-3"
                          >
                            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500" />
                            <span className="text-sm font-medium leading-snug text-stone-800 group-hover:text-emerald-700 dark:text-stone-200 dark:group-hover:text-emerald-400">
                              {a.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4">
                    <Link
                      href={lq("/world")}
                      className="text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      {fr ? "Toutes les actualités mondiales →" : "Tout nouvèl mondyal yo →"}
                    </Link>
                  </div>
                </div>
              )}

              {/* ── Éducation block ── */}
              {(topEdu !== null || moreEdu.length > 0) && (
                <div>
                  <SectionHeader
                    title={fr ? "Éducation" : "Edikasyon"}
                    href={lq("/education")}
                    linkLabel={fr ? "Voir tout" : "Wè tout"}
                  />
                  {topEdu && (
                    <Link
                      href={lq(`/news/${topEdu.id}`)}
                      className="group mb-4 flex items-start gap-4"
                    >
                      {topEdu.imageUrl && (
                        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
                          <ImageWithFallback
                            src={topEdu.imageUrl}
                            alt={topEdu.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <CategoryBadge category={topEdu.category} lang={lang} />
                        <h3 className="text-base font-bold leading-snug text-stone-900 line-clamp-3 group-hover:text-teal-700 dark:text-white dark:group-hover:text-teal-400">
                          {topEdu.title}
                        </h3>
                        {topEdu.summary && (
                          <p className="text-xs text-stone-500 line-clamp-2 dark:text-stone-400">
                            {topEdu.summary}
                          </p>
                        )}
                      </div>
                    </Link>
                  )}
                  {moreEdu.length > 0 && (
                    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                      {moreEdu.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={lq(`/news/${a.id}`)}
                            className="group flex items-start gap-2 py-3"
                          >
                            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-teal-500" />
                            <span className="text-sm font-medium leading-snug text-stone-800 group-hover:text-teal-700 dark:text-stone-200 dark:group-hover:text-teal-400">
                              {a.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4">
                    <Link
                      href={lq("/education")}
                      className="text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400"
                    >
                      {fr ? "Toutes les actualités éducatives →" : "Tout nouvèl edikasyon yo →"}
                    </Link>
                  </div>
                </div>
              )}

              {/* ── Business block ── */}
              {(topBusiness !== null || moreBusiness.length > 0) && (
                <div>
                  <SectionHeader
                    title={fr ? "Business" : "Biznis"}
                    href={lq("/business")}
                    linkLabel={fr ? "Voir tout" : "Wè tout"}
                  />
                  {topBusiness && (
                    <Link
                      href={lq(`/news/${topBusiness.id}`)}
                      className="group mb-4 flex items-start gap-4"
                    >
                      {topBusiness.imageUrl && (
                        <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
                          <ImageWithFallback
                            src={topBusiness.imageUrl}
                            alt={topBusiness.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <CategoryBadge category={topBusiness.category} lang={lang} />
                        <h3 className="text-base font-bold leading-snug text-stone-900 line-clamp-3 group-hover:text-orange-700 dark:text-white dark:group-hover:text-orange-400">
                          {topBusiness.title}
                        </h3>
                        {topBusiness.summary && (
                          <p className="text-xs text-stone-500 line-clamp-2 dark:text-stone-400">
                            {topBusiness.summary}
                          </p>
                        )}
                      </div>
                    </Link>
                  )}
                  {moreBusiness.length > 0 && (
                    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                      {moreBusiness.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={lq(`/news/${a.id}`)}
                            className="group flex items-start gap-2 py-3"
                          >
                            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-orange-500" />
                            <span className="text-sm font-medium leading-snug text-stone-800 group-hover:text-orange-700 dark:text-stone-200 dark:group-hover:text-orange-400">
                              {a.title}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4">
                    <Link
                      href={lq("/business")}
                      className="text-xs font-semibold text-orange-600 hover:underline dark:text-orange-400"
                    >
                      {fr ? "Toutes les actualités économiques →" : "Tout nouvèl ekonomik yo →"}
                    </Link>
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          5. EDITOR'S PICKS
         ══════════════════════════════════════════════════════════════════════ */}
      {editorsPicks.length > 0 && (
        <section>
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHeader
              title={fr ? "À ne pas manquer" : "Pa manke sa yo"}
              href={lq("/news")}
              linkLabel={fr ? "Voir tout" : "Wè tout"}
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {editorsPicks.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  lang={lang}
                  variant="compact"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          6. STAY UPDATED MODULE
         ══════════════════════════════════════════════════════════════════════ */}
      <section className="-mx-4 sm:-mx-6 lg:-mx-8 bg-stone-50 py-12 dark:bg-stone-900/50">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-lg">
              <Instagram className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white">
              {fr
                ? "Suivez EdLight News sur Instagram"
                : "Swiv EdLight News sou Instagram"}
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-stone-500 dark:text-stone-400">
              {fr
                ? "Bourses, opportunités et actualités — directement dans votre fil Instagram."
                : "Bous, okazyon ak nouvèl — dirèkteman nan fil Instagram ou."}
            </p>
            <a
              href="https://www.instagram.com/edlightnews/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 px-6 py-2.5 text-sm font-semibold text-white shadow transition hover:opacity-90"
            >
              <Instagram className="h-4 w-4" />
              @edlightnews
            </a>
          </div>
        </div>
      </section>

    </div>
  );
}
