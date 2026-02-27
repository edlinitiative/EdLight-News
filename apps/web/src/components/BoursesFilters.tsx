"use client";

/**
 * BoursesFilters — Client component for /bourses page (v2 — premium redesign).
 *
 * Provides:
 * - Sticky filter/search bar with sort controls
 * - URL-driven filter chips (Type, Funding, Level, Country, Eligibility)
 * - Client-side text search (in-memory)
 * - "Suivis" (saved) toggle with localStorage persistence
 * - Renders redesigned ScholarshipCards
 *
 * All filter state remains URL-driven so external links / presets work.
 */

import { useMemo, useCallback, useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type {
  ContentLanguage,
  DatasetCountry,
  AcademicLevel,
  ScholarshipFundingType,
  ScholarshipKind,
  ScholarshipHaitianEligibility,
  ScholarshipDeadlineAccuracy,
} from "@edlight-news/types";
import { Heart } from "lucide-react";
import { FILTER_PARAM_KEYS } from "@/lib/scholarship-params";
import { getSavedIds, toggleSaved, matchesSearch } from "@/lib/bourses-ui";
import { ScholarshipCard } from "@/components/bourses/ScholarshipCard";
import { CompactFiltersRow } from "@/app/bourses/_components/CompactFiltersRow";
import { FiltersDrawer } from "@/app/bourses/_components/FiltersDrawer";
import { ActiveFilterChips } from "@/app/bourses/_components/ActiveFilterChips";
import type { FilterGroup } from "@/app/bourses/_components/FiltersDrawer";
import type { ActiveFilter } from "@/app/bourses/_components/ActiveFilterChips";

export { FILTER_PARAM_KEYS };

// ── Serializable scholarship type (no Firestore Timestamps) ────────────────

export interface SerializedScholarship {
  id: string;
  name: string;
  country: DatasetCountry;
  eligibleCountries?: string[];
  level: AcademicLevel[];
  fundingType: ScholarshipFundingType;
  kind?: ScholarshipKind;
  haitianEligibility?: ScholarshipHaitianEligibility;
  deadlineAccuracy?: ScholarshipDeadlineAccuracy;
  deadline?: {
    dateISO?: string;
    month?: number;
    notes?: string;
    sourceUrl: string;
  };
  officialUrl: string;
  howToApplyUrl?: string;
  requirements?: string[];
  eligibilitySummary?: string;
  recurring?: boolean;
  tags?: string[];
  sources: { label: string; url: string }[];
  verifiedAtISO?: string;
  updatedAtISO?: string;
}

// ── Labels ─────────────────────────────────────────────────────────────────

const FUNDING_FILTER_CHIPS: { key: string; fr: string; ht: string }[] = [
  { key: "all",          fr: "Tous",       ht: "Tout" },
  { key: "full",         fr: "Complet",    ht: "Konplè" },
  { key: "partial",      fr: "Partiel",    ht: "Pasyèl" },
  { key: "tuition-only", fr: "Scolarité",  ht: "Frè etid" },
  { key: "unknown",      fr: "Inconnu",    ht: "Enkonni" },
];

const ELIGIBILITY_FILTER_CHIPS: { key: string; fr: string; ht: string }[] = [
  { key: "all",     fr: "Tous",         ht: "Tout" },
  { key: "yes",     fr: "Oui",          ht: "Wi" },
  { key: "unknown", fr: "À vérifier",   ht: "Pou verifye" },
];

const TYPE_FILTER_CHIPS: { key: string; fr: string; ht: string }[] = [
  { key: "all",        fr: "Tous",        ht: "Tout" },
  { key: "program",    fr: "Programmes",  ht: "Pwogram" },
  { key: "directory",  fr: "Répertoires", ht: "Repètwa" },
];

const LEVEL_LABELS: Record<AcademicLevel, { fr: string; ht: string }> = {
  bachelor:       { fr: "Bachelor",          ht: "Lisans" },
  master:         { fr: "Master",            ht: "Metriz" },
  phd:            { fr: "PhD",               ht: "Doktora" },
  short_programs: { fr: "Courts programmes", ht: "Pwogram kout" },
};

const COUNTRY_LABELS: Record<DatasetCountry, { fr: string; ht: string; code: string }> = {
  US: { fr: "États-Unis",       ht: "Etazini",        code: "US" },
  CA: { fr: "Canada",           ht: "Kanada",         code: "CA" },
  FR: { fr: "France",           ht: "Frans",          code: "FR" },
  UK: { fr: "Royaume-Uni",      ht: "Wayòm Ini",     code: "UK" },
  DO: { fr: "Rép. Dominicaine", ht: "Rep. Dominikèn", code: "DO" },
  MX: { fr: "Mexique",          ht: "Meksik",         code: "MX" },
  CN: { fr: "Chine",            ht: "Lachin",         code: "CN" },
  RU: { fr: "Russie",           ht: "Larisi",         code: "RU" },
  HT: { fr: "Haïti",            ht: "Ayiti",          code: "HT" },
  Global: { fr: "International", ht: "Entènasyonal",  code: "GL" },
};

type SortMode = "deadline" | "latest" | "relevance";

const SORT_LABELS: Record<SortMode, { fr: string; ht: string }> = {
  deadline:  { fr: "Deadline proche", ht: "Dat limit pi pre" },
  latest:    { fr: "Dernières",       ht: "Dènye yo" },
  relevance: { fr: "Pertinence",      ht: "Pètinans" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function daysUntil(dateISO: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(dateISO);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function fundingFilterMatch(s: SerializedScholarship, key: string): boolean {
  if (key === "all") return true;
  if (key === "partial") return s.fundingType === "partial" || s.fundingType === "stipend";
  return s.fundingType === key;
}

// ── Component ──────────────────────────────────────────────────────────────

interface BoursesFiltersProps {
  scholarships: SerializedScholarship[];
  lang: ContentLanguage;
}

export function BoursesFilters({ scholarships, lang }: BoursesFiltersProps) {
  const fr = lang === "fr";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Local UI state ──────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Hydrate saved IDs from localStorage (client-only)
  useEffect(() => {
    setSavedIds(getSavedIds());
  }, []);

  const handleToggleSave = useCallback((id: string) => {
    const next = toggleSaved(id);
    setSavedIds(new Set(next));
  }, []);

  // ── URL-driven filter state ─────────────────────────────────────────────
  const fundingFilter = searchParams.get("funding") ?? "all";
  const levelFilter = searchParams.get("level") ?? "all";
  const countryFilter = searchParams.get("country") ?? "all";
  const eligibilityFilter = searchParams.get("eligibility") ?? "all";
  const typeFilter = searchParams.get("type") ?? "all";
  const sortMode: SortMode = (["deadline", "latest", "relevance"].includes(searchParams.get("sort") ?? "")
    ? searchParams.get("sort") as SortMode
    : "deadline");

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all" || value === "deadline") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      if (lang !== "fr" && !params.has("lang")) params.set("lang", lang);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, pathname, router, lang],
  );

  const clearAll = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    FILTER_PARAM_KEYS.forEach((k) => params.delete(k));
    if (lang !== "fr") params.set("lang", lang);
    setSearchQuery("");
    setShowSavedOnly(false);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }, [lang, pathname, router, searchParams]);

  // ── Derived data ────────────────────────────────────────────────────────
  const availableCountries = useMemo(() => {
    const s = new Set(scholarships.map((sc) => sc.country));
    return Array.from(s).sort();
  }, [scholarships]);

  const availableLevels = useMemo(() => {
    const s = new Set(scholarships.flatMap((sc) => sc.level));
    return Array.from(s).sort();
  }, [scholarships]);

  const filtered = useMemo(() => {
    let items = scholarships.filter((s) => {
      if (!fundingFilterMatch(s, fundingFilter)) return false;
      if (levelFilter !== "all" && !s.level.includes(levelFilter as AcademicLevel)) return false;
      if (countryFilter !== "all" && s.country !== countryFilter) return false;
      if (eligibilityFilter !== "all") {
        const elig = s.haitianEligibility ?? "unknown";
        if (eligibilityFilter === "yes" && elig !== "yes") return false;
        if (eligibilityFilter === "unknown" && elig !== "unknown") return false;
      }
      if (typeFilter !== "all") {
        const kind = s.kind ?? "program";
        if (typeFilter !== kind) return false;
      }
      return true;
    });

    // Client-side text search
    if (searchQuery.trim()) {
      items = items.filter((s) => matchesSearch(s, searchQuery));
    }

    // Saved-only filter
    if (showSavedOnly) {
      items = items.filter((s) => savedIds.has(s.id));
    }

    // Sort
    items = [...items].sort((a, b) => {
      if (sortMode === "deadline") {
        const aISO = a.deadline?.dateISO ?? "";
        const bISO = b.deadline?.dateISO ?? "";
        const aDays = aISO ? daysUntil(aISO) : 9999;
        const bDays = bISO ? daysUntil(bISO) : 9999;
        const aClosing = aDays >= 0 && aDays <= 30 ? 0 : 1;
        const bClosing = bDays >= 0 && bDays <= 30 ? 0 : 1;
        if (aClosing !== bClosing) return aClosing - bClosing;
        if (aISO && bISO) return aISO.localeCompare(bISO);
        if (aISO) return -1;
        if (bISO) return 1;
        return (b.verifiedAtISO ?? "").localeCompare(a.verifiedAtISO ?? "");
      }
      if (sortMode === "latest") {
        return (b.verifiedAtISO ?? "").localeCompare(a.verifiedAtISO ?? "");
      }
      const kindOrder: Record<string, number> = { program: 0, directory: 1 };
      const fundingOrder: Record<string, number> = { full: 0, partial: 1, stipend: 2, "tuition-only": 3, unknown: 4 };
      const aKind = kindOrder[a.kind ?? "program"] ?? 0;
      const bKind = kindOrder[b.kind ?? "program"] ?? 0;
      if (aKind !== bKind) return aKind - bKind;
      return (fundingOrder[a.fundingType] ?? 4) - (fundingOrder[b.fundingType] ?? 4);
    });

    return items;
  }, [scholarships, fundingFilter, levelFilter, countryFilter, eligibilityFilter, typeFilter, sortMode, searchQuery, showSavedOnly, savedIds]);

  const activeFilterCount = useMemo(() => {
    return [
      fundingFilter !== "all",
      levelFilter !== "all",
      countryFilter !== "all",
      eligibilityFilter !== "all",
      typeFilter !== "all",
      sortMode !== "deadline",
      searchQuery.trim().length > 0,
      showSavedOnly,
    ].filter(Boolean).length;
  }, [fundingFilter, levelFilter, countryFilter, eligibilityFilter, typeFilter, sortMode, searchQuery, showSavedOnly]);

  const savedCount = savedIds.size;

  // ── Derived props for sub-components ─────────────────────────────────────

  /** Count of filters living inside the drawer (Type, Funding, Eligibility) */
  const drawerFilterCount = useMemo(
    () =>
      [typeFilter !== "all", fundingFilter !== "all", eligibilityFilter !== "all"].filter(Boolean)
        .length,
    [typeFilter, fundingFilter, eligibilityFilter],
  );

  /** Select-friendly options for the Pays dropdown */
  const countryOptions = useMemo(
    () =>
      availableCountries.map((c) => {
        const cl = COUNTRY_LABELS[c as DatasetCountry];
        return { value: c, label: cl ? `${cl.code} · ${fr ? cl.fr : cl.ht}` : c };
      }),
    [availableCountries, fr],
  );

  /** Select-friendly options for the Niveau dropdown */
  const levelOptions = useMemo(
    () =>
      availableLevels.map((l) => {
        const ll = LEVEL_LABELS[l as AcademicLevel];
        return { value: l, label: ll ? (fr ? ll.fr : ll.ht) : l };
      }),
    [availableLevels, fr],
  );

  /** Active-filter chips (visible under the compact row) */
  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const out: ActiveFilter[] = [];
    if (countryFilter !== "all") {
      const cl = COUNTRY_LABELS[countryFilter as DatasetCountry];
      out.push({ key: "country", label: `${fr ? "Pays" : "Peyi"}: ${cl ? (fr ? cl.fr : cl.ht) : countryFilter}` });
    }
    if (levelFilter !== "all") {
      const ll = LEVEL_LABELS[levelFilter as AcademicLevel];
      out.push({ key: "level", label: `${fr ? "Niveau" : "Nivo"}: ${ll ? (fr ? ll.fr : ll.ht) : levelFilter}` });
    }
    if (fundingFilter !== "all") {
      const fl = FUNDING_FILTER_CHIPS.find((c) => c.key === fundingFilter);
      out.push({ key: "funding", label: `${fr ? "Financement" : "Finansman"}: ${fl ? (fr ? fl.fr : fl.ht) : fundingFilter}` });
    }
    if (typeFilter !== "all") {
      const tl = TYPE_FILTER_CHIPS.find((c) => c.key === typeFilter);
      out.push({ key: "type", label: `Type: ${tl ? (fr ? tl.fr : tl.ht) : typeFilter}` });
    }
    if (eligibilityFilter !== "all") {
      const el = ELIGIBILITY_FILTER_CHIPS.find((c) => c.key === eligibilityFilter);
      out.push({ key: "eligibility", label: `${fr ? "Haïti" : "Ayiti"}: ${el ? (fr ? el.fr : el.ht) : eligibilityFilter}` });
    }
    return out;
  }, [countryFilter, levelFilter, fundingFilter, typeFilter, eligibilityFilter, fr]);

  /** Filter groups for the drawer */
  const drawerGroups = useMemo<FilterGroup[]>(
    () => [
      {
        paramKey: "type",
        title: fr ? "Type" : "Tip",
        options: TYPE_FILTER_CHIPS.map((c) => ({ key: c.key, label: fr ? c.fr : c.ht })),
        activeValue: typeFilter,
      },
      {
        paramKey: "funding",
        title: fr ? "Financement" : "Finansman",
        options: FUNDING_FILTER_CHIPS.map((c) => ({ key: c.key, label: fr ? c.fr : c.ht })),
        activeValue: fundingFilter,
      },
      {
        paramKey: "eligibility",
        title: fr ? "Éligible Haïti" : "Elijib Ayiti",
        options: ELIGIBILITY_FILTER_CHIPS.map((c) => ({ key: c.key, label: fr ? c.fr : c.ht })),
        activeValue: eligibilityFilter,
      },
    ],
    [fr, typeFilter, fundingFilter, eligibilityFilter],
  );

  return (
    <div className="space-y-3" id="catalogue">
      {/* ── Compact filter row (sticky) ── */}
      <CompactFiltersRow
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        countryFilter={countryFilter}
        levelFilter={levelFilter}
        onFilterChange={setFilter}
        countryOptions={countryOptions}
        levelOptions={levelOptions}
        sortMode={sortMode}
        showSavedOnly={showSavedOnly}
        onToggleSaved={() => setShowSavedOnly((v) => !v)}
        savedCount={savedCount}
        onOpenDrawer={() => setFiltersOpen(true)}
        drawerFilterCount={drawerFilterCount}
        resultCount={filtered.length}
        totalCount={scholarships.length}
        fr={fr}
      />

      {/* ── Active filter chips ── */}
      <ActiveFilterChips
        filters={activeFilters}
        onRemove={(key) => setFilter(key, "all")}
        onClearAll={clearAll}
        fr={fr}
      />

      {/* ── Filters drawer (Type, Financement, Éligible Haïti) ── */}
      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groups={drawerGroups}
        onFilterChange={setFilter}
        onReset={clearAll}
        fr={fr}
      />

      {/* ── Card grid (full-width, no sidebar) ── */}
      <div>
        {/* Saved-only empty state */}
        {showSavedOnly && filtered.length === 0 && savedCount === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/30 py-16 text-center dark:border-blue-800/40 dark:bg-blue-950/10">
            <Heart className="mx-auto h-10 w-10 text-blue-300 dark:text-blue-600" />
            <p className="mt-3 text-sm font-medium text-stone-600 dark:text-stone-400">
              {fr
                ? "Vous n'avez pas encore sauvegardé de bourses."
                : "Ou poko anrejistre okenn bous."}
            </p>
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
              {fr
                ? 'Cliquez sur l\u2019icône \uD83D\uDD16 sur une bourse pour la suivre.'
                : 'Klike sou ikòn \uD83D\uDD16 sou yon bous pou swiv li.'}
            </p>
          </div>
        )}

        {/* No results for filters */}
        {!showSavedOnly && filtered.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white py-14 text-center text-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-500">
            <p className="text-base font-medium">
              {fr
                ? scholarships.length === 0
                  ? "Base de données en construction…"
                  : "Aucun résultat pour ces filtres."
                : scholarships.length === 0
                  ? "Baz done an konstriksyon…"
                  : "Pa gen rezilta pou filtr sa yo."}
            </p>
          </div>
        )}

        {showSavedOnly && filtered.length === 0 && savedCount > 0 && (
          <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white py-14 text-center text-stone-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-500">
            <p className="text-base font-medium">
              {fr
                ? "Aucune bourse sauvegardée ne correspond aux filtres actifs."
                : "Pa gen bous anrejistre ki koresponn ak filtè aktif yo."}
            </p>
          </div>
        )}

        {/* Cards */}
        {filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s) => (
              <ScholarshipCard
                key={s.id}
                scholarship={s}
                lang={lang}
                saved={savedIds.has(s.id)}
                onToggleSave={handleToggleSave}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
