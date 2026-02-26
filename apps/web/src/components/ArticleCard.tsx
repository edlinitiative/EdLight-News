/**
 * ArticleCard — shared display component for all section grids.
 *
 * Works in both server and client component contexts because it
 * uses no React hooks. Dates are formatted statically (not relative).
 */

import type { ContentLanguage } from "@edlight-news/types";
import { ClipboardList } from "lucide-react";
import Link from "next/link";
import type { FeedItem } from "@/components/news-feed";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import {
  categoryLabel,
  CATEGORY_COLORS,
  formatDate,
} from "@/lib/utils";
import { classifyOpportunity, contentLooksLikeOpportunity } from "@/lib/opportunityClassifier";
import { SUBCAT_COLORS, SUBCAT_LABELS, type OpportunitySubCat } from "@/lib/opportunities";

/** Opportunity category values that might use the derived classifier. */
const OPP_CATEGORIES = new Set([
  "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
]);

const SUBCAT_MAP: Record<string, OpportunitySubCat> = {
  Bourses: "bourses", Programmes: "programmes", Stages: "stages",
  Concours: "concours", Ressources: "ressources", Autre: "autre",
};

function looksLikeOpportunity(article: FeedItem): boolean {
  if (article.itemType === "utility") return true;
  return contentLooksLikeOpportunity(article.title ?? "", article.summary);
}

/** Derive display category for an article. For opportunity items, uses the
 *  keyword classifier; for everything else, falls back to raw category. */
function derivedCategoryInfo(
  article: FeedItem,
  lang: ContentLanguage,
): { label: string; color: string } | null {
  const isOpp =
    (article.vertical === "opportunites" ||
     OPP_CATEGORIES.has(article.category ?? "")) &&
    looksLikeOpportunity(article);

  if (isOpp) {
    const result = classifyOpportunity({
      title: article.title ?? "",
      summary: article.summary,
      body: article.body,
      category: article.category,
      publisher: article.sourceName,
      url: article.sourceUrl,
    });
    const sc = SUBCAT_MAP[result.subcategory] ?? "autre";
    return {
      label: SUBCAT_LABELS[sc][lang],
      color: SUBCAT_COLORS[sc],
    };
  }

  if (!article.category) return null;
  // Category is opp-adjacent but content doesn't look like an opportunity
  // → remap to avoid misleading "Concours"/"Stages" labels on general news.
  const displayCat = OPP_CATEGORIES.has(article.category)
    ? (article.geoTag === "HT" || article.vertical === "haiti" ? "local_news" : "news")
    : article.category;
  return {
    label: categoryLabel(displayCat, lang),
    color: CATEGORY_COLORS[displayCat] ?? "bg-gray-100 text-gray-600",
  };
}

/** Category → fallback gradient CSS for cards without images */
const FALLBACK_GRADIENTS: Record<string, string> = {
  scholarship: "from-brand-800 to-purple-700",
  opportunity: "from-purple-700 to-brand-600",
  news:        "from-teal-700 to-brand-800",
  event:       "from-brand-700 to-indigo-700",
  resource:    "from-green-700 to-cyan-700",
  local_news:  "from-brand-700 to-brand-900",
};
const DEFAULT_FALLBACK_GRADIENT = "from-slate-700 to-slate-900";

export interface ArticleCardProps {
  article: FeedItem;
  lang: ContentLanguage;
  /** Show the deadline badge (used on opportunities cards). */
  showDeadline?: boolean;
  /** Compact layout: no summary text, smaller heading. */
  compact?: boolean;
  /** Visual variant for content hierarchy. */
  variant?: "default" | "featured" | "compact";
}

