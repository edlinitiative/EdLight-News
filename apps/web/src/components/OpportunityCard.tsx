/**
 * OpportunityCard — Compact, polished opportunity article card.
 *
 * Features:
 * - Minimal image-first design with gradient fallbacks
 * - Compact metadata row (type · deadline)
 * - Clean typography hierarchy
 * - Minimal footer (source + date)
 */

"use client";

import type { ContentLanguage } from "@edlight-news/types";
import { Globe, MapPin, CalendarClock } from "lucide-react";
import Link from "next/link";
import type { FeedItem } from "@/components/news-feed";
import { getDeadlineStatus, badgeStyle } from "@/lib/ui/deadlines";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import {
  formatDate,
} from "@/lib/utils";
import {
  inferRegion,
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

  // ── Derived chips ────────────────────────────────────────────────────────
  const region = inferRegion(article);
  const deadline = parseDeadline(article, lang);

  // Use derived subcategory (from classifier) for badge label
  const subCat = derivedSubcategory ?? "programmes";
  const subCatColor = SUBCAT_COLORS[subCat];
  const subCatLabel = SUBCAT_LABELS[subCat][lang];

  return (
    <Link
      href={`/news/${article.id}?lang=${lang}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-[#c7c4d8]/15 bg-white shadow-sm hover:shadow-md hover:border-[#c7c4d8]/30 transition-all dark:bg-stone-900 dark:border-stone-700/60 dark:hover:border-stone-700"
    >
      {/* Image / gradient thumbnail — 3:2 aspect ratio */}
      <div className="relative aspect-video w-full overflow-hidden bg-[#f9f2f0]">
        {hasImage ? (
          <ImageWithFallback
            src={article.imageUrl!}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            fallback={
              <div
                className={`h-full w-full bg-gradient-to-br ${fallbackGradient}`}
              />
            }
          />
        ) : (
          <div
            className={`h-full w-full bg-gradient-to-br ${fallbackGradient}`}
          />
        )}
      </div>

      {/* Content area — compact padding */}
      <div className="flex flex-1 flex-col p-4">
        {/* Type badge */}
        <span className="mb-2 inline-flex w-fit rounded-md bg-[#e8e1df] px-2.5 py-1 text-xs font-semibold text-[#464555] dark:bg-stone-800 dark:text-stone-300">
          {subCatLabel}
        </span>

        {/* Metadata row: Region · Deadline */}
        <div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 text-[#474948] dark:text-stone-400">
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
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold ${badgeStyle(dlSt.badgeVariant)}`}
              >
                <CalendarClock className="h-3 w-3" />
                {dlSt.badgeLabel}
              </span>
            );
          })()}
        </div>

        {/* Title — limited to 2 lines */}
        <h2 className="mb-1.5 line-clamp-2 text-sm font-bold font-display leading-snug text-[#1d1b1a] group-hover:text-[#3525cd] dark:text-stone-100 dark:group-hover:text-[#c3c0ff] transition-colors">
          {article.title}
        </h2>

        {/* Summary — limited to 2 lines */}
        <p className="mb-3 line-clamp-2 text-xs text-[#474948] dark:text-stone-400">
          {article.summary || article.body?.slice(0, 120) || ""}
        </p>

        {/* Footer — minimal */}
        <div className="mt-auto border-t border-[#f3ecea]/60 pt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[#474948] dark:border-stone-800 dark:text-stone-500">
          {article.sourceName && (
            <span className="font-medium">{article.sourceName}</span>
          )}
          {article.sourceName && article.publishedAt && <span>·</span>}
          {article.publishedAt && (
            <span>{formatDate(article.publishedAt, lang)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
