"use client";

/**
 * HistoryCard — horizontal card for secondary almanac entries.
 *
 * Redesigned: horizontal image-left / text-right layout.
 * Expandable on click to reveal full summary, takeaway, and sources.
 * Uses serif `headline-card` for titles matching the editorial system.
 */

import { useState } from "react";
import Image from "next/image";
import { Globe, ChevronDown, ExternalLink, Lightbulb, ShieldCheck } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { TAG_LABELS, formatMonthDay, toISODate } from "./shared";
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
  const [expanded, setExpanded] = useState(false);
  const hasOwnIllustration = shouldShowIllustration(entry);

  // Fall back to Wikipedia image when no illustration exists
  const wikiQuery = !hasOwnIllustration ? entry.title_fr : null;
  const { url: wikiThumb } = useWikiImage(wikiQuery, entry.year);

  const imageUrl = hasOwnIllustration ? entry.illustration!.imageUrl : wikiThumb;
  const isWikiImage = !hasOwnIllustration && !!wikiThumb;

  const hasExpandableContent = !!(entry.student_takeaway_fr || (entry.sources && entry.sources.length > 0));

  return (
    <article className="group overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-stone-700 dark:bg-stone-800">
      {/* ── Horizontal layout: image left + text right ────── */}
      <div
        className="flex cursor-pointer"
        onClick={() => hasExpandableContent && setExpanded(!expanded)}
        role={hasExpandableContent ? "button" : undefined}
        aria-expanded={hasExpandableContent ? expanded : undefined}
        tabIndex={hasExpandableContent ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasExpandableContent && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        {/* Image — fixed width, aspect-square on desktop */}
        {imageUrl && (
          <div className="relative hidden h-auto w-28 shrink-0 overflow-hidden sm:block sm:w-36">
            {isWikiImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={imageUrl}
                alt={`${fr ? "Illustration :" : "Illustration :"} ${entry.title_fr}`}
                className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                loading="lazy"
              />
            ) : (
              <Image
                src={imageUrl}
                alt={`${fr ? "Illustration :" : "Illustration :"} ${entry.title_fr}`}
                fill
                sizes="144px"
                className="object-cover transition group-hover:scale-[1.03]"
              />
            )}
            {isWikiImage && (
              <span className="absolute bottom-1 right-1 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-medium text-white/80">
                <Globe className="h-2 w-2" />
              </span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
          {/* Year + date + tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            {entry.year != null && (
              <time
                dateTime={toISODate(entry.monthDay, entry.year)}
                className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
              >
                {entry.year}
              </time>
            )}
            {showDate && (
              <time
                dateTime={toISODate(entry.monthDay, entry.year)}
                className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-medium text-stone-500 dark:bg-stone-700 dark:text-stone-300"
              >
                {formatMonthDay(entry.monthDay, lang)}
              </time>
            )}
            {entry.tags?.slice(0, 2).map((tag) => {
              const t = TAG_LABELS[tag];
              return (
                <span
                  key={tag}
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${t?.color ?? "bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300"}`}
                >
                  {fr ? t?.fr : t?.ht}
                </span>
              );
            })}
          </div>

          {/* Title — serif editorial */}
          <h3 className="headline-card line-clamp-2">
            {entry.title_fr}
          </h3>

          {/* Summary — 3 lines when collapsed */}
          <p className={`text-[13px] leading-relaxed text-stone-500 dark:text-stone-400 ${expanded ? "" : "line-clamp-3"}`}>
            {entry.summary_fr}
          </p>

          {/* Expand indicator */}
          {hasExpandableContent && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
              <span>{expanded ? (fr ? "Moins" : "Mwens") : (fr ? "Lire plus" : "Li plis")}</span>
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </div>
          )}
        </div>
      </div>

      {/* ── Expanded content ──────────────────────────────── */}
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-stone-100 px-3.5 pb-4 pt-3 dark:border-stone-700/50 sm:px-4">
            {/* Takeaway */}
            {entry.student_takeaway_fr && (
              <div className="flex gap-2.5 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/20">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/70">
                  {entry.student_takeaway_fr}
                </p>
              </div>
            )}

            {/* Sources */}
            {entry.sources && entry.sources.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  <ShieldCheck className="h-2.5 w-2.5" />
                  {fr ? "Sources" : "Sous"}
                </span>
                {entry.sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <ExternalLink className="h-2 w-2" />
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
