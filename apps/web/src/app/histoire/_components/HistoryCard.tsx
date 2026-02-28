"use client";

/**
 * HistoryCard — compact card for secondary almanac entries.
 *
 * Designed to be visually lighter than the HeroFact.
 * - Smaller image (h-32)
 * - Line-clamped summary (2 lines)
 * - No sources accordion (keeps the grid scannable)
 * - Wiki image fallback preserved
 */

import Image from "next/image";
import { Globe } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { TAG_LABELS, formatMonthDay } from "./shared";
import type { SerializableAlmanacEntry } from "./shared";
import { useWikiImage } from "./useWikiImage";

const ILLUSTRATION_MIN_CONFIDENCE = 0.55;

function shouldShowIllustration(entry: SerializableAlmanacEntry): boolean {
  if (!entry.illustration?.imageUrl) return false;
  const confidence = entry.illustration.confidence;
  if (typeof confidence !== "number") return true;
  return confidence >= ILLUSTRATION_MIN_CONFIDENCE;
}

interface HistoryCardProps {
  entry: SerializableAlmanacEntry;
  lang: ContentLanguage;
  /** When showing entries from a date range, display the date on each card */
  showDate?: boolean;
}

export function HistoryCard({ entry, lang, showDate }: HistoryCardProps) {
  const fr = lang === "fr";
  const hasOwnIllustration = shouldShowIllustration(entry);

  // Fall back to Wikipedia image when no illustration exists
  const wikiQuery = !hasOwnIllustration ? entry.title_fr : null;
  const { url: wikiThumb } = useWikiImage(wikiQuery, entry.year);

  const imageUrl = hasOwnIllustration ? entry.illustration!.imageUrl : wikiThumb;
  const isWikiImage = !hasOwnIllustration && !!wikiThumb;

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md dark:border-stone-700 dark:bg-stone-800">
      {/* Image — compact */}
      {imageUrl && (
        <div className="relative h-32 w-full overflow-hidden">
          {isWikiImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={imageUrl}
              alt={entry.title_fr}
              className="h-full w-full object-cover transition group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <Image
              src={imageUrl}
              alt={entry.title_fr}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover transition group-hover:scale-[1.03]"
            />
          )}
          {isWikiImage && (
            <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/50 px-1.5 py-0.5 text-[8px] font-medium text-white/80 backdrop-blur-sm">
              <Globe className="h-2 w-2" />
              Wikipedia
            </span>
          )}
        </div>
      )}

      {/* Body — tight */}
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        {/* Year + date + tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          {entry.year != null && (
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {entry.year}
            </span>
          )}
          {showDate && (
            <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-stone-700 dark:text-stone-300">
              {formatMonthDay(entry.monthDay, lang)}
            </span>
          )}
          {entry.tags?.slice(0, 2).map((tag) => {
            const t = TAG_LABELS[tag];
            return (
              <span
                key={tag}
                className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${t?.color ?? "bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300"}`}
              >
                {fr ? t?.fr : t?.ht}
              </span>
            );
          })}
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-bold leading-snug text-stone-900 dark:text-white">
          {entry.title_fr}
        </h3>

        {/* Summary — 2-line clamp */}
        <p className="line-clamp-2 text-[13px] leading-relaxed text-stone-500 dark:text-stone-400">
          {entry.summary_fr}
        </p>

        {/* Takeaway — ultra-compact */}
        {entry.student_takeaway_fr && (
          <p className="line-clamp-1 text-[11px] italic text-amber-700 dark:text-amber-400">
            💡 {entry.student_takeaway_fr}
          </p>
        )}
      </div>
    </article>
  );
}
