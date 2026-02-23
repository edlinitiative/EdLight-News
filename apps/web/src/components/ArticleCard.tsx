/**
 * ArticleCard — shared display component for all section grids.
 *
 * Works in both server and client component contexts because it
 * uses no React hooks. Dates are formatted statically (not relative).
 */

import type { ContentLanguage } from "@edlight-news/types";
import { ClipboardList } from "lucide-react";
import type { FeedItem } from "@/components/news-feed";
import {
  categoryLabel,
  CATEGORY_COLORS,
  formatDate,
} from "@/lib/utils";
import { classifyOpportunity } from "@/lib/opportunityClassifier";
import { SUBCAT_COLORS, SUBCAT_LABELS, type OpportunitySubCat } from "@/lib/opportunities";

/** Opportunity category values that might use the derived classifier. */
const OPP_CATEGORIES = new Set([
  "scholarship", "opportunity", "bourses", "concours", "stages", "programmes",
]);

const SUBCAT_MAP: Record<string, OpportunitySubCat> = {
  Bourses: "bourses", Programmes: "programmes", Stages: "stages",
  Concours: "concours", Ressources: "ressources", Autre: "autre",
};

/**
 * Quick smell test: does the title/summary actually contain opportunity
 * keywords? Prevents mis-classified general news (e.g. crime articles with
 * category "concours") from being treated as opportunities.
 */
const OPP_SMELL_KW = [
  "bourse", "scholarship", "fellowship", "grant",
  "concours", "competition", "hackathon", "prix", "award",
  "stage", "internship", "apprentissage",
  "programme", "formation", "inscription", "admission", "candidature",
  "master", "licence", "doctorat", "diplome",
  "financement", "aide", "subvention", "allocation",
  "postuler", "apply", "deadline", "date limite", "cloture",
  "etudiant", "student", "universitaire", "university",
  "emploi", "job", "recrutement",
  "opportunit", "okazyon", "bous", "estaj", "konkou",
];

function looksLikeOpportunity(article: FeedItem): boolean {
  if (article.vertical === "opportunites") return true;
  if (article.itemType === "utility") return true;
  const blob = `${article.title ?? ""} ${article.summary ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return OPP_SMELL_KW.some((kw) => blob.includes(kw));
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
  return {
    label: categoryLabel(article.category, lang),
    color: CATEGORY_COLORS[article.category] ?? "bg-gray-100 text-gray-600",
  };
}

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

export interface ArticleCardProps {
  article: FeedItem;
  lang: ContentLanguage;
  /** Show the deadline badge (used on opportunities cards). */
  showDeadline?: boolean;
  /** Compact layout: no summary text, smaller heading. */
  compact?: boolean;
}

export function ArticleCard({
  article,
  lang,
  showDeadline = false,
  compact = false,
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

  return (
    <a
      href={`/news/${article.id}?lang=${lang}`}
      className="group flex flex-col rounded-lg border bg-white transition hover:border-brand-300 hover:shadow-md overflow-hidden"
    >
      {/* Image / gradient thumbnail — compact uses smaller aspect ratio */}
      <div className={[
        "relative w-full overflow-hidden bg-gray-100",
        compact ? "aspect-[2/1]" : "aspect-video",
      ].join(" ")}>
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
              {catInfo?.label ?? ""}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
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
          <p className="mb-1.5 text-xs font-semibold text-orange-600">
            {lang === "fr" ? "Limite :" : "Dat limit :"}{" "}
            {formatDate(article.deadline, lang)}
          </p>
        )}
        {showDeadline && !article.deadline && article.missingDeadline && (
          <p className="mb-1.5 text-xs font-semibold text-amber-500">
            {lang === "fr" ? "Deadline à confirmer" : "Dat limit pou konfime"}
          </p>
        )}

        {/* Title */}
        <h2
          className={[
            "font-semibold leading-snug group-hover:text-brand-700",
            compact ? "mb-1 text-sm" : "mb-2 text-base",
          ].join(" ")}
        >
          {article.title}
        </h2>

        {/* Summary */}
        {!compact && (
          <p className="mb-3 line-clamp-2 flex-1 text-sm text-gray-500">
            {article.summary || article.body?.slice(0, 150) || ""}
          </p>
        )}

        {/* Footer: source · date (or source count for synthesis) */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
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
    </a>
  );
}
