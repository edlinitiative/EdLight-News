/**
 * OpportunityCard — extends ArticleCard with opportunity-specific chips.
 *
 * Renders Level, Region, and Deadline chips below the category badge row.
 * Uses deriveSubcategory / inferLevel / inferRegion from lib/opportunities.
 */

"use client";

import type { ContentLanguage } from "@edlight-news/types";
import { GraduationCap, Globe, MapPin, CalendarClock } from "lucide-react";
import type { FeedItem } from "@/components/news-feed";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import {
  categoryLabel,
  CATEGORY_COLORS,
  formatDate,
} from "@/lib/utils";
import {
  inferLevel,
  inferRegion,
  levelLabel,
  regionLabel,
  parseDeadline,
} from "@/lib/opportunities";

/** Category → fallback gradient CSS for cards without images */
const FALLBACK_GRADIENTS: Record<string, string> = {
  scholarship: "from-blue-800 to-purple-700",
  opportunity: "from-purple-700 to-pink-600",
  news:        "from-teal-700 to-blue-800",
  event:       "from-orange-700 to-red-700",
  resource:    "from-green-700 to-cyan-700",
  local_news:  "from-red-700 to-blue-800",
};
const DEFAULT_FALLBACK_GRADIENT = "from-slate-700 to-slate-900";

export interface OpportunityCardProps {
  article: FeedItem;
  lang: ContentLanguage;
}

export function OpportunityCard({ article, lang }: OpportunityCardProps) {
  const catColor = article.category
    ? (CATEGORY_COLORS[article.category] ?? "bg-gray-100 text-gray-600")
    : null;

  const hasImage = !!article.imageUrl;
  const fallbackGradient =
    FALLBACK_GRADIENTS[article.category ?? ""] ?? DEFAULT_FALLBACK_GRADIENT;

  // ── Derived chips ────────────────────────────────────────────────────────
  const level = inferLevel(article);
  const region = inferRegion(article);
  const deadline = parseDeadline(article, lang);

  return (
    <a
      href={`/news/${article.id}?lang=${lang}`}
      className="group flex flex-col rounded-lg border bg-white transition hover:border-brand-300 hover:shadow-md overflow-hidden"
    >
      {/* Image / gradient thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
        {hasImage ? (
          <img
            src={article.imageUrl!}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div
            className={`h-full w-full bg-gradient-to-br ${fallbackGradient} flex items-end p-4`}
          >
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              {categoryLabel(article.category, lang)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* Category badge */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {catColor && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${catColor}`}
            >
              {categoryLabel(article.category, lang)}
            </span>
          )}
        </div>

        {/* Chips row: Level · Region · Deadline */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {level && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
              <GraduationCap className="h-3 w-3" />
              {levelLabel(level, lang)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-600">
            {region === "haiti" ? (
              <MapPin className="h-3 w-3" />
            ) : (
              <Globe className="h-3 w-3" />
            )}
            {regionLabel(region, lang)}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              deadline.missing
                ? "bg-amber-50 text-amber-600"
                : "bg-orange-50 text-orange-600"
            }`}
          >
            <CalendarClock className="h-3 w-3" />
            {deadline.missing
              ? (lang === "fr" ? "Deadline à confirmer" : "Dat limit pou konfime")
              : `${lang === "fr" ? "Clôture" : "Fèmti"}: ${deadline.label}`}
          </span>
          {!deadline.missing && deadline.iso && (
            <DeadlineBadge
              dateISO={deadline.iso}
              windowDays={30}
              lang={lang}
              variant="compact"
            />
          )}
        </div>

        {/* Title */}
        <h2 className="mb-2 text-base font-semibold leading-snug group-hover:text-brand-700">
          {article.title}
        </h2>

        {/* Summary */}
        <p className="mb-3 line-clamp-2 flex-1 text-sm text-gray-500">
          {article.summary || article.body?.slice(0, 150) || ""}
        </p>

        {/* Footer */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
          {article.sourceName && <span>{article.sourceName}</span>}
          {article.sourceName && article.publishedAt && <span>·</span>}
          {article.publishedAt && (
            <span>{formatDate(article.publishedAt, lang)}</span>
          )}
        </div>
      </div>
    </a>
  );
}