export function ArticleCard({
  article,
  lang,
  showDeadline = false,
  compact = false,
  variant = "default",
}: ArticleCardProps) {
  const catInfo = derivedCategoryInfo(article, lang);

  // dupeCount includes the canonical version itself, so updates = dupeCount - 1
  const updateCount = (article.dupeCount ?? 1) - 1;
  const hasUpdates = updateCount > 0;

  // Show images from publisher, wikidata, branded, and screenshot sources.
  // Only hide items with no imageUrl at all.
  const hasImage = !!article.imageUrl;
  const fallbackGradient =
    FALLBACK_GRADIENTS[article.category ?? ""] ?? DEFAULT_FALLBACK_GRADIENT;

  // Normalize compact prop into variant
  const v = compact ? "compact" : variant;
  const isFeatured = v === "featured";
  const isCompact = v === "compact";

  return (
    <Link
      href={`/news/${article.id}?lang=${lang}`}
      className={[
        "group flex overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-700/60 dark:bg-slate-900/70",
        isFeatured ? "sm:flex-row sm:col-span-full" : "flex-col",
      ].join(" ")}
    >
      {/* Image / gradient thumbnail */}
      <div className={[
        "relative shrink-0 overflow-hidden bg-gray-100",
        isFeatured ? "aspect-[3/2] sm:w-2/5" : isCompact ? "aspect-[2/1] w-full" : "aspect-video w-full",
      ].join(" ")}>
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
                  {catInfo?.label ?? ""}
                </span>
              </div>
            }
          />
        ) : (
          <div
            className={`h-full w-full bg-gradient-to-br ${fallbackGradient} flex items-end p-4`}
          >
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
              {catInfo?.label ?? ""}
            </span>
          </div>
        )}
      </div>

      <div className="relative flex flex-1 flex-col p-5">
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent dark:via-slate-700/60" />
        {/* Badges row */}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {catInfo && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${catInfo.color}`}
            >
              {catInfo.label}
            </span>
          )}
          {article.itemType === "synthesis" && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {lang === "fr" ? "Synthèse" : "Sentèz"} · {article.sourceCount ?? 0}{" "}
              {lang === "fr" ? "sources" : "sous"}
            </span>
          )}
          {article.itemType === "utility" && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
              <ClipboardList className="mr-1 inline-block h-3 w-3" />{lang === "fr" ? "Guide étudiant" : "Gid etidyan"}
            </span>
          )}
          {hasUpdates && article.itemType !== "synthesis" && (
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              +{updateCount}&nbsp;
              {lang === "fr" ? "mises à jour" : "mizajou"}
            </span>
          )}
        </div>

        {/* Deadline (opportunities only) */}
        {showDeadline && article.deadline && (
          <p className="mb-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
            {lang === "fr" ? "Limite :" : "Dat limit :"}{" "}
            {formatDate(article.deadline, lang)}
          </p>
        )}
        {showDeadline && !article.deadline && article.missingDeadline && (
          <p className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400">
            {lang === "fr" ? "Deadline à confirmer" : "Dat limit pou konfime"}
          </p>
        )}

        {/* Title */}
        <h2
          className={[
            "leading-snug transition-colors group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400",
            isFeatured
              ? "mb-2 font-serif text-lg font-bold sm:text-xl"
              : isCompact
                ? "mb-1 text-sm font-semibold"
                : "mb-2 text-base font-semibold",
          ].join(" ")}
        >
          {article.title}
        </h2>

        {/* Summary */}
        {!isCompact && (
          <p className={[
            "mb-3 line-clamp-2 flex-1 text-sm text-gray-500 dark:text-slate-400",
            isFeatured ? "sm:line-clamp-3" : "",
          ].join(" ")}>
            {article.summary || article.body?.slice(0, 150) || ""}
          </p>
        )}

        {/* Footer: source · date (or source count for synthesis) */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
          {article.itemType === "synthesis" && article.sourceCount ? (
            <span>{article.sourceCount} {lang === "fr" ? "sources" : "sous"}</span>
          ) : article.sourceName ? (
            <span>{article.sourceName}</span>
          ) : null}
          {(article.sourceName || (article.itemType === "synthesis" && article.sourceCount)) && article.publishedAt && <span>·</span>}
          {article.publishedAt && (
            <span>{formatDate(article.publishedAt, lang)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
