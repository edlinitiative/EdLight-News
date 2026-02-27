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
import {
  ArrowUpDown,
  Search,
  X,
  SlidersHorizontal,
  Bookmark,
  Heart,
} from "lucide-react";
import { FILTER_PARAM_KEYS } from "@/lib/scholarship-params";
import { getSavedIds, toggleSaved, matchesSearch } from "@/lib/bourses-ui";
import { ScholarshipCard } from "@/components/bourses/ScholarshipCard";

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

  // ── Chip helper ─────────────────────────────────────────────────────────
  const Chip = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        active
          ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
          : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
      }`}
    >
      {label}
    </button>
  );

  // ── Filter groups (shared between desktop sidebar & mobile drawer) ──────
  const FilterGroups = () => (
    <div className="space-y-4">
      {/* Type */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
          {fr ? "Type" : "Tip"}
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {TYPE_FILTER_CHIPS.map((c) => (
            <Chip key={c.key} active={typeFilter === c.key} onClick={() => setFilter("type", c.key)} label={fr ? c.fr : c.ht} />
          ))}
        </div>
      </div>

      {/* Funding */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
          {fr ? "Financement" : "Finansman"}
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {FUNDING_FILTER_CHIPS.map((c) => (
            <Chip key={c.key} active={fundingFilter === c.key} onClick={() => setFilter("funding", c.key)} label={fr ? c.fr : c.ht} />
          ))}
        </div>
      </div>

      {/* Level */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
          {fr ? "Niveau" : "Nivo"}
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Chip active={levelFilter === "all"} onClick={() => setFilter("level", "all")} label={fr ? "Tous" : "Tout"} />
          {availableLevels.map((l) => {
            const lbl = LEVEL_LABELS[l as AcademicLevel];
            return <Chip key={l} active={levelFilter === l} onClick={() => setFilter("level", l)} label={lbl ? (fr ? lbl.fr : lbl.ht) : l} />;
          })}
        </div>
      </div>

      {/* Country */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
          {fr ? "Pays" : "Peyi"}
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Chip active={countryFilter === "all"} onClick={() => setFilter("country", "all")} label={fr ? "Tous" : "Tout"} />
          {availableCountries.map((c) => {
            const cl = COUNTRY_LABELS[c as DatasetCountry];
            return <Chip key={c} active={countryFilter === c} onClick={() => setFilter("country", c)} label={cl ? `${cl.code} · ${fr ? cl.fr : cl.ht}` : c} />;
          })}
        </div>
      </div>

      {/* Eligibility */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
          {fr ? "Éligible Haïti" : "Elijib Ayiti"}
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {ELIGIBILITY_FILTER_CHIPS.map((c) => (
            <Chip key={c.key} active={eligibilityFilter === c.key} onClick={() => setFilter("eligibility", c.key)} label={fr ? c.fr : c.ht} />
          ))}
        </div>
      </div>
    </div>
  );

  const savedCount = savedIds.size;

  return (
    <div className="space-y-5" id="catalogue">
      {/* ── Sticky search / sort bar ── */}
      <div className="sticky top-16 z-20 space-y-3 rounded-2xl border border-stone-200/80 bg-white/95 p-4 shadow-sm backdrop-blur-md dark:border-stone-700 dark:bg-stone-900/95">
        {/* Row 1: Search + quick actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={fr ? "Rechercher par nom, tags, description…" : "Chèche pa non, tag, deskripsyon…"}
              className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-9 text-sm text-stone-900 placeholder:text-stone-400 focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:placeholder:text-stone-500 dark:focus:border-blue-600 dark:focus:ring-blue-800/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Suivis toggle pill */}
          <button
            type="button"
            onClick={() => setShowSavedOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              showSavedOnly
                ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${showSavedOnly ? "fill-current" : ""}`} />
            {fr ? "Suivis" : "Swivi"}
            {savedCount > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                showSavedOnly ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
              }`}>
                {savedCount}
              </span>
            )}
          </button>

          {/* Mobile: toggle filters drawer */}
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 md:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {fr ? "Filtres" : "Filtè"}
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Reset */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {fr ? "Réinitialiser" : "Reyinisyalize"}
            </button>
          )}
        </div>

        {/* Row 2: Sort + count */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2.5 dark:border-stone-800">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            <span className="font-bold text-stone-900 dark:text-white">{filtered.length}</span>{" "}
            {fr ? "résultat(s)" : "rezilta"}
            <span className="ml-1.5 text-xs text-stone-400 dark:text-stone-500">
              / {scholarships.length}
            </span>
          </p>
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="h-3.5 w-3.5 text-stone-400" />
            {(["deadline", "latest", "relevance"] as SortMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFilter("sort", mode)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  sortMode === mode
                    ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                    : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
                }`}
              >
                {fr ? SORT_LABELS[mode].fr : SORT_LABELS[mode].ht}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Layout: sidebar filters + card grid ── */}
      <div className="grid gap-5 md:grid-cols-[240px,minmax(0,1fr)] xl:grid-cols-[280px,minmax(0,1fr)]">
        {/* Sidebar */}
        <aside>
          <div className={`rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-900/70 md:sticky md:top-44 md:max-h-[calc(100vh-12rem)] md:overflow-y-auto ${
            filtersOpen ? "block" : "hidden md:block"
          }`}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">
                {fr ? "Filtres" : "Filtè"}
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                Reset
              </button>
            </div>
            <FilterGroups />
          </div>
        </aside>

        {/* Card grid */}
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
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
    </div>
  );
}
