"use client";

/**
 * BoursesFeed — Mobile-first premium scholarship feed grid.
 *
 * Key improvements:
 *   - Single column on mobile, 2-col on desktop
 *   - Staggered fade-in animation on cards
 *   - "Load more" button with premium styling
 *   - Empty state with helpful illustration
 *   - Smooth card press feedback
 */

import type { ContentLanguage } from "@edlight-news/types";
import { useState, useMemo } from "react";
import { ScholarshipCard } from "./ScholarshipCard";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { Search, Sparkles } from "lucide-react";

interface BoursesFeedProps {
  scholarships: SerializedScholarship[];
  lang: ContentLanguage;
  saved: string[];
  onToggleSave: (id: string) => void;
  hasActiveFilters: boolean;
}

const PAGE_SIZE = 12;

export function BoursesFeed({
  scholarships,
  lang,
  saved,
  onToggleSave,
  hasActiveFilters,
}: BoursesFeedProps) {
  const fr = lang === "fr";
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const visible = useMemo(
    () => scholarships.slice(0, visibleCount),
    [scholarships, visibleCount]
  );

  const hasMore = visibleCount < scholarships.length;

  const loadMore = () => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, scholarships.length));
  };

  // ── Empty state ──
  if (scholarships.length === 0) {
    return (
      <div className="
        col-span-full
        flex flex-col items-center justify-center
        py-16 sm:py-20
        text-center
        bg-white dark:bg-stone-900/95
        rounded-2xl border border-[#f3ecea]/30 dark:border-stone-700/40
        shadow-[0_1px_3px_rgba(29,27,26,0.04)] dark:shadow-none
        px-4
      ">
        <div className="
          h-14 w-14 sm:h-16 sm:w-16
          rounded-2xl sm:rounded-2xl
          bg-[#f5f0ee] dark:bg-stone-800
          flex items-center justify-center
          mb-4 sm:mb-5
        ">
          <Search className="h-6 w-6 sm:h-7 sm:w-7 text-[#c7c4d8] dark:text-stone-500" />
        </div>
        <h3 className="
          text-[16px] sm:text-base font-extrabold
          text-[#1d1b1a] dark:text-white
          mb-2 sm:mb-2
        ">
          {fr ? "Aucune bourse trouvée" : "Pa gen bous ki jwenn"}
        </h3>
        <p className="
          text-sm sm:text-sm text-[#6b6563] dark:text-stone-400
          max-w-xs
          leading-relaxed
        ">
          {hasActiveFilters
            ? (fr ? "Essayez d'ajuster vos filtres ou vos termes de recherche." : "Eseye ajiste filt oswa tèm rechèch ou yo.")
            : (fr ? "Nous n'avons pas encore de bourses dans cette catégorie. Revenez bientôt !" : "Nou poko gen bous nan kategori sa a. Tounen talè !")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-6">
      {/* ── Cards grid ── */}
      <div className="
        grid grid-cols-1 sm:grid-cols-2
        gap-4 sm:gap-5
      ">
        {visible.map((scholarship, index) => (
          <div
            key={scholarship.id}
            className="animate-fade-in-up"
            style={{
              animationDelay: `${Math.min(index, 6) * 75}ms`,
              animationFillMode: 'both',
            }}
          >
            <ScholarshipCard
              scholarship={scholarship}
              lang={lang}
              saved={saved.includes(scholarship.id)}
              onToggleSave={onToggleSave}
            />
          </div>
        ))}
      </div>

      {/* ── Load More ── */}
      {hasMore && (
        <div className="flex justify-center pt-2 sm:pt-3">
          <button
            onClick={loadMore}
            className="
              group
              inline-flex items-center gap-2
              px-6 sm:px-5 py-3.5 sm:py-3
              rounded-2xl sm:rounded-xl
              bg-[#3525cd] hover:bg-[#3525cd]/90
              dark:bg-[#c3c0ff] dark:hover:bg-[#c3c0ff]/90
              text-white dark:text-[#1d1b1a]
              font-extrabold text-sm sm:text-sm
              shadow-lg shadow-[#3525cd]/20
              dark:shadow-lg dark:shadow-[#c3c0ff]/15
              hover:shadow-xl hover:shadow-[#3525cd]/25
              dark:hover:shadow-xl dark:hover:shadow-[#c3c0ff]/20
              transition-all duration-300
              active:scale-[0.97] card-press
              min-h-[48px]
            "
          >
            <Sparkles className="h-4 w-4 sm:h-3.5 sm:w-3.5 transition-transform duration-300 group-hover:rotate-12" />
            {fr
              ? `Voir plus (${scholarships.length - visibleCount})`
              : `Wè plis (${scholarships.length - visibleCount})`}
          </button>
        </div>
      )}

      {/* ── End of list indicator ── */}
      {!hasMore && scholarships.length > PAGE_SIZE && (
        <p className="
          text-center
          text-[12px] sm:text-[11px] font-medium
          text-[#c7c4d8] dark:text-stone-600
          pt-2
        ">
          {fr ? `Toutes les ${scholarships.length} bourses affichées` : `Tout ${scholarships.length} bous yo afiche`}
          <span className="mx-2">·</span>
          <span className="text-[#3525cd] dark:text-[#c3c0ff]">✦</span>
        </p>
      )}
    </div>
  );
}