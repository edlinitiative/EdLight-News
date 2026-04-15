import Link from "next/link";
import { Clock } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { BookmarkButton } from "@/components/BookmarkButton";
import { ImageWithFallback } from "@/components/ImageWithFallback";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import {
  formatRelativeDate,
  categoryLabel,
  CATEGORY_COLORS,
} from "@/lib/utils";
import {
  classifyOpportunity,
  contentLooksLikeOpportunity,
} from "@/lib/opportunityClassifier";
import {
  SUBCAT_COLORS,
  SUBCAT_LABELS,
  type OpportunitySubCat,
} from "@/lib/opportunities";

interface ArticleCardProps {
  article: FeedItem;
  lang: ContentLanguage;
  compact?: boolean;
  variant?: "default" | "featured" | "compact";
}

const OPPORTUNITY_CATEGORIES = new Set([
  "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
]);

function deriveCategory(article: FeedItem, lang: ContentLanguage) {
  const passesSmellTest =
    contentLooksLikeOpportunity(article.title ?? "", article.summary);

  const isOpp =
    (article.vertical === "opportunites" ||
      OPPORTUNITY_CATEGORIES.has(article.category ?? "")) &&
    passesSmellTest;

  if (isOpp) {
    const result = classifyOpportunity({
      title: article.title ?? "",
      summary: article.summary,
      body: article.body,
      category: article.category,
      publisher: article.sourceName,
      url: article.sourceUrl,
    });
    const map: Record<string, OpportunitySubCat> = {
      Bourses: "bourses", Programmes: "programmes", Stages: "stages",
      Concours: "concours", Ressources: "ressources", Autre: "autre",
    };
    const sub = map[result.subcategory] ?? null;
    if (sub) {
      return {
        color: SUBCAT_COLORS[sub],
        label: SUBCAT_LABELS[sub][lang],
      };
    }
  }

  // Utility daily-fact items stored as "resource" are actually news, not resources.
  // Also remap opp-adjacent categories that failed the smell test to avoid
  // misleading "Concours"/"Stages"/"Programmes" labels on general news articles.
  const cat = article.category ?? "";
  const isUtilityDailyFact = cat === "resource" && article.itemType === "utility" && article.utilityType === "daily_fact";
  const displayCat = isUtilityDailyFact
    ? (article.geoTag === "HT" ? "local_news" : "news")
    : OPPORTUNITY_CATEGORIES.has(cat)
      ? (article.geoTag === "HT" || article.vertical === "haiti" ? "local_news" : "news")
      : cat;
  return {
    color: CATEGORY_COLORS[displayCat] ?? "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300",
    label: categoryLabel(displayCat, lang),
  };
}

/** Estimate reading time in minutes from body text length */
function estimateReadTime(body?: string): number {
  if (!body) return 1;
  const words = body.split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}

export function ArticleCard({
  article,
  lang,
  compact = false,
  variant = "default",
}: ArticleCardProps) {
  const isCompact = compact || variant === "compact";
  const isFeatured = variant === "featured";
  const derived = deriveCategory(article, lang);
  const hasImage = !!article.imageUrl;
  // Hide branded cards for utility items — they're just gradient+title, no
  // real imagery, and they make short-form "snackable" content look oversized.
  const showImage = hasImage && !(
    article.itemType === "utility" && article.imageSource === "branded"
  );
  const readTime = estimateReadTime(article.body);
  const fr = lang === "fr";

  return (
    <Link
      href={`/news/${article.id}?lang=${lang}`}
      className={[
        "group flex overflow-hidden transition-all duration-300",
        isFeatured
          ? "flex-col rounded-2xl border border-stone-200/80 bg-white shadow-sm hover:-translate-y-1 hover:shadow-lg dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700 sm:flex-row"
          : isCompact
            ? "items-start gap-4 rounded-xl border border-stone-100/80 bg-white/80 px-4 py-3.5 hover:-translate-y-px hover:border-stone-200 hover:bg-white hover:shadow-sm dark:border-stone-800 dark:bg-stone-900/80 dark:hover:border-stone-700 dark:hover:bg-stone-800"
            : "flex-col rounded-2xl border border-stone-200/80 bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700",
      ].join(" ")}
    >
      {/* Image */}
      {showImage && !isCompact && (
        <div
          className={[
            "relative shrink-0 overflow-hidden bg-stone-100 dark:bg-stone-800",
            isFeatured
              ? "aspect-video sm:aspect-auto sm:w-80"
              : "aspect-[16/10]",
          ].join(" ")}
        >
          <ImageWithFallback
            src={article.imageUrl!}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
          {isFeatured && derived.label && (
            <div className="absolute bottom-3 left-3">
              <span className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                {derived.label}
              </span>
            </div>
          )}
          {article.imageSource === "wikidata" && (
            <span className="absolute bottom-2 right-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] text-white/60 backdrop-blur-sm">
              Wikimedia
            </span>
          )}
        </div>
      )}

      {/* Compact image thumbnail */}
      {showImage && isCompact && (
        <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
          <ImageWithFallback
            src={article.imageUrl!}
            alt={article.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        </div>
      )}

      {/* Content */}
      <div className={[
        "flex flex-1 flex-col",
        isFeatured ? "gap-2.5 p-6" : isCompact ? "min-w-0 gap-1.5" : "gap-2 p-5",
      ].join(" ")}>
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          {!isFeatured && derived.label && (
            <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ring-stone-200/50 dark:ring-stone-700/50 ${derived.color}`}>
              {derived.label}
            </span>
          )}
          {article.itemType === "synthesis" && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/30">
              {fr ? "Synthèse" : "Sentèz"}
              {article.sourceCount ? ` · ${article.sourceCount}` : ""}
            </span>
          )}
          {article.geoTag === "HT" && derived.label !== (fr ? "Haïti" : "Ayiti") && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-inset ring-red-200/50 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-800/30">
              {fr ? "Haïti" : "Ayiti"}
            </span>
          )}
          <DeadlineBadge item={article} lang={lang} />
        </div>

        {/* Title */}
        <h3
          className={[
            "font-semibold leading-snug tracking-tight text-stone-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400",
            isFeatured ? "text-xl sm:text-2xl" : isCompact ? "text-sm line-clamp-2" : "text-base line-clamp-2",
          ].join(" ")}
          style={isFeatured ? { fontFamily: "var(--font-serif, Georgia, serif)" } : undefined}
        >
          {article.title}
        </h3>

        {/* Summary */}
        {article.summary && !isCompact && (
          <p className={[
            "text-sm leading-relaxed text-stone-500 dark:text-stone-400",
            isFeatured ? "line-clamp-3" : "line-clamp-2",
          ].join(" ")}>
            {article.summary}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center gap-2 pt-1.5 text-[11px] text-stone-400 dark:text-stone-500">
          {article.sourceName && (
            <span className="font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              {article.sourceName}
            </span>
          )}
          {article.sourceName && article.publishedAt && (
            <span className="text-stone-300 dark:text-stone-600">·</span>
          )}
          {article.publishedAt && (
            <span>{formatRelativeDate(article.publishedAt, lang)}</span>
          )}
          <span className="text-stone-300 dark:text-stone-600">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {readTime} min
          </span>
          {!isCompact && (
            <span className="ml-auto">
              <BookmarkButton articleId={article.id} lang={lang} />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
