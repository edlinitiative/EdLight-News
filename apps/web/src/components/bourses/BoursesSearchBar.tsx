"use client";

/**
 * BoursesSearchBar — Unified search & quick-filter bar for /bourses.
 *
 * Clean horizontal bar with search input, Region/Level quick selects,
 * and a "Refine Selection" CTA that opens the advanced filter drawer.
 */

import { Search, Globe, GraduationCap, SlidersHorizontal } from "lucide-react";

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
  return (
    <div className="rounded-full border border-[#c7c4d8]/15 dark:border-stone-700/60 bg-[#f9f2f0] dark:bg-stone-900/60 p-2 flex flex-wrap items-center gap-2">
      {/* ── Search input ── */}
      <div className="flex-1 min-w-[240px] relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#474948] dark:text-stone-500" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-11 pr-4 bg-transparent border-none focus:ring-0 text-[#1d1b1a] dark:text-white placeholder:text-[#474948] dark:placeholder:text-stone-500 py-3 text-sm"
          placeholder={
            fr
              ? "Rechercher par institution, pays ou domaine..."
              : "Chèche pa enstitisyon, peyi oswa domèn..."
          }
        />
      </div>

      {/* ── Divider ── */}
      <div className="h-8 w-px bg-[#c7c4d8]/20 dark:bg-stone-700/40 hidden md:block" />

      {/* ── Region selector ── */}
      <button
        type="button"
        className="group flex items-center gap-2 px-4 py-3 hover:bg-white dark:hover:bg-stone-800 transition-colors rounded-full text-sm font-medium text-[#464555] dark:text-stone-300 relative"
      >
        <Globe className="h-4 w-4 text-[#474948] dark:text-stone-500" />
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
        <span>{countryFilter === "all" ? (fr ? "Région" : "Rejyon") : countryOptions.find(o => o.value === countryFilter)?.label ?? countryFilter}</span>
      </button>

      {/* ── Level selector ── */}
      <button
        type="button"
        className="group flex items-center gap-2 px-4 py-3 hover:bg-white dark:hover:bg-stone-800 transition-colors rounded-full text-sm font-medium text-[#464555] dark:text-stone-300 relative"
      >
        <GraduationCap className="h-4 w-4 text-[#474948] dark:text-stone-500" />
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
        <span>{levelFilter === "all" ? (fr ? "Niveau" : "Nivo") : levelOptions.find(o => o.value === levelFilter)?.label ?? levelFilter}</span>
      </button>

      {/* ── Refine Selection CTA ── */}
      <button
        type="button"
        onClick={onOpenDrawer}
        className="bg-[#3525cd] hover:bg-[#4f46e5] text-white px-6 py-3 rounded-full text-sm font-bold ml-auto transition-colors inline-flex items-center gap-2"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {fr ? "Affiner la sélection" : "Rafine seleksyon"}
        {drawerFilterCount > 0 && (
          <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">
            {drawerFilterCount}
          </span>
        )}
      </button>
    </div>
  );
}
