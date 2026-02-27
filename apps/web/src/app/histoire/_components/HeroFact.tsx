"use client";

/**
 * HeroFact — immersive full-width card for the day's featured historical event.
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │  Large image (16:9, wiki fallback)   │
 *   ├──────────────────────────────────────┤
 *   │  Year pill  ·  Category tags         │
 *   │  BIG HEADLINE                        │
 *   │  Full summary (no line-clamp)        │
 *   │  💡 "Pourquoi c'est important"       │
 *   │  Sources (inline links)              │
 *   └──────────────────────────────────────┘
 *
 * This is the single editorial focal point of the page.
 */

import Image from "next/image";
import { Lightbulb, ExternalLink, Globe, ShieldCheck } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { TAG_LABELS, formatMonthDay } from "./shared";
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
  const { url: wikiThumb } = useWikiImage(wikiQuery);

  const imageUrl = ownIllustration ? entry.illustration!.imageUrl : wikiThumb;
  const isWikiImage = !ownIllustration && !!wikiThumb;

  return (
    <article className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-md dark:border-stone-700 dark:bg-stone-800">
      {/* ── Image (large, cinematic) ──────────────────────── */}
      {imageUrl && (
        <div className="relative aspect-[16/9] w-full overflow-hidden sm:aspect-[2.2/1]">
          {isWikiImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={entry.title_fr}
              className="h-full w-full object-cover"
            />
          ) : (
            <Image
              src={imageUrl}
              alt={entry.title_fr}
              fill
              sizes="(max-width: 768px) 100vw, 960px"
              className="object-cover"
              priority
            />
          )}
          {/* Gradient overlay for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Year + tags on image */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              {entry.year != null && (
                <span className="rounded-lg bg-white/90 px-2.5 py-1 text-sm font-extrabold tabular-nums text-stone-900 shadow-sm backdrop-blur-sm dark:bg-stone-900/80 dark:text-white">
                  {entry.year}
                </span>
              )}
              {showDate && (
                <span className="rounded-lg bg-white/80 px-2 py-0.5 text-xs font-semibold text-stone-700 backdrop-blur-sm dark:bg-stone-900/70 dark:text-stone-200">
                  {formatMonthDay(entry.monthDay, lang)}
                </span>
              )}
              {entry.tags?.slice(0, 2).map((tag) => {
                const t = TAG_LABELS[tag];
                return (
                  <span
                    key={tag}
                    className="rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-semibold text-stone-800 backdrop-blur-sm dark:bg-stone-900/70 dark:text-stone-200"
                  >
                    {fr ? t?.fr : t?.ht}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Wiki badge */}
          {isWikiImage && (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[9px] font-medium text-white/80 backdrop-blur-sm">
              <Globe className="h-2.5 w-2.5" />
              Wikipedia
            </span>
          )}
        </div>
      )}

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="space-y-4 p-5 sm:p-6">
        {/* Tags row (shown when no image) */}
        {!imageUrl && (
          <div className="flex flex-wrap items-center gap-2">
            {entry.year != null && (
              <span className="rounded-md bg-blue-50 px-2.5 py-1 text-sm font-extrabold tabular-nums text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {entry.year}
              </span>
            )}
            {showDate && (
              <span className="rounded-md bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                {formatMonthDay(entry.monthDay, lang)}
              </span>
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

        {/* Headline */}
        <h2 className="text-xl font-extrabold leading-tight tracking-tight text-stone-900 dark:text-white sm:text-2xl">
          {entry.title_fr}
        </h2>

        {/* Full summary — no clamp */}
        <p className="text-[15px] leading-relaxed text-stone-600 dark:text-stone-300">
          {entry.summary_fr}
        </p>

        {/* Takeaway callout */}
        {entry.student_takeaway_fr && (
          <div className="flex gap-3 rounded-xl bg-amber-50/80 p-4 dark:bg-amber-900/10">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                {fr ? "Pourquoi c\u2019est important" : "Poukisa sa enp\u00f2tan"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                {entry.student_takeaway_fr}
              </p>
            </div>
          </div>
        )}

        {/* Inline sources */}
        {entry.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 pt-3 dark:border-stone-700/50">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              <ShieldCheck className="h-3 w-3" />
              {fr ? "Sources" : "Sous"}
            </span>
            {entry.sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
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
