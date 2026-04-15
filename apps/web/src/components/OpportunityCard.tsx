/**
 * OpportunityCard — extends ArticleCard with opportunity-specific chips.
 *
 * Renders Level, Region, Deadline, and derived subcategory chips.
 * Shows expired badge with reduced opacity when deadline has passed.
 */

"use client";

import type { ContentLanguage } from "@edlight-news/types";
import { GraduationCap, Globe, MapPin, CalendarClock, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { FeedItem } from "@/components/news-feed";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { getDeadlineStatus, badgeStyle } from "@/lib/ui/deadlines";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import {
  formatDate,
} from "@/lib/utils";
import {
  inferLevel,
  inferRegion,
  levelLabel,
  regionLabel,
  parseDeadline,
  SUBCAT_LABELS,
  SUBCAT_COLORS,
  type OpportunitySubCat,
} from "@/lib/opportunities";
import type { ClassificationResult } from "@/lib/opportunityClassifier";
import type { DeadlineStatus } from "@/lib/opportunityDeadline";

/** Category → fallback gradient CSS for cards without images */
const FALLBACK_GRADIENTS: Record<string, string> = {
  scholarship: "from-[#3525cd] to-[#4f46e5]",
  opportunity: "from-[#4f46e5] to-[#0051d5]",
  news:        "from-[#0051d5] to-[#316bf3]",
  event:       "from-[#3525cd] to-[#316bf3]",
  resource:    "from-[#474948] to-[#1d1b1a]",
  local_news:  "from-[#0051d5] to-[#3525cd]",
};
const DEFAULT_FALLBACK_GRADIENT = "from-[#474948] to-[#1d1b1a]";

export interface OpportunityCardProps {
  article: FeedItem;
  lang: ContentLanguage;
  /** Derived subcategory from the classifier (optional — falls back to legacy). */
  derivedSubcategory?: OpportunitySubCat;
  /** Full classification result (subcategory + confidence). */
  classification?: ClassificationResult;
  /** Deadline status from the deadline utility. */
  deadlineStatus?: DeadlineStatus;
}

export function OpportunityCard({
  article,
  lang,
  derivedSubcategory,
  classification,
  deadlineStatus,
}: OpportunityCardProps) {
  const hasImage = !!article.imageUrl;
  const fallbackGradient =
    FALLBACK_GRADIENTS[article.category ?? ""] ?? DEFAULT_FALLBACK_GRADIENT;

  const isExpired = deadlineStatus?.isExpired ?? false;

  // ── Derived chips ────────────────────────────────────────────────────────
  const level = inferLevel(article);
  const region = inferRegion(article);
  const deadline = parseDeadline(article, lang);

  // Use derived subcategory (from classifier) for badge label
  const subCat = derivedSubcategory ?? "programmes";
  const subCatColor = SUBCAT_COLORS[subCat];
  const subCatLabel = SUBCAT_LABELS[subCat][lang];

  return (
    <Link
      href={`/news/${article.id}?lang=${lang}`}
      className={[
        "group flex flex-col overflow-hidden bg-white dark:bg-stone-900/80 rounded-xl border border-[#c7c4d8]/15 dark:border-stone-700/40 shadow-[0_20px_40px_rgba(29,27,26,0.05)] hover:shadow-[0_20px_40px_rgba(29,27,26,0.1)] hover:-translate-y-1 transition-all duration-300",
        isExpired ? "opacity-80" : "",
      ].join(" ")}
    >
      {/* Image / gradient thumbnail */}
      <div className="relative aspect-[5/2] w-full overflow-hidden bg-[#f9f2f0]">
        {hasImage ? (
          <ImageWithFallback
            src={article.imageUrl!}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            fallback={
              <div
                className={`h-full w-full bg-gradient-to-br ${fallbackGradient} flex items-end p-4`}
              >
                <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                  {subCatLabel}
                </span>
              </div>
            }
          />
        ) : (
          <div
            className={`h-full w-full bg-gradient-to-br ${fallbackGradient} flex items-end p-4`}
          >
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              {subCatLabel}
            </span>
          </div>
        )}

        {/* Expired overlay badge */}
        {isExpired && (
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded bg-red-600/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            <AlertCircle className="h-3 w-3" />
            {lang === "fr" ? "Expiré" : "Ekspire"}
          </div>
        )}
      </div>

      <div className="relative flex flex-1 flex-col p-4">
        {/* Category badge — uses derived subcategory */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className="rounded-full bg-[#e8e1df] px-2.5 py-0.5 text-xs font-semibold text-[#464555]"
          >
            {subCatLabel}
          </span>
          {classification && classification.confidence !== "high" && (
            <span className="rounded-full bg-[#f9f2f0] px-1.5 py-0.5 text-[10px] text-[#474948]">
              {classification.confidence === "medium" ? "~" : "?"}
            </span>
          )}
        </div>

        {/* Chips row: Level · Region · Deadline */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          {level && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f9f2f0] px-2 py-0.5 text-[11px] font-medium text-[#464555] dark:bg-stone-800 dark:text-stone-300">
              <GraduationCap className="h-3 w-3" />
              {levelLabel(level, lang)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f9f2f0] px-2 py-0.5 text-[11px] font-medium text-[#464555] dark:bg-stone-800 dark:text-stone-300">
            {region === "haiti" ? (
              <MapPin className="h-3 w-3" />
            ) : (
              <Globe className="h-3 w-3" />
            )}
            {regionLabel(region, lang)}
          </span>
          {(() => {
            const dlSt = getDeadlineStatus(
              article.deadline ?? deadline.iso,
              lang,
            );
            return (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${badgeStyle(dlSt.badgeVariant)}`}
              >
                <CalendarClock className="h-3 w-3" />
                {dlSt.badgeLabel}
              </span>
            );
          })()}
          {!isExpired && !deadline.missing && deadline.iso && (
            <span className="text-[10px] text-[#474948] dark:text-stone-500">
              {getDeadlineStatus(article.deadline ?? deadline.iso, lang).humanLine}
            </span>
          )}
        </div>

        {/* Title */}
        <h2 className="mb-1 text-[15px] font-bold font-display leading-snug text-[#1d1b1a] group-hover:text-[#3525cd] dark:text-stone-100 dark:group-hover:text-[#c3c0ff] sm:text-base">
          {article.title}
        </h2>

        {/* Summary */}
        <p className="mb-2 line-clamp-2 text-sm text-[#474948] dark:text-stone-400">
          {article.summary || article.body?.slice(0, 150) || ""}
        </p>

        {/* Footer */}
        <div className="mt-auto border-t border-[#f3ecea] border-dashed pt-3 flex flex-wrap items-center gap-1.5 text-xs text-[#474948] dark:text-stone-500">
          {article.sourceName && <span>{article.sourceName}</span>}
          {article.sourceName && article.publishedAt && <span>·</span>}
          {article.publishedAt && (
            <span>{formatDate(article.publishedAt, lang)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
