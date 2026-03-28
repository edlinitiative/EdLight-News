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
      <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900 sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
              {lang === "fr" ? "Sélection EdLight" : "Seleksyon EdLight"}
            </p>
            <p className="text-sm text-stone-600 dark:text-stone-300">
              {sorted.length} {lang === "fr" ? "articles disponibles dans cette rubrique." : "atik disponib nan ribrik sa a."}
            </p>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-stone-400 dark:text-stone-500">
              {lang === "fr" ? "Trier par" : "Triye pa"}
            </span>
            {(["relevance", "latest"] as SortMode[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setSort(opt)}
                className={[
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  sort === opt
                    ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                    : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700",
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
          </div>
        </div>
      </div>

      {/* Grid — first item is featured (full width) */}
      <StaggerGrid className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((article, i) => (
          <StaggerItem
            key={article.id}
            className={i === 0 ? "sm:col-span-2 lg:col-span-3" : undefined}
          >
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
