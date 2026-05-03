"use client";

/**
 * BoursesEditorial — Mobile-first premium main editorial layout.
 *
 * Key improvements:
 *   - Mobile: Floating "Filters" FAB button, feed first then sidebar below
 *   - Desktop: Classic two-column (feed + sticky sidebar)
 *   - Smooth scroll-to-sidebar on mobile via FAB
 *   - Results count with premium typography
 *   - Clean visual hierarchy with generous spacing
 *   - Empty state with premium styling
 */

import type { ContentLanguage, DatasetCountry, AcademicLevel } from "@edlight-news/types";
import type { ScholarshipFundingType, ScholarshipHaitianEligibility } from "@edlight-news/types";
import { useState, useRef, useCallback, useEffect } from "react";
import type { SerializedScholarship } from "@/components/BoursesFilters";

export interface BourseFilters {
  countries?: DatasetCountry[];
  levels?: AcademicLevel[];
  fundingTypes?: ScholarshipFundingType[];
  haitianEligibility?: ScholarshipHaitianEligibility | "all";
}
import { BoursesSearchBar } from "./BoursesSearchBar";
import { FeaturedBourses } from "./FeaturedBourses";
import { BoursesSidebar } from "./BoursesSidebar";
import { BoursesFeed } from "./BoursesFeed";
import { Sliders, ArrowDown } from "lucide-react";

interface BoursesEditorialProps {
  scholarships: SerializedScholarship[];
  lang: ContentLanguage;
}

export function BoursesEditorial({ scholarships, lang }: BoursesEditorialProps) {
  const fr = lang === "fr";

  // ── State ──
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<BourseFilters>({});
  const [saved, setSaved] = useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);

  // Load saved from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("edlight-bourses-saved");
      if (raw) {
        const ids = JSON.parse(raw);
        if (Array.isArray(ids)) setSaved(ids);
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleSave = useCallback((id: string) => {
    setSaved((prev) => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter((x) => x !== id);
      } else {
        next = [...prev, id];
      }
      try {
        localStorage.setItem("edlight-bourses-saved", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // ── Extract unique filter options ──
  const countries = Array.from(
    new Set(scholarships.map((s) => s.country))
  ).sort() as DatasetCountry[];

  const levels = Array.from(
    new Set(scholarships.flatMap((s) => s.level))
  ).sort() as AcademicLevel[];

  // ── Apply filters ──
  const filtered = scholarships.filter((s) => {
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesName = s.name.toLowerCase().includes(q);
      const matchesTags = s.tags?.some((t) => t.toLowerCase().includes(q));
      const matchesSummary = s.eligibilitySummary?.toLowerCase().includes(q);
      if (!matchesName && !matchesTags && !matchesSummary) return false;
    }

    // Countries
    if ((filters.countries?.length ?? 0) > 0 && !(filters.countries ?? []).includes(s.country)) {
      return false;
    }

    // Funding types
    if (
      (filters.fundingTypes?.length ?? 0) > 0 &&
      !(filters.fundingTypes ?? []).includes(s.fundingType)
    ) {
      return false;
    }

    // Levels
    if (
      (filters.levels?.length ?? 0) > 0 &&
      !s.level.some((l) => (filters.levels ?? []).includes(l))
    ) {
      return false;
    }

    // Haitian eligibility
    const he = filters.haitianEligibility ?? "all";
    if (he !== "all" && s.haitianEligibility !== he) return false;

    return true;
  });

  // ── Featured: those with most tags or explicit featured flag ──
  const featured = filtered
    .filter((s) => (s.tags?.length ?? 0) >= 3)
    .slice(0, 6);

  const scrollToFilters = () => {
    sidebarRef.current?.scrollIntoView({ behavior: "smooth" });
    setMobileFiltersOpen(true);
  };

  const hasActive = search.trim().length > 0 || Object.keys(filters).length > 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Mobile Filters FAB (fixed bottom-right, above MobileBottomNav) ── */}
      <button
        type="button"
        onClick={scrollToFilters}
        className="
          sm:hidden
          fixed bottom-24 right-4 z-30
          flex items-center gap-2
          bg-[#3525cd] dark:bg-[#c3c0ff]
          text-white dark:text-[#1d1b1a]
          rounded-2xl
          px-4 py-3
          shadow-xl shadow-[#3525cd]/25 dark:shadow-[#c3c0ff]/15
          font-extrabold text-sm
          active:scale-95 transition-transform duration-200
          animate-fade-in-up
        "
        aria-label={fr ? "Filtres" : "Filt"}
      >
        <Sliders className="h-4 w-4" />
        {fr ? "Filtrer" : "Filtre"}
        {hasActive && (
          <span className="ml-1 h-5 min-w-[20px] rounded-full bg-white/25 dark:bg-[#1d1b1a]/25 px-1 text-[10px] flex items-center justify-center">
            !
          </span>
        )}
      </button>

      {/* ── Search & Results count ── */}
      <div className="space-y-4 sm:space-y-5">
        <BoursesSearchBar
          value={search}
          onChange={setSearch}
          lang={lang}
        />

        {/* Results count with premium typography */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] sm:text-xs font-semibold text-[#6b6563] dark:text-stone-400">
            {hasActive
              ? (
                  fr
                    ? `${filtered.length} sur ${scholarships.length} bourses`
                    : `${filtered.length} sou ${scholarships.length} bous`
                )
              : (
                  fr
                    ? `${filtered.length} bourses disponibles`
                    : `${filtered.length} bous disponib`
                )}
          </p>

          {/* Desktop filter trigger */}
          <button
            onClick={scrollToFilters}
            className="
              hidden sm:inline-flex
              items-center gap-1.5
              text-[12px] sm:text-[11px] font-bold
              text-[#464555] dark:text-stone-300
              hover:text-[#3525cd] dark:hover:text-[#c3c0ff]
              transition-colors duration-200
            "
          >
            <Sliders className="h-3.5 w-3.5" />
            {fr ? "Filtres" : "Filt"}
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ── Featured Scholarships ── */}
      {!hasActive && featured.length > 0 && (
        <FeaturedBourses
          scholarships={featured}
          lang={lang}
          saved={saved}
          onToggleSave={toggleSave}
        />
      )}

      {/* ── Main Layout: Feed + Sidebar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_300px] gap-8 sm:gap-8 mb-24 sm:mb-0">
        {/* Feed */}
        <div className="min-w-0">
          <BoursesFeed
            scholarships={filtered}
            lang={lang}
            saved={saved}
            onToggleSave={toggleSave}
            hasActiveFilters={hasActive}
          />
        </div>

        {/* Sidebar (below feed on mobile, beside on desktop) */}
        <div ref={sidebarRef} className="sm:block" id="bourses-sidebar">
          <BoursesSidebar
            lang={lang}
            countries={countries}
            levels={levels}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>
      </div>
    </div>
  );
}