"use client";

/**
 * HeroFact — editorial card for the day's featured historical event.
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │  Compact image (3:1, wiki fallback)  │
 *   ├──────────────────────────────────────┤
 *   │  Year pill  ·  Category tags         │
 *   │  SERIF HEADLINE                      │
 *   │  Full summary (no line-clamp)        │
 *   │  💡 "Pourquoi c'est important"       │
 *   │  Sources (inline links)              │
 *   └──────────────────────────────────────┘
 */

import Image from "next/image";
import { Lightbulb, ExternalLink, Globe, ShieldCheck } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { TAG_LABELS, formatMonthDay, toISODate } from "./shared";
import type { SerializableAlmanacEntry } from "./shared";
import { useWikiImage } from "./useWikiImage";

const ILLUSTRATION_MIN_CONFIDENCE = 0.55;

function hasOwnIllustration(entry: SerializableAlmanacEntry): boolean {
  if (!entry.illustration?.imageUrl) return false;
  const c = entry.illustration.confidence;
  if (typeof c !== "number") return true;
  return c >= ILLUSTRATION_MIN_CONFIDENCE;
}

interface HeroFactProps {
  entry: SerializableAlmanacEntry;
  lang: ContentLanguage;
  /** Show date chip when viewing a range */
  showDate?: boolean;
}

export function HeroFact({ entry, lang, showDate }: HeroFactProps) {
  const fr = lang === "fr";
  const ownIllustration = hasOwnIllustration(entry);

  // Wikipedia fallback
  const wikiQuery = !ownIllustration ? entry.title_fr : null;
  const { url: wikiThumb } = useWikiImage(wikiQuery, entry.year);

  const imageUrl = ownIllustration ? entry.illustration!.imageUrl : wikiThumb;
  const isWikiImage = !ownIllustration && !!wikiThumb;

  return (
    <article className="group overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-md transition-shadow hover:shadow-lg dark:border-stone-700/60 dark:bg-stone-800">
      {/* ── Image (cinematic — 16:9) ──────────────────────── */}
      {imageUrl && (
        <div className="relative aspect-[16/9] max-h-72 w-full overflow-hidden sm:aspect-[2.5/1]">
          {isWikiImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={`${fr ? "Illustration :" : "Illustrasyon :"} ${fr ? entry.title_fr : (entry.title_ht ?? entry.title_fr)}`}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <Image
              src={imageUrl}
              alt={`${fr ? "Illustration :" : "Illustrasyon :"} ${fr ? entry.title_fr : (entry.title_ht ?? entry.title_fr)}`}
              fill
              sizes="(max-width: 768px) 100vw, 960px"
              className="object-cover transition duration-500 group-hover:scale-[1.03]"
              priority
            />
          )}
          {/* Gradient overlay for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Year + tags on image */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              {entry.year != null && (
                <time
                  dateTime={toISODate(entry.monthDay, entry.year)}
                  className="rounded-lg bg-white px-2.5 py-1 text-sm font-extrabold tabular-nums text-stone-900 shadow-sm dark:bg-stone-900 dark:text-white"
                >
                  {entry.year}
                </time>
              )}
              {showDate && (
                <time
                  dateTime={toISODate(entry.monthDay, entry.year)}
                  className="rounded-lg bg-white px-2 py-0.5 text-xs font-semibold text-stone-700 dark:bg-stone-900 dark:text-stone-200"
                >
                  {formatMonthDay(entry.monthDay, lang)}
                </time>
              )}
              {entry.tags?.slice(0, 2).map((tag) => {
                const t = TAG_LABELS[tag];
                return (
                  <span
                    key={tag}
                    className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-stone-800 dark:bg-stone-900 dark:text-stone-200"
                  >
                    {fr ? t?.fr : t?.ht}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Wiki badge */}
          {isWikiImage && (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white/80">
              <Globe className="h-2.5 w-2.5" />
              Wikipedia
            </span>
          )}
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="space-y-4 p-6 sm:p-8">
        {/* Tags row (shown when no image) */}
        {!imageUrl && (
          <div className="flex flex-wrap items-center gap-2">
            {entry.year != null && (
              <time
                dateTime={toISODate(entry.monthDay, entry.year)}
                className="rounded-md bg-blue-50 px-2.5 py-1 text-sm font-extrabold tabular-nums text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              >
                {entry.year}
              </time>
            )}
            {showDate && (
              <time
                dateTime={toISODate(entry.monthDay, entry.year)}
                className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-700 dark:text-stone-300"
              >
                {formatMonthDay(entry.monthDay, lang)}
              </time>
            )}
            {entry.tags?.slice(0, 3).map((tag) => {
              const t = TAG_LABELS[tag];
              return (
                <span
                  key={tag}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${t?.color ?? "bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300"}`}
                >
                  {fr ? t?.fr : t?.ht}
                </span>
              );
            })}
          </div>
        )}

        {/* Headline — uses serif editorial style */}
        <h2 className="font-serif text-2xl font-bold italic leading-snug tracking-tight text-stone-900 dark:text-white sm:text-3xl">
          {fr ? entry.title_fr : (entry.title_ht ?? entry.title_fr)}
        </h2>

        {/* Full summary — no clamp */}
        <p className="text-[15px] leading-[1.8] text-stone-600 dark:text-stone-300">
          {fr ? entry.summary_fr : (entry.summary_ht ?? entry.summary_fr)}
        </p>

        {/* Takeaway callout */}
        {entry.student_takeaway_fr && (
          <div className="flex gap-3 rounded-xl border border-amber-200/40 bg-amber-50/80 p-4 dark:border-amber-700/30 dark:bg-amber-900/20">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                {fr ? "Pourquoi c\u2019est important" : "Poukisa sa enp\u00f2tan"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/70">
                {fr
                  ? entry.student_takeaway_fr
                  : (entry.student_takeaway_ht ?? entry.student_takeaway_fr)}
              </p>
            </div>
          </div>
        )}

        {/* Inline sources */}
        {entry.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 pt-3 dark:border-stone-700/50">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              <ShieldCheck className="h-3 w-3" />
              {fr ? "Sources" : "Sous"}
            </span>
            {entry.sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-stone-500 transition-colors hover:text-stone-800 hover:underline dark:text-stone-400 dark:hover:text-stone-200"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                {s.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
