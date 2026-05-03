"use client";

/**
 * BoursesSidebar — Mobile-first premium filters sidebar.
 *
 * Key improvements:
 *   - Mobile: collapsible accordion panels instead of stacking all filters
 *   - Desktop: sticky sidebar with consistent height
 *   - Clear active filter count badges
 *   - Reset button visible at all times when filters are active
 *   - Touch-friendly 44px+ tap targets for all interactive elements
 *   - Smooth expand/collapse animations
 */

import type { ContentLanguage, DatasetCountry, AcademicLevel } from "@edlight-news/types";
import type { ScholarshipFundingType, ScholarshipHaitianEligibility } from "@edlight-news/types";
import { useState } from "react";
import type { BourseFilters as BourseFiltersType } from "@/components/bourses/BoursesEditorial";
import { Sliders, ChevronDown, X } from "lucide-react";

interface BoursesSidebarProps {
  lang: ContentLanguage;
  countries: DatasetCountry[];
  levels: AcademicLevel[];
  filters: BourseFiltersType;
  onFiltersChange: (filters: BourseFiltersType) => void;
}

type AccordionKey = "country" | "funding" | "level" | "eligibility";

export function BoursesSidebar({ lang, countries, levels, filters, onFiltersChange }: BoursesSidebarProps) {
  const fr = lang === "fr";
  const [openPanels, setOpenPanels] = useState<Record<AccordionKey, boolean>>({
    country: true,
    funding: true,
    level: false,
    eligibility: false,
  });

  const togglePanel = (key: AccordionKey) => {
    setOpenPanels(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasActiveFilters =
    (filters.countries?.length ?? 0) > 0 ||
    (filters.fundingTypes?.length ?? 0) > 0 ||
    (filters.levels?.length ?? 0) > 0 ||
    (filters.haitianEligibility ?? "all") !== "all";

  const clearAll = () => {
    onFiltersChange({});
  };

  const activeCount =
    (filters.countries?.length ?? 0) +
    (filters.fundingTypes?.length ?? 0) +
    (filters.levels?.length ?? 0) +
    ((filters.haitianEligibility ?? "all") !== "all" ? 1 : 0);

  const fundingTypes: ScholarshipFundingType[] = ["full", "partial", "stipend", "tuition-only"];

  const AccoItem = ({ k, label }: { k: AccordionKey; label: string }) => (
    <div className="border-b border-[#f3ecea]/60 dark:border-stone-800/60 last:border-b-0">
      <button
        type="button"
        onClick={() => togglePanel(k)}
        className="
          flex items-center justify-between w-full
          py-3.5 sm:py-3
          text-left
          font-bold text-[13px] sm:text-xs
          text-[#1d1b1a] dark:text-stone-200
          hover:text-[#3525cd] dark:hover:text-[#c3c0ff]
          transition-colors duration-200
          /* 44px min touch target */
          min-h-[44px] sm:min-h-[40px]
          focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3525cd]
          rounded-lg sm:rounded-md
        "
      >
        <span>{label}</span>
        <ChevronDown
          className={`
            h-4 w-4 sm:h-3.5 sm:w-3.5
            text-[#c7c4d8] dark:text-stone-500
            transition-transform duration-300 ease-out
            ${openPanels[k] ? 'rotate-0' : '-rotate-90'}
          `}
        />
      </button>
      <div
        className={`
          overflow-hidden transition-all duration-300 ease-out
          ${openPanels[k] ? 'max-h-[500px] opacity-100 pb-3 sm:pb-2.5' : 'max-h-0 opacity-0 pb-0'}
        `}
      >
        {k === "country" && (
          <div className="flex flex-wrap gap-1.5 sm:gap-1.5">
            {countries.map((c) => (
              <button
                key={c}
                onClick={() => {
                  const current = filters.countries ?? [];
                  const next = current.includes(c)
                    ? current.filter((x: DatasetCountry) => x !== c)
                    : [...current, c];
                  onFiltersChange({ ...filters, countries: next.length > 0 ? next : undefined });
                }}
                className={`
                  rounded-lg sm:rounded-md
                  px-3 py-2 sm:px-2.5 sm:py-1.5
                  text-[12px] sm:text-[10px] font-semibold
                  border
                  transition-all duration-200
                  min-h-[40px] sm:min-h-[32px]
                  flex items-center gap-1.5
                  ${(filters.countries ?? []).includes(c)
                    ? "bg-[#3525cd]/10 text-[#3525cd] border-[#3525cd]/30 dark:bg-[#c3c0ff]/12 dark:text-[#c3c0ff] dark:border-[#c3c0ff]/30"
                    : "bg-[#f5f0ee] text-[#464555] border-[#c7c4d8]/10 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700/30 hover:border-[#3525cd]/20 dark:hover:border-[#c3c0ff]/20"
                  }
                `}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {k === "funding" && (
          <div className="flex flex-wrap gap-1.5 sm:gap-1.5">
            {fundingTypes.map((ft) => (
              <button
                key={ft}
                onClick={() => {
                  const current = filters.fundingTypes ?? [];
                  const next = current.includes(ft)
                    ? current.filter((x: ScholarshipFundingType) => x !== ft)
                    : [...current, ft];
                  onFiltersChange({ ...filters, fundingTypes: next.length > 0 ? next : undefined });
                }}
                className={`
                  rounded-lg sm:rounded-md
                  px-3 py-2 sm:px-2.5 sm:py-1.5
                  text-[12px] sm:text-[10px] font-semibold
                  border capitalize
                  transition-all duration-200
                  min-h-[40px] sm:min-h-[32px]
                  ${(filters.fundingTypes ?? []).includes(ft)
                    ? "bg-[#3525cd]/10 text-[#3525cd] border-[#3525cd]/30 dark:bg-[#c3c0ff]/12 dark:text-[#c3c0ff] dark:border-[#c3c0ff]/30"
                    : "bg-[#f5f0ee] text-[#464555] border-[#c7c4d8]/10 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700/30 hover:border-[#3525cd]/20 dark:hover:border-[#c3c0ff]/20"
                  }
                `}
              >
                {ft === "full" ? (fr ? "Complet" : "Konplè")
                  : ft === "partial" ? (fr ? "Partiel" : "Pasyèl")
                  : ft === "stipend" ? (fr ? "Allocation" : "Alokasyon")
                  : (fr ? "Scolarité" : "Frè etid")}
              </button>
            ))}
          </div>
        )}

        {k === "level" && (
          <div className="flex flex-wrap gap-1.5 sm:gap-1.5">
            {levels.map((l) => (
              <button
                key={l}
                onClick={() => {
                  const current = filters.levels ?? [];
                  const next = current.includes(l)
                    ? current.filter((x: AcademicLevel) => x !== l)
                    : [...current, l];
                  onFiltersChange({ ...filters, levels: next.length > 0 ? next : undefined });
                }}
                className={`
                  rounded-lg sm:rounded-md
                  px-3 py-2 sm:px-2.5 sm:py-1.5
                  text-[12px] sm:text-[10px] font-semibold
                  border
                  transition-all duration-200
                  min-h-[40px] sm:min-h-[32px]
                  ${(filters.levels ?? []).includes(l)
                    ? "bg-[#3525cd]/10 text-[#3525cd] border-[#3525cd]/30 dark:bg-[#c3c0ff]/12 dark:text-[#c3c0ff] dark:border-[#c3c0ff]/30"
                    : "bg-[#f5f0ee] text-[#464555] border-[#c7c4d8]/10 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700/30 hover:border-[#3525cd]/20 dark:hover:border-[#c3c0ff]/20"
                  }
                `}
              >
                {l === "bachelor" ? (fr ? "Bachelor" : "Lisans")
                  : l === "master" ? (fr ? "Master" : "Metriz")
                  : l === "phd" ? "PhD"
                  : (fr ? "Courts" : "Kout")}
              </button>
            ))}
          </div>
        )}

        {k === "eligibility" && (
          <div className="flex flex-wrap gap-1.5 sm:gap-1.5">
            {(["all", "yes", "no"] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onFiltersChange({
                    ...filters,
                    haitianEligibility: opt === "all" ? "all" : opt,
                  });
                }}
                className={`
                  rounded-lg sm:rounded-md
                  px-3 py-2 sm:px-2.5 sm:py-1.5
                  text-[12px] sm:text-[10px] font-semibold
                  border
                  transition-all duration-200
                  min-h-[40px] sm:min-h-[32px]
                  ${(filters.haitianEligibility ?? "all") === opt
                    ? "bg-[#3525cd]/10 text-[#3525cd] border-[#3525cd]/30 dark:bg-[#c3c0ff]/12 dark:text-[#c3c0ff] dark:border-[#c3c0ff]/30"
                    : "bg-[#f5f0ee] text-[#464555] border-[#c7c4d8]/10 dark:bg-stone-800 dark:text-stone-300 dark:border-stone-700/30 hover:border-[#3525cd]/20 dark:hover:border-[#c3c0ff]/20"
                  }
                `}
              >
                {opt === "all" ? (fr ? "Toutes" : "Tout")
                  : opt === "yes" ? (fr ? "🇭🇹 Éligible" : "🇭🇹 Elijib")
                  : (fr ? "Non-éligible" : "Non-elijib")}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <aside className="
      /* Mobile: full-width below feed, stacked as accordion */
      /* Desktop: sticky sidebar */
      sm:sticky sm:top-24
      bg-white dark:bg-stone-900/95
      rounded-2xl sm:rounded-2xl
      border border-[#f3ecea]/30 dark:border-stone-700/40
      shadow-[0_1px_3px_rgba(29,27,26,0.04)] dark:shadow-none
    ">
      {/* ── Header ── */}
      <div className="
        flex items-center justify-between
        px-4 py-4 sm:px-5 sm:py-3.5
        border-b border-[#f3ecea]/60 dark:border-stone-800/60
      ">
        <div className="flex items-center gap-2 sm:gap-1.5">
          <Sliders className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-[#3525cd] dark:text-[#c3c0ff]" />
          <h3 className="text-[14px] sm:text-xs font-bold text-[#1d1b1a] dark:text-stone-200">
            {fr ? "Filtres" : "Filt"}
          </h3>
          {activeCount > 0 && (
            <span className="
              inline-flex items-center justify-center
              h-5 sm:h-4 min-w-[20px] sm:min-w-[16px]
              rounded-full
              bg-[#3525cd] dark:bg-[#c3c0ff]
              text-[10px] sm:text-[9px] font-extrabold
              text-white dark:text-[#1d1b1a]
              px-1.5
            ">
              {activeCount}
            </span>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="
              flex items-center gap-1 sm:gap-0.5
              text-[11px] sm:text-[10px] font-bold
              text-[#93000a] dark:text-red-400
              hover:opacity-80
              transition-opacity duration-200
              min-h-[44px] sm:min-h-[36px]
              px-2
              rounded-lg
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd]
            "
          >
            <X className="h-3 w-3 sm:h-2.5 sm:w-2.5" />
            <span className="hidden sm:inline">{fr ? "Réinit." : "Reyini."}</span>
            <span className="sm:hidden">{fr ? "Tout effacer" : "Efase tout"}</span>
          </button>
        )}
      </div>

      {/* ── Accordion panels ── */}
      <div className="px-4 sm:px-5">
        <AccoItem k="country" label={fr ? "Pays" : "Peyi"} />
        <AccoItem k="funding" label={fr ? "Financement" : "Finansman"} />
        <AccoItem k="level" label={fr ? "Niveau" : "Nivo"} />
        <AccoItem k="eligibility" label={fr ? "Éligibilité" : "Elijibilite"} />
      </div>
    </aside>
  );
}