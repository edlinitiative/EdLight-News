/**
 * HomepageBoursesLed — bourses-led homepage variant.
 *
 * Section order (PRD):
 *   1. Hero (bourses + à la une)        — HeroBoursesLed
 *   2. Bourses qui ferment bientôt      — BoursesUrgent
 *   3. Dernières opportunités           — OpportunitesRecentes
 *   4. Histoire d'Haïti du jour         — single compact card
 *   5. Actualités                       — condensed grid (max 6)
 *   6. Les plus lus                     — trending sidebar list
 *   7. Newsletter                       — dual-stream
 *
 * Server component. Renders all data passed in from page.tsx.
 */

import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import type { SerializedScholarship } from "@/components/BoursesFilters";

import { HeroBoursesLed } from "./HeroBoursesLed";
import { BoursesUrgent } from "./BoursesUrgent";
import { OpportunitesRecentes } from "./OpportunitesRecentes";
import { NewsletterForm } from "@/components/NewsletterForm";
import { withLangParam, formatRelativeDate } from "@/lib/utils";

interface Props {
  lang: ContentLanguage;
  heroBourses: SerializedScholarship[];
  urgentBourses: SerializedScholarship[];
  recentBourses: SerializedScholarship[];
  featuredNews: FeedItem | null;
  newsGrid: FeedItem[];
  trending: FeedItem[];
  histoire: FeedItem | null;
}

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

export function HomepageBoursesLed({
  lang,
  heroBourses,
  urgentBourses,
  recentBourses,
  featuredNews,
  newsGrid,
  trending,
  histoire,
}: Props) {
  const fr = lang === "fr";
  const lq = (path: string) => withLangParam(path, lang);

  return (
    <div className="pb-24">
      {/* 1 ── Hero ─────────────────────────────────────────────────── */}
      <HeroBoursesLed
        bourses={heroBourses}
        featuredNews={featuredNews}
        lang={lang}
      />

      {/* 2 ── Bourses qui ferment bientôt ─────────────────────────── */}
      <BoursesUrgent bourses={urgentBourses} lang={lang} />

      {/* 3 ── Dernières opportunités ──────────────────────────────── */}
      <OpportunitesRecentes bourses={recentBourses} lang={lang} />

      {/* 4 ── Histoire d'Haïti du jour (compact) ──────────────────── */}
      {histoire && (
        <section className="border-b border-stone-200 dark:border-stone-800">
          <Link
            href={lq(`/news/${histoire.id}`)}
            className="group block bg-stone-950 px-4 py-6 sm:px-6 lg:px-8"
          >
            <div className="mx-auto flex max-w-6xl items-center gap-4 sm:gap-8">
              <div className="shrink-0">
                <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-amber-400">
                  {fr ? "Histoire du jour" : "Istwa jodi a"}
                </span>
              </div>
              <div className="min-w-0 flex-1 border-l border-stone-800 pl-4 sm:pl-8">
                <h2 className="font-serif text-base font-bold leading-snug text-white group-hover:text-amber-100 transition-colors line-clamp-2 sm:text-lg">
                  {histoire.title}
                </h2>
              </div>
              <span className="hidden shrink-0 text-xs font-bold text-amber-400 group-hover:text-amber-300 transition-colors sm:block">
                {fr ? "Lire" : "Li"} →
              </span>
            </div>
          </Link>
        </section>
      )}

      {/* 5 ── Actualités (condensed, max 6) ───────────────────────── */}
      {newsGrid.length > 0 && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionRule
              label={fr ? "Actualités" : "Nouvèl"}
              href={lq("/news")}
              linkLabel={fr ? "Voir tout" : "Wè tout"}
            />
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {newsGrid.slice(0, 6).map((article) => (
                <Link
                  key={article.id}
                  href={lq(`/news/${article.id}`)}
                  className="group block"
                >
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
                      <span className="font-normal">
                        {" · "}
                        {formatRelativeDate(article.publishedAt, lang)}
                      </span>
                    )}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6 ── Les plus lus ─────────────────────────────────────────── */}
      {trending.length > 0 && (
        <section className="border-b border-stone-200 dark:border-stone-800 py-8">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionRule label={fr ? "Les plus lus" : "Plis li yo"} />
            <ol className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {trending.slice(0, 6).map((article, idx) => (
                <li key={article.id}>
                  <Link
                    href={lq(`/news/${article.id}`)}
                    className="group flex items-start gap-3"
                  >
                    <span className="shrink-0 min-w-[24px] text-center text-2xl font-black leading-none select-none text-stone-200 dark:text-stone-800">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="text-[13px] font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors line-clamp-3">
                        {article.title}
                      </h3>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-600">
                        {article.sourceName}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {/* 7 ── Newsletter (dual-stream) ─────────────────────────────── */}
      <section className="bg-stone-950 py-14">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-stone-500">
            {fr ? "Newsletter" : "Nyouzletè"}
          </p>
          <h2 className="mb-2 font-serif text-2xl font-black tracking-tight text-white">
            {fr ? "Restez informé" : "Rete enfòme"}
          </h2>
          <p className="mb-6 text-sm text-stone-400">
            {fr
              ? "Choisissez les éditions qui vous intéressent."
              : "Chwazi edisyon ki enterese w yo."}
          </p>
          <div className="mx-auto max-w-md text-left [&_input]:border-stone-700 [&_input]:bg-stone-900 [&_input]:text-white [&_input]:placeholder-stone-500 [&_button[type=submit]]:bg-white [&_button[type=submit]]:text-stone-950 [&_button[type=submit]]:hover:bg-stone-100">
            <NewsletterForm lang={lang} variant="homepage" source="footer" dualStream />
          </div>
        </div>
      </section>
    </div>
  );
}
