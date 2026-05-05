/**
 * HeroBoursesLed — homepage hero, bourses-led variant.
 *
 * Two-block layout (PRD §1):
 *   • Primary (lg:8/12): "Bourses ouvertes" — 3-5 closing-soonest scholarships
 *     with deadline countdown badges and a "Postuler →" link.
 *   • Secondary (lg:4/12): "À la une" — single featured news article.
 *
 * Server component. Client interactivity (analytics tracking on bourse
 * clicks) is delegated to <BourseHeroLink> below.
 */

import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import type { FeedItem } from "@/components/news-feed";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { withLangParam, formatRelativeDate } from "@/lib/utils";
import {
  parseISODateSafe,
  daysUntil,
  formatDaysLabel,
  urgencyTier,
} from "@/lib/deadlines";
import { BourseHeroLink } from "./BourseHeroLink";

interface Props {
  bourses: SerializedScholarship[];
  featuredNews: FeedItem | null;
  lang: ContentLanguage;
}

function urgencyBadgeClasses(tier: ReturnType<typeof urgencyTier>): string {
  switch (tier) {
    case "critical":
      return "bg-red-50 text-red-700 ring-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/30";
    case "soon":
      return "bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/30";
    default:
      return "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/30";
  }
}

export function HeroBoursesLed({ bourses, featuredNews, lang }: Props) {
  const fr = lang === "fr";
  const lq = (path: string) => withLangParam(path, lang);

  const title = fr
    ? "Bourses + actualités pour étudiants haïtiens"
    : "Bous + nouvèl pou etidyan ayisyen";
  const subtitle = fr
    ? "Opportunités vérifiées. Mises à jour chaque jour."
    : "Opòtinite verifye. Mete ajou chak jou.";

  return (
    <section className="border-b border-stone-200 dark:border-stone-800 py-8 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* ── Hero header (full-width) ─────────────────────────────────── */}
        <header className="mb-8">
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-primary">
            EdLight News
          </p>
          <h1 className="font-serif text-3xl font-black leading-[1.05] tracking-tight text-stone-950 dark:text-white sm:text-4xl lg:text-[2.6rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-600 dark:text-stone-400">
            {subtitle}
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          {/* ── PRIMARY (lg:8) — Bourses ouvertes ─────────────────────── */}
          <div className="lg:col-span-7">
            <div className="mb-4 flex items-baseline justify-between border-t-2 border-stone-900 dark:border-white pt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-900 dark:text-white">
                {fr ? "Bourses ouvertes" : "Bous ki louvri"}
              </p>
              <Link
                href={lq("/bourses")}
                className="text-[10px] font-semibold text-primary hover:underline"
              >
                {fr ? "Voir toutes les bourses" : "Wè tout bous yo"} →
              </Link>
            </div>

            {bourses.length === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {fr
                  ? "Aucune bourse à afficher pour le moment."
                  : "Pa gen bous pou montre kounye a."}
              </p>
            ) : (
              <ol className="divide-y divide-stone-100 dark:divide-stone-800">
                {bourses.map((b, idx) => {
                  const iso = b.deadline?.dateISO;
                  const date = iso ? parseISODateSafe(iso) : null;
                  const days = date ? daysUntil(date) : null;
                  const tier =
                    days !== null && days >= 0 ? urgencyTier(days) : "none";
                  const badgeLabel =
                    days !== null && days >= 0
                      ? formatDaysLabel(days, lang, {
                          fr: "Ferme",
                          ht: "Fèmen",
                        })
                      : null;

                  return (
                    <li key={b.id} className="py-4 first:pt-0 last:pb-0">
                      <BourseHeroLink
                        href={lq(`/bourses/${b.id}`)}
                        bourseId={b.id}
                        bourseName={b.name}
                        position={idx + 1}
                        className="group block"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h2 className="font-serif text-lg font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors sm:text-xl">
                              {b.name}
                            </h2>
                            <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                              {b.country}
                              {b.level?.length ? (
                                <>
                                  <span className="mx-1.5 text-stone-300 dark:text-stone-700">
                                    ·
                                  </span>
                                  {b.level.join(" · ")}
                                </>
                              ) : null}
                            </p>
                            {badgeLabel && (
                              <span
                                className={[
                                  "mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset tabular-nums",
                                  urgencyBadgeClasses(tier),
                                ].join(" ")}
                              >
                                {badgeLabel}
                              </span>
                            )}
                          </div>
                          <span
                            className="shrink-0 self-center text-[12px] font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden="true"
                          >
                            {fr ? "Postuler" : "Aplike"} →
                          </span>
                        </div>
                      </BourseHeroLink>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* ── SECONDARY (lg:4) — À la une (one news article) ────────── */}
          <aside className="lg:col-span-5 lg:border-l lg:border-stone-200 lg:dark:border-stone-800 lg:pl-10">
            <div className="mb-4 border-t-2 border-stone-900 dark:border-white pt-2">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-stone-900 dark:text-white">
                {fr ? "À la une" : "Alaune"}
              </p>
            </div>

            {featuredNews ? (
              <Link
                href={lq(`/news/${featuredNews.id}`)}
                className="group block"
              >
                {featuredNews.imageUrl && (
                  <div
                    className="relative mb-3 overflow-hidden rounded-md bg-stone-100 dark:bg-stone-900"
                    style={{ aspectRatio: "16/9" }}
                  >
                    <ImageWithFallback
                      src={featuredNews.imageUrl}
                      alt={featuredNews.title}
                      fill
                      sizes="(max-width: 1024px) 100vw, 420px"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  </div>
                )}
                <h3 className="font-serif text-xl font-bold leading-snug text-stone-900 dark:text-white group-hover:text-primary transition-colors">
                  {featuredNews.title}
                </h3>
                {featuredNews.summary && (
                  <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400 line-clamp-3">
                    {featuredNews.summary}
                  </p>
                )}
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  {featuredNews.sourceName}
                  {featuredNews.publishedAt && (
                    <span className="font-normal">
                      {" · "}
                      {formatRelativeDate(featuredNews.publishedAt, lang)}
                    </span>
                  )}
                </p>
              </Link>
            ) : (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {fr ? "Aucune actualité à la une." : "Pa gen nouvèl alaune."}
              </p>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
