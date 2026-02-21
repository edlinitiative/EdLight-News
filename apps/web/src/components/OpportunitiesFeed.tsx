"use client";

import { useState, useMemo } from "react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ArticleCard } from "@/components/ArticleCard";

// ── Subcategory definitions ──────────────────────────────────────────────────

type SubCat = "all" | "bourses" | "concours" | "stages" | "programmes";

const SUBCAT_LABELS: Record<SubCat, { fr: string; ht: string }> = {
  all:        { fr: "Tout",       ht: "Tout"    },
  bourses:    { fr: "Bourses",    ht: "Bous"    },
  concours:   { fr: "Concours",   ht: "Konkou"  },
  stages:     { fr: "Stages",     ht: "Estaj"   },
  programmes: { fr: "Programmes", ht: "Pwogram" },
};

const SUBCAT_KEYWORDS: Record<Exclude<SubCat, "all">, string[]> = {
  bourses:    ["bourse", "scholarship", "grant", "aide financière", "aide financiere"],
  concours:   ["concours", "compétition", "competition", "prix", "award", "challenge"],
  stages:     ["stage", "internship", "intern", "stagiaire"],
  programmes: ["programme", "program", "fellowship", "résidence", "residence", "mentorat"],
};

function matchesSubCat(article: FeedItem, sub: SubCat): boolean {
  if (sub === "all") return true;
  // Direct category match for scholarships
  if (sub === "bourses" && article.category === "scholarship") return true;
  const text = `${article.title} ${article.summary}`.toLowerCase();
  return SUBCAT_KEYWORDS[sub].some((k) => text.includes(k));
}

// ── Sort modes ───────────────────────────────────────────────────────────────

type SortMode = "deadline" | "relevance" | "latest";

const SORT_LABELS: Record<SortMode, { fr: string; ht: string }> = {
  deadline:   { fr: "Deadline proche", ht: "Dat limit"  },
  relevance:  { fr: "Pertinence",      ht: "Pètinans"   },
  latest:     { fr: "Dernières",       ht: "Dènye"      },
};

// ── Component ────────────────────────────────────────────────────────────────

export interface OpportunitiesFeedProps {
  articles: FeedItem[];
  lang: ContentLanguage;
}

export function OpportunitiesFeed({ articles, lang }: OpportunitiesFeedProps) {
  const [subCat, setSubCat] = useState<SubCat>("all");
  const [sort, setSort] = useState<SortMode>("deadline");
  const [includeNoDeadline, setIncludeNoDeadline] = useState(false);

  const filtered = useMemo(() => {
    let result = articles.filter((a) => matchesSubCat(a, subCat));
    // When sorting by deadline, hide items without one unless toggle enabled
    if (sort === "deadline" && !includeNoDeadline) {
      result = result.filter((a) => Boolean(a.deadline));
    }
    return result;
  }, [articles, subCat, sort, includeNoDeadline]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === "deadline") {
        const hasA = Boolean(a.deadline);
        const hasB = Boolean(b.deadline);
        if (hasA && !hasB) return -1;
        if (!hasA && hasB) return 1;
        if (hasA && hasB) {
          return (
            new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
          );
        }
      }
      if (sort === "relevance") {
        const diff = (b.audienceFitScore ?? 0) - (a.audienceFitScore ?? 0);
        if (diff !== 0) return diff;
      }
      const tA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const tB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return tB - tA;
    });
  }, [filtered, sort]);

  return (
    <div className="space-y-6">
      {/* Subcategory pills */}
      <div className="flex flex-wrap gap-2">
        {(
          ["all", "bourses", "concours", "stages", "programmes"] as SubCat[]
        ).map((s) => (
          <button
            key={s}
            onClick={() => setSubCat(s)}
            className={[
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
              subCat === s
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            ].join(" ")}
          >
            {SUBCAT_LABELS[s][lang]}
          </button>
        ))}
      </div>

      {/* Sort controls row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">
            {lang === "fr" ? "Trier :" : "Triye :"}
          </span>
          {(["deadline", "relevance", "latest"] as SortMode[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={[
                "rounded-full px-3 py-1 text-sm font-medium transition",
                sort === s
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              ].join(" ")}
            >
              {SORT_LABELS[s][lang]}
            </button>
          ))}
        </div>

        {sort === "deadline" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500">
            <input
              type="checkbox"
              checked={includeNoDeadline}
              onChange={(e) => setIncludeNoDeadline(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            {lang === "fr" ? "Inclure sans deadline" : "Enkli san dat limit"}
          </label>
        )}
      </div>

      {/* Results */}
      {sorted.length === 0 ? (
        <p className="py-20 text-center text-gray-400">
          {lang === "fr"
            ? "Aucune opportunité trouvée."
            : "Pa gen okazyon jwenn."}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              lang={lang}
              showDeadline
            />
          ))}
        </div>
      )}
    </div>
  );
}
