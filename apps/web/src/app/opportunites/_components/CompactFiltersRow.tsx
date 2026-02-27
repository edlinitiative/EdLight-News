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
    <div className="sticky top-16 z-20 rounded-2xl border border-stone-200/80 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur-md dark:border-stone-700 dark:bg-stone-900/95">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search — full width on mobile, flexible on desktop */}
        <div className="relative w-full min-w-0 sm:w-auto sm:flex-1 sm:min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={fr ? "Rechercher…" : "Chèche…"}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 py-1.5 pl-8 pr-8 text-sm text-stone-900 placeholder:text-stone-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-blue-600 dark:focus:ring-blue-800/40"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
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
          className="h-8 appearance-none rounded-xl border border-stone-200 bg-white pl-2.5 pr-7 text-xs font-medium text-stone-700 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:focus:border-blue-600"
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
          className="inline-flex h-8 items-center gap-1 rounded-xl border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {fr ? "Filtres" : "Filtè"}
          {drawerFilterCount > 0 && (
            <span className="ml-0.5 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {drawerFilterCount}
            </span>
          )}
        </button>

        {/* Suivis / Saved */}
        <button
          type="button"
          onClick={onToggleSaved}
          className={`inline-flex h-8 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            showSavedOnly
              ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          }`}
        >
          <Bookmark className={`h-3.5 w-3.5 ${showSavedOnly ? "fill-current" : ""}`} />
          {fr ? "Suivis" : "Swivi"}
          {savedCount > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                showSavedOnly
                  ? "bg-white/20 text-white"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
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
        <span className="ml-auto text-xs tabular-nums text-stone-500 dark:text-stone-400">
          <span className="font-bold text-stone-800 dark:text-white">{resultCount}</span>
          <span className="text-stone-300 dark:text-stone-600">/</span>
          {totalCount}
        </span>
      </div>
    </div>
  );
}
