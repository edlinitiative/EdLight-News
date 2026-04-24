"use client";

/**
 * BoursesEditorial — Client orchestrator for the /bourses page.
 *
 * Single unified browse layout (no more Feed↔Catalogue toggle):
 *   1) BoursesSearchBar — search + Region + Level + Refine drawer
 *   2) Quick chip row — Type / Funding / Eligibility / Saved
 *   3) ActiveFilterChips — removable summary
 *   4) FeaturedBourses — 2 promo cards (only when no filters & ≥2 items)
 *   5) Toolbar — result count + sort menu (always visible)
 *   6) ScholarshipCard grid (left 8 cols) + Sidebar (right 4 cols)
 *      with Load-More pagination instead of an Archive toggle
 *   7) FiltersDrawer — advanced filter slide-out
 *
 * All filter state is URL-driven for shareable links and presets.
 */

import { useMemo, useCallback, useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type {
  ContentLanguage,
  DatasetCountry,
  AcademicLevel,
} from "@edlight-news/types";
import { Plus, Bookmark } from "lucide-react";
import { FILTER_PARAM_KEYS } from "@/lib/scholarship-params";
import { getSavedIds, toggleSaved, matchesSearch } from "@/lib/bourses-ui";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { parseISODateSafe, daysUntil as daysUntilFromDate } from "@/lib/deadlines";

import { BoursesSearchBar } from "@/components/bourses/BoursesSearchBar";
import { FeaturedBourses } from "@/components/bourses/FeaturedBourses";
import { BoursesSidebar } from "@/components/bourses/BoursesSidebar";
import { ScholarshipCard } from "@/components/bourses/ScholarshipCard";
import { ActiveFilterChips } from "@/app/bourses/_components/ActiveFilterChips";
import { FiltersDrawer } from "@/app/bourses/_components/FiltersDrawer";
import { SortMenuPill } from "@/app/bourses/_components/SortMenuPill";
import type { FilterGroup } from "@/app/bourses/_components/FiltersDrawer";
import type { ActiveFilter } from "@/app/bourses/_components/ActiveFilterChips";

const PAGE_SIZE = 12;

// ── Labels ──────────────────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysUntil(dateISO: string): number {
  const date = parseISODateSafe(dateISO);
  return date ? daysUntilFromDate(date) : 9999;
}

function fundingFilterMatch(s: SerializedScholarship, key: string): boolean {
  if (key === "all") return true;
  if (key === "partial") return s.fundingType === "partial" || s.fundingType === "stipend";
  return s.fundingType === key;
}

// ── Component ───────────────────────────────────────────────────────────────

interface BoursesEditorialProps {
  scholarships: SerializedScholarship[];
  lang: ContentLanguage;
}

