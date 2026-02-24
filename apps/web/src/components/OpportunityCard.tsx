/**
 * OpportunityCard — extends ArticleCard with opportunity-specific chips.
 *
 * Renders Level, Region, Deadline, and derived subcategory chips.
 * Shows expired badge with reduced opacity when deadline has passed.
 */

"use client";

import type { ContentLanguage } from "@edlight-news/types";
import { GraduationCap, Globe, MapPin, CalendarClock, AlertCircle } from "lucide-react";
import type { FeedItem } from "@/components/news-feed";
import { DeadlineBadge } from "@/components/DeadlineBadge";
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
  scholarship: "from-brand-800 to-purple-700",
  opportunity: "from-purple-700 to-pink-600",
  news:        "from-teal-700 to-brand-800",
  event:       "from-orange-700 to-red-700",
  resource:    "from-green-700 to-cyan-700",
  local_news:  "from-red-700 to-brand-800",
};
const DEFAULT_FALLBACK_GRADIENT = "from-slate-700 to-slate-900";

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
    <a
      href={`/news/${article.id}?lang=${lang}`}
      className={[
        "group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md",
        isExpired ? "opacity-80" : "",
      ].join(" ")}
    >
      {/* Image / gradient thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
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
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-red-600/90 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            <AlertCircle className="h-3 w-3" />
            {lang === "fr" ? "Expiré" : "Ekspire"}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* Category badge — uses derived subcategory */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${subCatColor}`}
          >
            {subCatLabel}
          </span>
          {classification && classification.confidence !== "high" && (
            <span className="rounded-full bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400">
              {classification.confidence === "medium" ? "~" : "?"}
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
              isExpired
                ? "bg-red-50 text-red-600"
                : deadline.missing
                  ? "bg-amber-50 text-amber-600"
                  : "bg-orange-50 text-orange-600"
            }`}
          >
            <CalendarClock className="h-3 w-3" />
            {isExpired
              ? (lang === "fr" ? "Expiré" : "Ekspire")
              : deadline.missing
                ? (lang === "fr" ? "Deadline à confirmer" : "Dat limit pou konfime")
                : `${lang === "fr" ? "Clôture" : "Fèmti"}: ${deadline.label}`}
          </span>
          {!isExpired && !deadline.missing && deadline.iso && (
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
