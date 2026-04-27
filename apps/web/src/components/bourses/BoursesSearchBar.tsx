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

  const hasActiveQuickFilters = countryFilter !== "all" || levelFilter !== "all";

  return (
    <div className="rounded-2xl border border-[#c7c4d8]/10 dark:border-stone-700/40 bg-white/90 dark:bg-stone-900/90 shadow-[0_4px_24px_-4px_rgba(29,27,26,0.04)] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.3)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/70 supports-[backdrop-filter]:dark:bg-stone-900/70 transition-shadow duration-300 hover:shadow-[0_8px_32px_-8px_rgba(29,27,26,0.06)] dark:hover:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.4)]">
      {/* ── Mobile-only: Active quick-filter chips ── */}
      {hasActiveQuickFilters && (
        <div className="sm:hidden flex items-center gap-1.5 px-3 pt-3 -mb-1 flex-wrap">
          {countryFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#3525cd]/10 dark:bg-[#c3c0ff]/10 text-[#3525cd] dark:text-[#c3c0ff] text-[11px] font-semibold px-2.5 py-1">
              {countryOptions.find(o => o.value === countryFilter)?.label ?? countryFilter}
              <button
                type="button"
                onClick={() => onFilterChange("country", "all")}
                className="hover:bg-[#3525cd]/20 rounded-full p-0.5 -mr-1"
                aria-label="Clear country filter"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          )}
          {levelFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#3525cd]/10 dark:bg-[#c3c0ff]/10 text-[#3525cd] dark:text-[#c3c0ff] text-[11px] font-semibold px-2.5 py-1">
              {levelOptions.find(o => o.value === levelFilter)?.label ?? levelFilter}
              <button
                type="button"
                onClick={() => onFilterChange("level", "all")}
                className="hover:bg-[#3525cd]/20 rounded-full p-0.5 -mr-1"
                aria-label="Clear level filter"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          )}
        </div>
      )}

      {/* ── Main row: Search + CTA ── */}
      <div className="flex items-center gap-2 p-2 sm:p-2">
        {/* ── Search input ── */}
        <div className="flex-1 min-w-0 relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#474948]/60 dark:text-stone-500/60" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-11 pr-4 bg-[#f9f2f0]/80 dark:bg-stone-800/80 border-none focus:ring-0 rounded-xl text-[#1d1b1a] dark:text-white placeholder:text-[#474948]/50 dark:placeholder:text-stone-500/50 py-3.5 sm:py-2.5 text-base sm:text-sm transition-all duration-200 focus:bg-[#f9f2f0] dark:focus:bg-stone-800 focus:shadow-[inset_0_1px_3px_rgba(29,27,26,0.04)] dark:focus:shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]"
            placeholder={
              fr
                ? "Rechercher une bourse..."
                : "Chèche yon bous..."
            }
          />
        </div>

        {/* ── Mobile: toggle expand / Refine ── */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="sm:hidden relative inline-flex items-center justify-center h-12 w-12 rounded-xl bg-[#f9f2f0]/80 dark:bg-stone-800/80 text-[#474948] dark:text-stone-300 hover:bg-[#e8e1df] dark:hover:bg-stone-700 active:scale-95 transition-all duration-200 shadow-sm"
          aria-label={fr ? "Filtres" : "Filtè"}
        >
          <SlidersHorizontal className={`h-5 w-5 transition-transform duration-300 ${expanded ? 'rotate-90' : ''}`} />
          {(drawerFilterCount > 0 || hasActiveQuickFilters) && (
            <span className="absolute -top-1 -right-1 rounded-full bg-[#3525cd] text-white text-[9px] font-bold min-w-[18px] h-[18px] flex items-center justify-center px-0.5 shadow-sm">
              {drawerFilterCount + (hasActiveQuickFilters ? 1 : 0)}
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
          className="hidden sm:inline-flex bg-[#3525cd] hover:bg-[#4f46e5] active:bg-[#2c1fb8] text-white px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 items-center gap-2 shrink-0 shadow-sm hover:shadow-md active:scale-[0.97]"
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
      <div
        className={`sm:hidden overflow-hidden transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          expanded ? 'max-h-[320px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="border-t border-[#c7c4d8]/8 dark:border-stone-700/30 px-5 py-5 space-y-5 bg-[#fdfaf9]/60 dark:bg-stone-950/40 rounded-b-2xl">
          {/* Country filter */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#464555] dark:text-stone-400 mb-2">
              <Globe className="h-3.5 w-3.5 text-[#474948] dark:text-stone-500 shrink-0" />
              {fr ? "Région" : "Rejyon"}
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onFilterChange("country", "all")}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  countryFilter === "all"
                    ? "bg-[#3525cd] text-white shadow-sm"
                    : "bg-[#f9f2f0] dark:bg-stone-800 text-[#464555] dark:text-stone-300 hover:bg-[#e8e1df] dark:hover:bg-stone-700"
                }`}
              >
                {fr ? "Toutes" : "Tout"}
              </button>
              {countryOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onFilterChange("country", o.value)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                    countryFilter === o.value
                      ? "bg-[#3525cd] text-white shadow-sm"
                      : "bg-[#f9f2f0] dark:bg-stone-800 text-[#464555] dark:text-stone-300 hover:bg-[#e8e1df] dark:hover:bg-stone-700"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Level filter */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#464555] dark:text-stone-400 mb-2">
              <GraduationCap className="h-3.5 w-3.5 text-[#474948] dark:text-stone-500 shrink-0" />
              {fr ? "Niveau" : "Nivo"}
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onFilterChange("level", "all")}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                  levelFilter === "all"
                    ? "bg-[#3525cd] text-white shadow-sm"
                    : "bg-[#f9f2f0] dark:bg-stone-800 text-[#464555] dark:text-stone-300 hover:bg-[#e8e1df] dark:hover:bg-stone-700"
                }`}
              >
                {fr ? "Tous" : "Tout"}
              </button>
              {levelOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => onFilterChange("level", o.value)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
                    levelFilter === o.value
                      ? "bg-[#3525cd] text-white shadow-sm"
                      : "bg-[#f9f2f0] dark:bg-stone-800 text-[#464555] dark:text-stone-300 hover:bg-[#e8e1df] dark:hover:bg-stone-700"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced filters button */}
          <button
            type="button"
            onClick={() => {
              onOpenDrawer();
              setExpanded(false);
            }}
            className="w-full bg-[#3525cd] hover:bg-[#4f46e5] active:bg-[#2c1fb8] active:scale-[0.98] text-white py-3.5 rounded-xl text-sm font-bold transition-all duration-200 inline-flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {fr ? "Filtres avancés" : "Filtè avanse"}
            {drawerFilterCount > 0 && (
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">
                {drawerFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
