/**
 * FeaturedSpotlight — editorial card for the day's featured historical event.
 *
 * Layout (desktop): image left (7 cols) + text right (5 cols)
 * Mobile: stacks vertically
 *
 * Features: year badge, bilingual category tags, serif headline, summary,
 * student-takeaway callout, real source links.
 */

"use client";

import { Globe, Lightbulb, ExternalLink, ShieldCheck } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { TAG_LABELS, formatMonthDay, toISODate } from "./shared";
import type { SerializableAlmanacEntry } from "./shared";
import { useWikiImage } from "./useWikiImage";

interface FeaturedSpotlightProps {
  entry: SerializableAlmanacEntry;
  lang: ContentLanguage;
  showDate?: boolean;
}

export function FeaturedSpotlight({
  entry,
  lang,
  showDate = false,
}: FeaturedSpotlightProps) {
  const fr = lang === "fr";

  // ── Image resolution ──────────────────────────────────────────────────────
  const hasOwnIllustration =
    !!entry.illustration?.imageUrl &&
    (entry.illustration.confidence ?? 0) >= 0.55;

  const wiki = useWikiImage(
    hasOwnIllustration ? null : entry.title_fr,
    hasOwnIllustration ? null : (entry.year ?? null),
  );

  const imageUrl = hasOwnIllustration
    ? entry.illustration!.imageUrl
    : wiki.url;

  const isWikiImage = !hasOwnIllustration && !!wiki.url;

  // ── Derived text ──────────────────────────────────────────────────────────
  const title = fr ? entry.title_fr : (entry.title_ht ?? entry.title_fr);
  const summary = fr
    ? entry.summary_fr
    : (entry.summary_ht ?? entry.summary_fr);
  const imageAlt =
    (fr ? "Illustration : " : "Illustrasyon : ") + title;

  const hasTakeaway = !!entry.student_takeaway_fr;
  const takeawayText = hasTakeaway
    ? fr
      ? entry.student_takeaway_fr
      : (entry.student_takeaway_ht ?? entry.student_takeaway_fr)
    : null;

  const hasSources = entry.sources.length > 0;

  return (
    <section id="spotlight">
      <article className="grid grid-cols-1 overflow-hidden rounded-[1.75rem] border border-black/5 bg-white shadow-[0_20px_50px_rgba(29,27,26,0.08)] dark:border-stone-700/40 dark:bg-stone-800 xl:grid-cols-12 xl:gap-0">
        {/* ── Image column ────────────────────────────────── */}
        <figure className="relative min-h-[360px] overflow-hidden xl:col-span-7 lg:min-h-[520px]">
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt={imageAlt}
                className="absolute inset-0 h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

              {isWikiImage && (
                <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                  <Globe className="h-3 w-3" />
                  Wikipedia
                </span>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-100 dark:bg-stone-700">
              <Globe className="h-16 w-16 text-stone-300 dark:text-stone-500" />
            </div>
          )}
        </figure>

        {/* ── Text column ─────────────────────────────────── */}
        <div className="flex flex-col justify-center p-8 xl:col-span-5 md:p-10 xl:p-12">
          {/* Year + tags + optional date */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            {entry.year != null && (
              <span className="rounded-[1.25rem] bg-[#3525cd] px-4 py-2 font-display text-2xl font-extrabold text-white">
                {entry.year}
              </span>
            )}

            {entry.tags?.slice(0, 3).map((tag) => {
              const meta = TAG_LABELS[tag];
              if (!meta) return null;
              return (
                <span
                  key={tag}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${meta.color}`}
                >
                  {fr ? meta.fr : meta.ht}
                </span>
              );
            })}

            {showDate && (
              <time
                dateTime={toISODate(entry.monthDay, entry.year)}
                className="text-sm text-stone-500 dark:text-stone-400"
              >
                {formatMonthDay(entry.monthDay, lang)}
              </time>
            )}
          </div>

          {/* Headline */}
          <h3 className="mb-5 font-serif text-4xl leading-[1.02] text-[#1d1b1a] dark:text-white md:text-5xl">
            {title}
          </h3>

          {/* Summary */}
          <p className="mb-6 leading-8 text-[#464555] dark:text-stone-400">
            {summary}
          </p>

          {/* Takeaway callout */}
          {hasTakeaway && (
            <div className="mb-8 rounded-[1.25rem] border border-black/5 bg-[#f3ecea] p-6 dark:border-stone-700 dark:bg-stone-700/40">
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[#3525cd] dark:text-indigo-400" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#3525cd] dark:text-indigo-400">
                  {fr ? "Pourquoi c\u2019est important" : "Poukisa sa enpòtan"}
                </p>
              </div>
              <p className="text-sm leading-7 text-[#464555] dark:text-stone-400">
                {takeawayText}
              </p>
            </div>
          )}

          {/* Sources */}
          {hasSources && (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                {fr ? "Sources" : "Sous"}
              </span>

              {entry.sources.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-4 py-2 text-sm font-medium text-[#1d1b1a] transition-colors hover:bg-[#f3ecea] dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:hover:bg-stone-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
