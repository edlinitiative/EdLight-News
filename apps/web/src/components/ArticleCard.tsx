import Link from "next/link";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
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
    article.itemType === "utility" ||
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

  const cat = article.category ?? "";
  return {
    color: CATEGORY_COLORS[cat] ?? "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300",
    label: categoryLabel(cat, lang),
  };
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

  return (
    <Link
      href={`/news/${article.id}?lang=${lang}`}
      className={[
        "group flex overflow-hidden card",
        isFeatured ? "flex-col sm:flex-row sm:col-span-full" : "flex-col",
      ].join(" ")}
    >
      {/* Image */}
      {hasImage && (
        <div
          className={[
            "relative shrink-0 overflow-hidden bg-stone-100 dark:bg-stone-800",
            isFeatured
              ? "aspect-video sm:aspect-auto sm:w-80"
              : isCompact
                ? "aspect-[2/1]"
                : "aspect-video",
          ].join(" ")}
        >
          <ImageWithFallback
            src={article.imageUrl!}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {article.imageSource === "wikidata" && (
            <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] text-white/70 backdrop-blur-sm">
              Wikimedia
            </span>
          )}
        </div>
      )}

      {/* Content */}
      <div className={["flex flex-1 flex-col gap-2", isFeatured ? "p-5" : isCompact ? "p-3.5" : "p-4"].join(" ")}>
        {/* Top row: category + deadline */}
        <div className="flex flex-wrap items-center gap-2">
          {derived.label && (
            <span className={`badge ${derived.color}`}>{derived.label}</span>
          )}
          {article.itemType === "synthesis" && (
            <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {lang === "fr" ? "Synthèse" : "Sentèz"}
              {article.sourceCount ? ` · ${article.sourceCount}` : ""}
            </span>
          )}
          {article.geoTag === "HT" && (
            <span className="badge bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
              {lang === "fr" ? "Haïti" : "Ayiti"}
            </span>
          )}
          <DeadlineBadge item={article} lang={lang} />
        </div>

        {/* Title */}
        <h3
          className={[
            "font-serif font-bold leading-snug tracking-tight text-stone-900 transition-colors group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400",
            isFeatured ? "text-xl sm:text-2xl" : isCompact ? "text-sm line-clamp-2" : "text-base line-clamp-2",
          ].join(" ")}
        >
          {article.title}
        </h3>

        {/* Summary */}
        {!isCompact && article.summary && (
          <p className={[
            "text-sm leading-relaxed text-stone-500 dark:text-stone-400",
            isFeatured ? "line-clamp-3" : "line-clamp-2",
          ].join(" ")}>
            {article.summary}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-stone-400 dark:text-stone-500">
          {article.sourceName && (
            <span className="truncate">{article.sourceName}</span>
          )}
          {article.sourceName && article.publishedAt && (
            <span className="text-stone-300 dark:text-stone-600">·</span>
          )}
          {article.publishedAt && (
            <span>{formatRelativeDate(article.publishedAt, lang)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