export function BoursesEditorial({ scholarships, lang }: BoursesEditorialProps) {
  const fr = lang === "fr";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Local UI state ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSavedIds(getSavedIds());
  }, []);

  const handleToggleSave = useCallback((id: string) => {
    const next = toggleSaved(id);
    setSavedIds(new Set(next));
  }, []);

  // ── URL-driven filter state ───────────────────────────────────────────────
  const fundingFilter = searchParams.get("funding") ?? "all";
  const levelFilter = searchParams.get("level") ?? "all";
  const countryFilter = searchParams.get("country") ?? "all";
  const eligibilityFilter = searchParams.get("eligibility") ?? "all";
  const typeFilter = searchParams.get("type") ?? "all";
  const savedOnly = searchParams.get("saved") === "1";
  const sortMode: SortMode = (
    ["deadline", "latest", "relevance"].includes(searchParams.get("sort") ?? "")
      ? (searchParams.get("sort") as SortMode)
      : "deadline"
  );

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
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }, [lang, pathname, router, searchParams]);

  // ── Derived data ──────────────────────────────────────────────────────────
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
      if (savedOnly && !savedIds.has(s.id)) return false;
      return true;
    });

    if (searchQuery.trim()) {
      items = items.filter((s) => matchesSearch(s, searchQuery));
    }

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
  }, [scholarships, fundingFilter, levelFilter, countryFilter, eligibilityFilter, typeFilter, sortMode, searchQuery, savedOnly, savedIds]);

  const hasFilters = useMemo(() => {
    return (
      fundingFilter !== "all" ||
      levelFilter !== "all" ||
      countryFilter !== "all" ||
      eligibilityFilter !== "all" ||
      typeFilter !== "all" ||
      savedOnly ||
      searchQuery.trim().length > 0
    );
  }, [fundingFilter, levelFilter, countryFilter, eligibilityFilter, typeFilter, savedOnly, searchQuery]);

  // Reset pagination whenever filter signature or sort changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [fundingFilter, levelFilter, countryFilter, eligibilityFilter, typeFilter, savedOnly, searchQuery, sortMode]);

  // ── Derived props for sub-components ──────────────────────────────────────

  const drawerFilterCount = useMemo(
    () => [typeFilter !== "all", fundingFilter !== "all", eligibilityFilter !== "all"].filter(Boolean).length,
    [typeFilter, fundingFilter, eligibilityFilter],
  );

  const countryOptions = useMemo(
    () =>
      availableCountries.map((c) => {
        const cl = COUNTRY_LABELS[c as DatasetCountry];
        return { value: c, label: cl ? `${cl.code} · ${fr ? cl.fr : cl.ht}` : c };
      }),
    [availableCountries, fr],
  );

  const levelOptions = useMemo(
    () =>
      availableLevels.map((l) => {
        const ll = LEVEL_LABELS[l as AcademicLevel];
        return { value: l, label: ll ? (fr ? ll.fr : ll.ht) : l };
      }),
    [availableLevels, fr],
  );

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

  // Handle tag clicks from sidebar
  const handleTagClick = useCallback((tag: string) => {
    setSearchQuery(tag);
  }, []);

  // ── Pagination ────────────────────────────────────────────────────────────
  const visible = filtered.slice(0, visibleCount);
  const remaining = Math.max(0, filtered.length - visible.length);

  // ── Quick filter chip row helpers ─────────────────────────────────────────
  const QuickChip = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-[#3525cd] text-white dark:bg-[#4f46e5]"
          : "bg-[#f9f2f0] text-[#464555] hover:bg-[#e8e1df] dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
      }`}
    >
      {children}
    </button>
  );

  const savedCount = savedIds.size;

  return (
    <div className="space-y-10">
      {/* ── Search & Filter Bar ── */}
      <section className="space-y-3">
        <BoursesSearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          countryFilter={countryFilter}
          levelFilter={levelFilter}
          onFilterChange={setFilter}
          countryOptions={countryOptions}
          levelOptions={levelOptions}
          onOpenDrawer={() => setFiltersOpen(true)}
          drawerFilterCount={drawerFilterCount}
          fr={fr}
        />

        {/* Quick chip row — surfaces the most-used filters one click away */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type */}
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#474948] dark:text-stone-500 mr-1">
            {fr ? "Type" : "Tip"}
          </span>
          {TYPE_FILTER_CHIPS.map((c) => (
            <QuickChip
              key={`t-${c.key}`}
              active={typeFilter === c.key}
              onClick={() => setFilter("type", c.key)}
            >
              {fr ? c.fr : c.ht}
            </QuickChip>
          ))}

          <span className="mx-1 h-4 w-px bg-[#c7c4d8]/40 dark:bg-stone-700" />

          {/* Funding (compact: skip "all" — first chip is implicit) */}
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#474948] dark:text-stone-500 mr-1">
            {fr ? "Financement" : "Finansman"}
          </span>
          {FUNDING_FILTER_CHIPS.filter((c) => c.key !== "unknown").map((c) => (
            <QuickChip
              key={`f-${c.key}`}
              active={fundingFilter === c.key}
              onClick={() => setFilter("funding", c.key)}
            >
              {fr ? c.fr : c.ht}
            </QuickChip>
          ))}

          <span className="mx-1 h-4 w-px bg-[#c7c4d8]/40 dark:bg-stone-700" />

          {/* Eligibility (single toggle: "Éligible HT") */}
          <QuickChip
            active={eligibilityFilter === "yes"}
            onClick={() =>
              setFilter("eligibility", eligibilityFilter === "yes" ? "all" : "yes")
            }
          >
            ✓ {fr ? "Éligible Haïti" : "Elijib Ayiti"}
          </QuickChip>

          {/* Saved toggle */}
          {savedCount > 0 && (
            <QuickChip
              active={savedOnly}
              onClick={() => setFilter("saved", savedOnly ? "all" : "1")}
            >
              <span className="inline-flex items-center gap-1">
                <Bookmark className={`h-3 w-3 ${savedOnly ? "fill-current" : ""}`} />
                {fr ? "Sauvegardés" : "Anrejistre"} ({savedCount})
              </span>
            </QuickChip>
          )}
        </div>

        <ActiveFilterChips
          filters={activeFilters}
          onRemove={(key) => setFilter(key, "all")}
          onClearAll={clearAll}
          fr={fr}
        />
      </section>

      {/* ── Featured Bourses (only on the unfiltered home view) ── */}
      {!hasFilters && filtered.length >= 2 && (
        <FeaturedBourses
          scholarships={filtered}
          lang={lang}
          savedIds={savedIds}
          onToggleSave={handleToggleSave}
        />
      )}

      {/* ── Always-visible toolbar: result count + sort ── */}
      <section id="catalogue">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-baseline gap-2">
            <h3 className="font-display text-xl font-bold tracking-tight text-[#1d1b1a] dark:text-white">
              {hasFilters
                ? (fr ? "Résultats" : "Rezilta")
                : (fr ? "Toutes les bourses" : "Tout bous yo")}
            </h3>
            <span className="text-xs tabular-nums text-[#474948] dark:text-stone-400">
              <span className="font-bold text-[#1d1b1a] dark:text-white">{filtered.length}</span>
              <span className="text-[#c7c4d8] dark:text-stone-600 mx-0.5">/</span>
              {scholarships.length}
            </span>
          </div>
          <SortMenuPill
            sortMode={sortMode}
            onSort={(m) => setFilter("sort", m)}
            fr={fr}
          />
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#c7c4d8]/20 dark:border-stone-700 bg-white dark:bg-stone-900 py-14 text-center text-[#474948] dark:text-stone-500">
            <p className="text-base font-medium">
              {fr
                ? scholarships.length === 0
                  ? "Base de données en construction…"
                  : savedOnly
                    ? "Aucune bourse sauvegardée pour le moment."
                    : "Aucun résultat pour ces filtres."
                : scholarships.length === 0
                  ? "Baz done an konstriksyon…"
                  : savedOnly
                    ? "Pa gen okenn bous anrejistre."
                    : "Pa gen rezilta pou filtr sa yo."}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="mt-4 text-xs font-bold text-[#3525cd] hover:underline dark:text-[#c3c0ff]"
              >
                {fr ? "Réinitialiser les filtres" : "Reyinisyalize filtr yo"}
              </button>
            )}
          </div>
        )}

        {/* Grid + Sidebar */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
            <div className="lg:col-span-8 space-y-6">
              <div className="grid gap-5 sm:grid-cols-2">
                {visible.map((s) => (
                  <ScholarshipCard
                    key={s.id}
                    scholarship={s}
                    lang={lang}
                    saved={savedIds.has(s.id)}
                    onToggleSave={handleToggleSave}
                  />
                ))}
              </div>

              {/* Load more */}
              {remaining > 0 && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="w-full py-4 border-2 border-[#3525cd]/15 dark:border-[#c3c0ff]/15 rounded-xl text-[#3525cd] dark:text-[#c3c0ff] font-bold text-sm hover:bg-[#3525cd] hover:text-white dark:hover:bg-[#4f46e5] dark:hover:text-white transition-all duration-200 inline-flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {fr
                    ? `Voir plus (${Math.min(PAGE_SIZE, remaining)} sur ${remaining})`
                    : `Wè plis (${Math.min(PAGE_SIZE, remaining)} sou ${remaining})`}
                </button>
              )}
            </div>

            <aside className="lg:col-span-4">
              <div className="lg:sticky lg:top-24">
                <BoursesSidebar
                  scholarships={scholarships}
                  lang={lang}
                  onTagClick={handleTagClick}
                />
              </div>
            </aside>
          </div>
        )}
      </section>

      {/* ── Filters drawer ── */}
      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        groups={drawerGroups}
        onFilterChange={setFilter}
        onReset={clearAll}
        fr={fr}
      />
    </div>
  );
}
