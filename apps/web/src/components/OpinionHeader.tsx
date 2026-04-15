/**
 * OpinionHeader — Alternate article header for opinion / analysis pieces.
 *
 * Differs from the default article header:
 *  • Prominent "OPINION" label badge
 *  • Larger, serif-styled title
 *  • Pull-quote forward (renders summary as a styled pull-quote)
 *  • Byline-prominent author block
 */

import type { ContentLanguage, Item } from "@edlight-news/types";
import { Feather } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface OpinionHeaderProps {
  title: string;
  summary?: string | null;
  item: Item | null;
  lang: ContentLanguage;
  publishedDate?: string | null;
  readingTime?: number;
}

export function OpinionHeader({
  title,
  summary,
  item,
  lang,
  publishedDate,
  readingTime,
}: OpinionHeaderProps) {
  const fr = lang === "fr";
  const authorName = item?.source?.name ?? "EdLight News";

  return (
    <header className="space-y-5">
      {/* Opinion badge */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-widest text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
          <Feather className="h-3.5 w-3.5" />
          {fr ? "Opinion" : "Opinyon"}
        </span>
      </div>

      {/* Title — larger, serif for editorial feel */}
      <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-stone-900 sm:text-4xl dark:text-white">
        {title}
      </h1>

      {/* Pull-quote style summary */}
      {summary && (
        <blockquote className="border-l-4 border-rose-400 pl-4 text-lg italic leading-relaxed text-stone-600 dark:border-rose-500 dark:text-stone-300">
          {summary}
        </blockquote>
      )}

      {/* Byline block */}
      <div className="flex items-center gap-3 border-t border-stone-200 pt-4 dark:border-stone-700">
        {/* Author avatar placeholder */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
          {authorName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stone-900 dark:text-white">
            {authorName}
          </p>
          <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-300">
            {publishedDate && <time>{publishedDate}</time>}
            {publishedDate && readingTime && <span>·</span>}
            {readingTime && (
              <span>
                {fr ? `${readingTime} min de lecture` : `${readingTime} min li`}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
