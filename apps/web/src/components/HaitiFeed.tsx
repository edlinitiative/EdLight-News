"use client";

import { useState, useCallback } from "react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ArticleCard } from "@/components/ArticleCard";
import { isStudentFocused } from "@/lib/itemGeo";
import { StaggerGrid, StaggerItem } from "@/components/StaggerGrid";
import { ChevronDown } from "lucide-react";

type SortMode = "relevance" | "latest";
type GeoFilter = "all" | "students";

/** How many articles to show per batch */
const PAGE_SIZE = 18;

export interface HaitiFeedProps {
  articles: FeedItem[];
  lang: ContentLanguage;
}

export function HaitiFeed({ articles, lang }: HaitiFeedProps) {
  const [sort, setSort] = useState<SortMode>("latest");
  const [filter, setFilter] = useState<GeoFilter>("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fr = lang === "fr";

  // Reset visible count when filters change
  const handleFilterChange = useCallback((f: GeoFilter) => {
    setFilter(f);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const handleSortChange = useCallback((s: SortMode) => {
    setSort(s);
    setVisibleCount(PAGE_SIZE);
  }, []);

  // Secondary student filter
  const filtered =
    filter === "students"
      ? articles.filter((a) => isStudentFocused(a))
      : articles;

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "relevance") {
      const diff = (b.audienceFitScore ?? 0) - (a.audienceFitScore ?? 0);
      if (diff !== 0) return diff;
    }
    const tA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tB - tA;
  });

  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  if (sorted.length === 0) {
    return (
      <div className="section-shell border-2 border-dashed py-20 text-center text-stone-400 dark:text-stone-500">
        <p className="relative z-10">
          {fr
            ? "Pas d\u2019articles locaux récents. Consultez le Fil."
            : "Pa gen atik lokal resan. Gade Fil la."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Geo toggle */}
        {(
          [
            { key: "all" as const, fr: "Tout Haïti", ht: "Tout Ayiti" },
            {
              key: "students" as const,
              fr: "Étudiants",
              ht: "Etidyan",
            },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            onClick={() => handleFilterChange(opt.key)}
            className={[
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              filter === opt.key
                ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700",
            ].join(" ")}
          >
            {fr ? opt.fr : opt.ht}
          </button>
        ))}

        <span className="mx-1 text-stone-300 dark:text-stone-600">|</span>

        {/* Sort toggle */}
        {(["relevance", "latest"] as SortMode[]).map((opt) => (
          <button
            key={opt}
            onClick={() => handleSortChange(opt)}
            className={[
              "rounded-md px-2.5 py-1 text-xs font-medium transition",
              sort === opt
                ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700",
            ].join(" ")}
          >
            {opt === "relevance"
              ? fr
                ? "Pertinence"
                : "Pètinans"
              : fr
                ? "Dernières"
                : "Dènye"}
          </button>
        ))}
        <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">
          {sorted.length} {fr ? "article(s)" : "atik"}
        </span>
      </div>

      {/* Featured article */}
      {visible.length > 0 && (
        <StaggerGrid className="grid">
          <StaggerItem>
            <ArticleCard
              article={visible[0]}
              lang={lang}
              variant="featured"
            />
          </StaggerItem>
        </StaggerGrid>
      )}

      {/* Remaining articles in grid */}
      {visible.length > 1 && (
        <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.slice(1).map((article) => (
            <StaggerItem key={article.id}>
              <ArticleCard
                article={article}
                lang={lang}
                variant="default"
              />
            </StaggerItem>
          ))}
        </StaggerGrid>
      )}

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="group flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-6 py-3 text-sm font-medium text-stone-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-stone-600"
          >
            {fr ? "Voir plus d\u2019articles" : "Wè plis atik"}
            <ChevronDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
            <span className="text-xs text-stone-400 dark:text-stone-500">
              ({sorted.length - visibleCount} {fr ? "restants" : "ki rete"})
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
