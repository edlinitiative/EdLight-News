"use client";

import { useState } from "react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ArticleCard } from "@/components/ArticleCard";
import { StaggerGrid, StaggerItem } from "@/components/StaggerGrid";

type SortMode = "relevance" | "latest";

export interface SectionFeedProps {
  articles: FeedItem[];
  lang: ContentLanguage;
  /** Which sort mode is shown by default. */
  defaultSort?: SortMode;
  /** Message shown when the filtered list is empty. */
  emptyMessage?: { fr: string; ht: string };
}

export function SectionFeed({
  articles,
  lang,
  defaultSort = "relevance",
  emptyMessage,
}: SectionFeedProps) {
  const [sort, setSort] = useState<SortMode>(defaultSort);

  const sorted = [...articles].sort((a, b) => {
    if (sort === "relevance") {
      const diff = (b.audienceFitScore ?? 0) - (a.audienceFitScore ?? 0);
      if (diff !== 0) return diff;
    }
    const tA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const tB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return tB - tA;
  });

  if (sorted.length === 0) {
    return (
      <div className="section-shell border-2 border-dashed py-20 text-center text-stone-400 dark:text-stone-500">
        <p className="relative z-10">
          {emptyMessage?.[lang] ??
            (lang === "fr"
              ? "Aucun article disponible pour le moment."
              : "Pa gen atik disponib kounye a.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sort toggle */}
      <div className="section-shell p-4">
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <span className="text-sm text-stone-500 dark:text-stone-400">
            {lang === "fr" ? "Trier par :" : "Triye pa :"}
          </span>
          {(["relevance", "latest"] as SortMode[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setSort(opt)}
              className={[
                "rounded-full px-3 py-1 text-sm font-medium transition",
                sort === opt
                  ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-700 dark:text-stone-300 dark:hover:bg-stone-600",
              ].join(" ")}
            >
              {opt === "relevance"
                ? lang === "fr"
                  ? "Pertinence"
                  : "Pètinans"
                : lang === "fr"
                  ? "Dernières"
                  : "Dènye"}
            </button>
          ))}
          <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">
            {sorted.length} {lang === "fr" ? "articles" : "atik"}
          </span>
        </div>
      </div>

      {/* Grid — first item is featured (full width) */}
      <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((article, i) => (
          <StaggerItem key={article.id}>
            <ArticleCard
              article={article}
              lang={lang}
              variant={i === 0 ? "featured" : "default"}
            />
          </StaggerItem>
        ))}
      </StaggerGrid>
    </div>
  );
}
