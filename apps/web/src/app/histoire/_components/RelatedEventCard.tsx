"use client";

/**
 * RelatedEventCard — card for secondary historical events.
 *
 * Used in the "Aussi ce jour-là" grid section. Features:
 * - 4:3 aspect ratio image with hover scale + Wikipedia badge
 * - Year + divider + category badge
 * - Headline with hover color shift
 * - Summary text (line-clamped)
 * - Optional date pill
 */

import { Globe } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { TAG_LABELS, formatMonthDay } from "./shared";
import type { SerializableAlmanacEntry } from "./shared";
import { useWikiImage } from "./useWikiImage";

const ILLUSTRATION_MIN_CONFIDENCE = 0.55;

interface RelatedEventCardProps {
  entry: SerializableAlmanacEntry;
  lang: ContentLanguage;
  showDate?: boolean;
}

export function RelatedEventCard({
  entry,
  lang,
  showDate = false,
}: RelatedEventCardProps) {
  const fr = lang === "fr";

  // ── Image resolution ────────────────────────────────────────────────────
  const hasOwnIllustration =
    !!entry.illustration?.imageUrl &&
    (entry.illustration.confidence ?? 0) >= ILLUSTRATION_MIN_CONFIDENCE;

  const { url: wikiUrl } = useWikiImage(
    hasOwnIllustration ? null : (fr ? entry.title_fr : (entry.title_ht ?? entry.title_fr)),
    hasOwnIllustration ? null : (entry.year ?? null),
  );

  const imageUrl = hasOwnIllustration ? entry.illustration!.imageUrl : wikiUrl;
  const isWikiImage = !hasOwnIllustration && !!wikiUrl;

  // ── Derived text ────────────────────────────────────────────────────────
  const title = fr ? entry.title_fr : (entry.title_ht ?? entry.title_fr);
  const summary = fr ? entry.summary_fr : (entry.summary_ht ?? entry.summary_fr);
  const imageAlt = (fr ? "Illustration : " : "Illustrasyon : ") + title;

  // First tag label
  const firstTag = entry.tags?.[0];
  const tagLabel = firstTag
    ? (fr ? TAG_LABELS[firstTag]?.fr : TAG_LABELS[firstTag]?.ht) ?? firstTag
    : null;

  // Date pill
  const datePill =
    showDate && entry.monthDay
      ? formatMonthDay(entry.monthDay, lang)
      : null;

  return (
    <article className="group overflow-hidden rounded-[1.25rem] border border-black/5 bg-white shadow-[0_10px_30px_rgba(29,27,26,0.05)] transition-all hover:shadow-[0_20px_50px_rgba(29,27,26,0.08)] dark:border-stone-700/40 dark:bg-stone-800 dark:hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
      {/* Image */}
      {imageUrl && (
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f3ecea] dark:bg-stone-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageAlt}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
          {isWikiImage && (
            <span className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-medium text-white/80">
              <Globe className="h-2 w-2" />
            </span>
          )}
        </div>
      )}

      {/* Fallback when no image */}
      {!imageUrl && (
        <div className="aspect-[4/3] bg-[#f3ecea] dark:bg-stone-700" />
      )}

      {/* Content */}
      <div className="p-6">
        {/* Year + divider + category */}
        <div className="mb-4 flex items-center gap-3">
          <span className="font-display text-2xl font-extrabold text-[#0051d5] dark:text-blue-400">
            {entry.year}
          </span>
          <div className="h-px flex-1 bg-black/10 dark:bg-stone-600" />
          {tagLabel && (
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#464555]/65 dark:text-stone-500">
              {tagLabel}
            </span>
          )}
        </div>

        {/* Headline */}
        <h3 className="mb-3 font-display text-xl font-bold leading-tight transition-colors group-hover:text-[#3525cd] dark:text-white dark:group-hover:text-indigo-400">
          {title}
        </h3>

        {/* Summary */}
        <p className="line-clamp-3 text-sm leading-7 text-[#464555] dark:text-stone-400">
          {summary}
        </p>

        {/* Date pill */}
        {datePill && (
          <div className="mt-4">
            <span className="inline-block rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600 dark:bg-stone-700 dark:text-stone-300">
              {datePill}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}
