"use client";

import { Search, X, SlidersHorizontal, Bookmark } from "lucide-react";
import { SortMenuPill } from "./SortMenuPill";

interface CompactFiltersRowProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sortMode: string;
  onSortChange: (key: string, value: string) => void;
  subcategoryFilter: string;
  subcategoryOptions: { value: string; label: string }[];
  onFilterChange: (key: string, value: string) => void;
  showSavedOnly: boolean;
  onToggleSaved: () => void;
  savedCount: number;
  onOpenDrawer: () => void;
  drawerFilterCount: number;
  resultCount: number;
  totalCount: number;
  fr: boolean;
}

export function CompactFiltersRow({
  searchQuery,
  onSearchChange,
  sortMode,
  onSortChange,
  subcategoryFilter,
  subcategoryOptions,
  onFilterChange,
  showSavedOnly,
  onToggleSaved,
  savedCount,
  onOpenDrawer,
  drawerFilterCount,
  resultCount,
  totalCount,
  fr,
}: CompactFiltersRowProps) {
  return (
    <div className="sticky top-16 z-20 rounded-xl border border-[#c7c4d8]/15 bg-white px-3 py-2.5 shadow-[0_20px_40px_rgba(29,27,26,0.03)] dark:border-stone-700 dark:bg-stone-900">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search — full width on mobile, flexible on desktop */}
        <div className="relative w-full min-w-0 sm:w-auto sm:flex-1 sm:min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#474948]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={fr ? "Rechercher…" : "Chèche…"}
            className="w-full rounded-full border border-[#c7c4d8]/20 bg-[#f9f2f0] py-1.5 pl-8 pr-8 text-sm text-[#1d1b1a] placeholder:text-[#474948] focus:border-[#3525cd]/30 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-[#c3c0ff] dark:focus:ring-[#c3c0ff]/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#474948] hover:text-[#1d1b1a] dark:hover:text-stone-300"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Type / Subcategory */}
        <select
          value={subcategoryFilter}
          onChange={(e) => onFilterChange("subcategory", e.target.value)}
          className="h-8 appearance-none rounded-full border border-[#c7c4d8]/20 bg-white pl-2.5 pr-7 text-xs font-medium text-[#464555] focus:border-[#3525cd]/30 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:focus:border-[#c3c0ff]"
        >
          <option value="all">{fr ? "📋 Type" : "📋 Tip"}</option>
          {subcategoryOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/* Filtres (opens drawer) */}
        <button
          type="button"
          onClick={onOpenDrawer}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-[#c7c4d8]/20 bg-white px-2.5 text-xs font-semibold text-[#464555] transition-colors hover:bg-[#f9f2f0] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {fr ? "Filtres" : "Filtè"}
          {drawerFilterCount > 0 && (
            <span className="ml-0.5 rounded-full bg-[#3525cd] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {drawerFilterCount}
            </span>
          )}
        </button>

        {/* Suivis / Saved */}
        <button
          type="button"
          onClick={onToggleSaved}
          className={`inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd] ${
            showSavedOnly
              ? "bg-[#3525cd] text-white shadow-sm hover:bg-[#4f46e5] dark:bg-[#4f46e5] dark:hover:bg-[#3525cd]"
              : "border border-[#c7c4d8]/20 bg-white text-[#464555] hover:bg-[#f9f2f0] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          }`}
        >
          <Bookmark className={`h-3.5 w-3.5 ${showSavedOnly ? "fill-current" : ""}`} />
          {fr ? "Suivis" : "Swivi"}
          {savedCount > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                showSavedOnly
                  ? "bg-white/20 text-white"
                  : "bg-[#f9f2f0] text-[#3525cd] dark:bg-stone-700 dark:text-[#c3c0ff]"
              }`}
            >
              {savedCount}
            </span>
          )}
        </button>

        {/* Sort pill / menu */}
        <SortMenuPill
          sortMode={sortMode}
          onSort={(m: string) => onSortChange("sort", m)}
          fr={fr}
        />

        {/* Result count — pushed right */}
        <span className="ml-auto text-xs tabular-nums text-[#474948] dark:text-stone-400">
          <span className="font-bold text-[#1d1b1a] dark:text-white">{resultCount}</span>
          <span className="text-[#c7c4d8] dark:text-stone-600">/</span>
          {totalCount}
        </span>
      </div>
    </div>
  );
}
