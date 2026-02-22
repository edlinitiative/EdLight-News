"use client";

import { useState, useMemo } from "react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { OpportunityCard } from "@/components/OpportunityCard";
import {
  deriveSubcategory,
  parseDeadline,
  SUBCAT_LABELS,
  type OpportunitySubCat,
} from "@/lib/opportunities";

// ── Types ────────────────────────────────────────────────────────────────────

type SubCatFilter = "all" | OpportunitySubCat;

type SortMode = "deadline" | "relevance" | "latest";

const SORT_LABELS: Record<SortMode, { fr: string; ht: string }> = {
  deadline:  { fr: "Deadline proche", ht: "Dat limit" },
  relevance: { fr: "Pertinence",     ht: "Pètinans"  },
  latest:    { fr: "Dernières",      ht: "Dènye"     },
};

// ── Component ────────────────────────────────────────────────────────────────

export interface OpportunitiesFeedProps {
  articles: FeedItem[];
  lang: ContentLanguage;
}

export function OpportunitiesFeed({ articles, lang }: OpportunitiesFeedProps) {
  const [subCat, setSubCat] = useState<SubCatFilter>("all");
  const [sort, setSort] = useState<SortMode>("relevance");
  const [includeNoDeadline, setIncludeNoDeadline] = useState(false);

  // Pre-compute derived subcategory + deadline per article (once)
  const enriched = useMemo(
    () =>
      articles.map((a) => ({
        article: a,
        subCat: deriveSubcategory(a),
        deadline: parseDeadline(a, lang),
      })),
    [articles, lang],
  );

  // Filter by selected subcategory pill
  const filtered = useMemo(() => {
    let result =
      subCat === "all"
        ? enriched
        : enriched.filter((e) => e.subCat === subCat);

    // When sorting by deadline, hide items with missing deadlines unless toggled
    if (sort === "deadline" && !includeNoDeadline) {
      result = result.filter((e) => !e.deadline.missing);
    }

    return result;
  }, [enriched, subCat, sort, includeNoDeadline]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sort === "deadline") {
        // Items with deadlines come first
        if (!a.deadline.missing && b.deadline.missing) return -1;
        if (a.deadline.missing && !b.deadline.missing) return 1;
        if (a.deadline.iso && b.deadline.iso) {
          return (
            new Date(a.deadline.iso).getTime() -
            new Date(b.deadline.iso).getTime()
          );
        }
      }
      if (sort === "relevance") {
        const diff =
          (b.article.audienceFitScore ?? 0) -
          (a.article.audienceFitScore ?? 0);
        if (diff !== 0) return diff;
      }
      const tA = a.article.publishedAt
        ? new Date(a.article.publishedAt).getTime()
        : 0;
      const tB = b.article.publishedAt
        ? new Date(b.article.publishedAt).getTime()
        : 0;
      return tB - tA;
    });
  }, [filtered, sort]);

  return (
    <div className="space-y-6">
      {/* Subcategory pills */}
      <div className="flex flex-wrap gap-2">
        {(
          ["all", "bourses", "concours", "stages", "programmes"] as SubCatFilter[]
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
          {sorted.map((entry) => (
            <OpportunityCard
              key={entry.article.id}
              article={entry.article}
              lang={lang}
            />
          ))}
        </div>
      )}
    </div>
  );
}
