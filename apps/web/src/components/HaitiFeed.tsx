"use client";

import { useState } from "react";
import type { ContentLanguage } from "@edlight-news/types";
import type { FeedItem } from "@/components/news-feed";
import { ArticleCard } from "@/components/ArticleCard";
import { isStudentFocused } from "@/lib/itemGeo";

type SortMode = "relevance" | "latest";
type GeoFilter = "all" | "students";

export interface HaitiFeedProps {
  articles: FeedItem[];
  lang: ContentLanguage;
}

export function HaitiFeed({ articles, lang }: HaitiFeedProps) {
  const [sort, setSort] = useState<SortMode>("latest");
  const [filter, setFilter] = useState<GeoFilter>("all");

  const fr = lang === "fr";

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

  if (sorted.length === 0) {
    return (
      <div className="section-shell border-2 border-dashed py-20 text-center text-gray-400 dark:text-slate-500">
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
      <div className="section-shell p-4">
        <div className="relative z-10 flex flex-wrap items-center gap-4">
        {/* Geo toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: "all" as const, fr: "Tout Haïti", ht: "Tout Ayiti" },
              {
                key: "students" as const,
                fr: "Haïti — Étudiants",
                ht: "Ayiti — Etidyan",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={[
                "rounded-full px-3 py-1 text-sm font-medium transition",
                filter === opt.key
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600",
              ].join(" ")}
            >
              {fr ? opt.fr : opt.ht}
            </button>
          ))}
        </div>

        {/* Sort toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-slate-400">
            {fr ? "Trier par :" : "Triye pa :"}
          </span>
          {(["relevance", "latest"] as SortMode[]).map((opt) => (
            <button
              key={opt}
              onClick={() => setSort(opt)}
              className={[
                "rounded-full px-3 py-1 text-sm font-medium transition",
                sort === opt
                  ? "bg-brand-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600",
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
        </div>
        <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">
          {sorted.length} {fr ? "article(s)" : "atik"}
        </span>
      </div>
      </div>

      {/* Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((article) => (
          <ArticleCard key={article.id} article={article} lang={lang} />
        ))}
      </div>
    </div>
  );
}
