"use client";

/**
 * BoursesSearchBar — Unified search & quick-filter bar for /bourses.
 *
 * Clean horizontal bar with search input, Region/Level quick selects,
 * and a "Refine Selection" CTA that opens the advanced filter drawer.
 */

import { Search, Globe, GraduationCap, SlidersHorizontal, ChevronDown } from "lucide-react";
import { useState } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface BoursesSearchBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  countryFilter: string;
  levelFilter: string;
  onFilterChange: (key: string, value: string) => void;
  countryOptions: SelectOption[];
  levelOptions: SelectOption[];
  onOpenDrawer: () => void;
  drawerFilterCount: number;
  fr: boolean;
}

export function BoursesSearchBar({
  searchQuery,
  onSearchChange,
  countryFilter,
  levelFilter,
  onFilterChange,
  countryOptions,
  levelOptions,
  onOpenDrawer,
  drawerFilterCount,
  fr,
}: BoursesSearchBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-[#c7c4d8]/15 dark:border-stone-700/60 bg-white dark:bg-stone-900/80 shadow-sm">
      {/* ── Main row: Search + CTA ── */}
      <div className="flex items-center gap-2 p-2">
        {/* ── Search input ── */}
        <div className="flex-1 min-w-0 relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#474948] dark:text-stone-500" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-3 bg-[#f9f2f0] dark:bg-stone-800 border-none focus:ring-0 rounded-xl text-[#1d1b1a] dark:text-white placeholder:text-[#474948] dark:placeholder:text-stone-500 py-2.5 text-sm"
            placeholder={
              fr
                ? "Rechercher..."
                : "Chèche..."
            }
          />
        </div>

        {/* ── Mobile: toggle expand / Refine ── */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="sm:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl bg-[#f9f2f0] dark:bg-stone-800 text-[#474948] dark:text-stone-300 hover:bg-[#e8e1df] dark:hover:bg-stone-700 transition-colors"
          aria-label={fr ? "Filtres" : "Filtè"}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {drawerFilterCount > 0 && (
            <span className="absolute -top-1 -right-1 rounded-full bg-[#3525cd] text-white text-[9px] font-bold h-4 w-4 flex items-center justify-center">
              {drawerFilterCount}
            </span>
          )}
        </button>

        {/* ── Desktop: Country + Level selectors ── */}
        <div className="hidden sm:flex items-center gap-1">
          <div className="h-8 w-px bg-[#c7c4d8]/20 dark:bg-stone-700/40" />

          <button
            type="button"
            className="group flex items-center gap-1.5 px-3 py-2 hover:bg-[#f9f2f0] dark:hover:bg-stone-800 transition-colors rounded-xl text-sm font-medium text-[#464555] dark:text-stone-300 relative"
          >
            <Globe className="h-3.5 w-3.5 text-[#474948] dark:text-stone-500 shrink-0" />
            <select
              value={countryFilter}
              onChange={(e) => onFilterChange("country", e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label={fr ? "Région" : "Rejyon"}
            >
              <option value="all">{fr ? "Toutes les régions" : "Tout rejyon yo"}</option>
              {countryOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="text-xs truncate max-w-[80px]">
              {countryFilter === "all" ? (fr ? "Région" : "Rejyon") : countryOptions.find(o => o.value === countryFilter)?.label ?? countryFilter}
            </span>
            <ChevronDown className="h-3 w-3 text-[#c7c4d8] dark:text-stone-600 shrink-0" />
          </button>

          <div className="h-8 w-px bg-[#c7c4d8]/20 dark:bg-stone-700/40" />

          <button
            type="button"
            className="group flex items-center gap-1.5 px-3 py-2 hover:bg-[#f9f2f0] dark:hover:bg-stone-800 transition-colors rounded-xl text-sm font-medium text-[#464555] dark:text-stone-300 relative"
          >
            <GraduationCap className="h-3.5 w-3.5 text-[#474948] dark:text-stone-500 shrink-0" />
            <select
              value={levelFilter}
              onChange={(e) => onFilterChange("level", e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              aria-label={fr ? "Niveau" : "Nivo"}
            >
              <option value="all">{fr ? "Tous les niveaux" : "Tout nivo yo"}</option>
              {levelOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="text-xs truncate max-w-[70px]">
              {levelFilter === "all" ? (fr ? "Niveau" : "Nivo") : levelOptions.find(o => o.value === levelFilter)?.label ?? levelFilter}
            </span>
            <ChevronDown className="h-3 w-3 text-[#c7c4d8] dark:text-stone-600 shrink-0" />
          </button>
        </div>

        {/* ── Desktop Refine CTA ── */}
        <button
          type="button"
          onClick={onOpenDrawer}
          className="hidden sm:inline-flex bg-[#3525cd] hover:bg-[#4f46e5] text-white px-5 py-2 rounded-xl text-sm font-bold transition-colors items-center gap-2 shrink-0"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {fr ? "Filtres" : "Filtè"}
          {drawerFilterCount > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">
              {drawerFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Expandable quick filters (mobile only) ── */}
      {expanded && (
        <div className="sm:hidden border-t border-[#c7c4d8]/10 dark:border-stone-700/40 px-3 py-3 space-y-3">
          {/* Country filter */}
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#474948] dark:text-stone-500 shrink-0" />
            <select
              value={countryFilter}
              onChange={(e) => onFilterChange("country", e.target.value)}
              className="flex-1 bg-[#f9f2f0] dark:bg-stone-800 border-none rounded-lg px-3 py-2 text-sm text-[#1d1b1a] dark:text-white"
              aria-label={fr ? "Région" : "Rejyon"}
            >
              <option value="all">{fr ? "Toutes les régions" : "Tout rejyon yo"}</option>
              {countryOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* Level filter */}
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-[#474948] dark:text-stone-500 shrink-0" />
            <select
              value={levelFilter}
              onChange={(e) => onFilterChange("level", e.target.value)}
              className="flex-1 bg-[#f9f2f0] dark:bg-stone-800 border-none rounded-lg px-3 py-2 text-sm text-[#1d1b1a] dark:text-white"
              aria-label={fr ? "Niveau" : "Nivo"}
            >
              <option value="all">{fr ? "Tous les niveaux" : "Tout nivo yo"}</option>
              {levelOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {/* Advanced filters button */}
          <button
            type="button"
            onClick={() => {
              onOpenDrawer();
              setExpanded(false);
            }}
            className="w-full bg-[#3525cd] hover:bg-[#4f46e5] text-white py-2.5 rounded-xl text-sm font-bold transition-colors inline-flex items-center justify-center gap-2"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {fr ? "Filtres avancés" : "Filtè avanse"}
            {drawerFilterCount > 0 && (
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                {drawerFilterCount}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
