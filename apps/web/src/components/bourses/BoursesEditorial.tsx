"use client";

/**
 * BoursesEditorial — the /bourses experience.
 *
 * Layout (indigo editorial system):
 *   1) Hero — eyebrow, title, search bar, and two "bento" stat tiles
 *   2) UrgentCarousel — "À ne pas manquer" deadline rail (when idle)
 *   3) Sidebar (filters + counts) beside a results area with a grid/list
 *      view toggle, quick-preview, compare tray, and load-more.
 */

import type { ContentLanguage, DatasetCountry, AcademicLevel } from "@edlight-news/types";
import type { ScholarshipFundingType, ScholarshipHaitianEligibility } from "@edlight-news/types";
import { useState, useCallback, useEffect, useMemo } from "react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { BoursesSearchBar } from "./BoursesSearchBar";
import { UrgentCarousel } from "./UrgentCarousel";
import { BoursesSidebar, type SidebarCounts } from "./BoursesSidebar";
import { ScholarshipGridCard } from "./ScholarshipGridCard";
import { ScholarshipRow } from "./ScholarshipRow";
import { QuickPreviewModal } from "./QuickPreviewModal";
import { CompareBar } from "./CompareBar";
import { LayoutGrid, List, Search, Sliders, Sparkles, X } from "lucide-react";

export interface BourseFilters {
  countries?: DatasetCountry[];
  levels?: AcademicLevel[];
  fundingTypes?: ScholarshipFundingType[];
  haitianEligibility?: ScholarshipHaitianEligibility | "all";
}

interface BoursesEditorialProps {
  scholarships: SerializedScholarship[];
  closingSoon: SerializedScholarship[];
  lang: ContentLanguage;
  stats: { total: number; eligible: number };
}

const PAGE_SIZE = 24;
const COMPARE_MAX = 4;

export function BoursesEditorial({ scholarships, closingSoon, lang, stats }: BoursesEditorialProps) {
  const fr = lang === "fr";

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<BourseFilters>({});
  const [saved, setSaved] = useState<string[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<SerializedScholarship | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Lock body scroll while the mobile filter drawer is open
  useEffect(() => {
    if (!mobileFiltersOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileFiltersOpen]);

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
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem("edlight-bourses-saved", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= COMPARE_MAX
          ? prev
          : [...prev, id],
    );
  }, []);

  // ── Filter options + counts ────────────────────────────────────────────────
  const countries = useMemo(
    () => Array.from(new Set(scholarships.map((s) => s.country))).sort() as DatasetCountry[],
    [scholarships],
  );
  const levels = useMemo(
    () => Array.from(new Set(scholarships.flatMap((s) => s.level))).sort() as AcademicLevel[],
    [scholarships],
  );

  const counts = useMemo<SidebarCounts>(() => {
    const levelsC: Partial<Record<AcademicLevel, number>> = {};
    const fundingC: Partial<Record<string, number>> = {};
    const countriesC: Partial<Record<string, number>> = {};
    let eligYes = 0;
    for (const s of scholarships) {
      for (const l of s.level) levelsC[l] = (levelsC[l] ?? 0) + 1;
      fundingC[s.fundingType] = (fundingC[s.fundingType] ?? 0) + 1;
      countriesC[s.country] = (countriesC[s.country] ?? 0) + 1;
      if ((s.haitianEligibility ?? "unknown") === "yes") eligYes++;
    }
    return {
      levels: levelsC,
      funding: fundingC,
      countries: countriesC,
      eligibility: { all: scholarships.length, yes: eligYes },
    };
  }, [scholarships]);

  // ── Apply filters ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return scholarships.filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          s.name.toLowerCase().includes(q) ||
          s.tags?.some((t) => t.toLowerCase().includes(q)) ||
          s.eligibilitySummary?.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if ((filters.countries?.length ?? 0) > 0 && !filters.countries!.includes(s.country)) return false;
      if ((filters.fundingTypes?.length ?? 0) > 0 && !filters.fundingTypes!.includes(s.fundingType)) return false;
      if ((filters.levels?.length ?? 0) > 0 && !s.level.some((l) => filters.levels!.includes(l))) return false;
      const he = filters.haitianEligibility ?? "all";
      if (he !== "all" && s.haitianEligibility !== he) return false;
      return true;
    });
  }, [scholarships, search, filters]);

  const activeCount =
    (filters.countries?.length ?? 0) +
    (filters.fundingTypes?.length ?? 0) +
    (filters.levels?.length ?? 0) +
    ((filters.haitianEligibility ?? "all") !== "all" ? 1 : 0);

  const hasActive = search.trim().length > 0 || activeCount > 0;

  // Reset pagination when the result set changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, filters, view]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const compareItems = useMemo(
    () => scholarships.filter((s) => compareIds.includes(s.id)),
    [scholarships, compareIds],
  );

  return (
    <div className="space-y-10">
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden rounded-3xl border border-[#f3ecea] bg-gradient-to-br from-[#f3f1ff] via-white to-[#f5f0ee] p-6 sm:p-9 dark:border-stone-800 dark:from-stone-900 dark:via-stone-900 dark:to-stone-950">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#3525cd]/10 blur-3xl dark:bg-[#c3c0ff]/10" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 lg:max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3525cd] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white dark:bg-[#c3c0ff] dark:text-[#1d1b1a]">
              {fr ? "Bourses" : "Bous"}
            </span>
            <h1 className="mt-3 font-display text-[30px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#1d1b1a] sm:text-[40px] dark:text-white">
              {fr ? "Trouvez votre opportunité." : "Jwenn opòtinite ou."}
            </h1>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-[#6b6563] sm:text-[15px] dark:text-stone-400">
              {fr
                ? "Une base curatée de bourses académiques et professionnelles, filtrables par pays, niveau, financement et éligibilité haïtienne."
                : "Yon baz kirye bous akademik ak pwofesyonèl, ou ka filtre selon peyi, nivo, finansman ak elijibilite ayisyen."}
            </p>
            <div className="mt-5 max-w-xl">
              <BoursesSearchBar value={search} onChange={setSearch} lang={lang} />
            </div>
          </div>

          {/* Bento stat tiles */}
          <div className="flex w-full shrink-0 flex-row gap-3 lg:w-64 lg:flex-col">
            <div className="flex flex-1 items-center justify-between rounded-2xl border border-[#f3ecea] bg-white/80 px-4 py-3.5 backdrop-blur dark:border-stone-800 dark:bg-stone-900/60">
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#6b6563] dark:text-stone-400">
                {fr ? "Bourses" : "Bous"}
              </span>
              <span className="font-display text-[22px] font-extrabold text-[#3525cd] dark:text-[#c3c0ff]">
                {stats.total}
              </span>
            </div>
            <div className="flex flex-1 items-center justify-between rounded-2xl border border-[#f3ecea] bg-white/80 px-4 py-3.5 backdrop-blur dark:border-stone-800 dark:bg-stone-900/60">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6b6563] dark:text-stone-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                {fr ? "Éligibles HT" : "Elijib HT"}
              </span>
              <span className="font-display text-[22px] font-extrabold text-[#3525cd] dark:text-[#c3c0ff]">
                {stats.eligible}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── À ne pas manquer ─── */}
      {!hasActive && closingSoon.length > 0 && (
        <UrgentCarousel scholarships={closingSoon.slice(0, 10)} lang={lang} saved={saved} onToggleSave={toggleSave} />
      )}

      {/* ─── Main: sidebar + results ─── */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Sidebar — desktop only; on mobile it lives in the slide-in drawer */}
        <div className="hidden md:block">
          <BoursesSidebar
            lang={lang}
            countries={countries}
            levels={levels}
            filters={filters}
            onFiltersChange={setFilters}
            counts={counts}
          />
        </div>

        {/* Results */}
        <div className="min-w-0">
          {/* Results header */}
          <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#f3ecea] pb-2.5 dark:border-stone-800">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-[18px] font-extrabold tracking-[-0.02em] text-[#1d1b1a] dark:text-white">
                {hasActive ? (fr ? "Résultats" : "Rezilta") : (fr ? "Toutes les bourses" : "Tout bous yo")}
              </h2>
              <div className="hidden items-center gap-1 rounded-lg bg-[#f5f0ee] p-0.5 sm:flex dark:bg-stone-800">
                <button
                  onClick={() => setView("grid")}
                  className={`rounded-md p-1.5 transition-colors ${view === "grid" ? "bg-white text-[#3525cd] shadow-sm dark:bg-stone-700 dark:text-[#c3c0ff]" : "text-[#6b6563] hover:text-[#3525cd] dark:text-stone-400"}`}
                  aria-label={fr ? "Vue grille" : "Vi kadriyaj"}
                  aria-pressed={view === "grid"}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`rounded-md p-1.5 transition-colors ${view === "list" ? "bg-white text-[#3525cd] shadow-sm dark:bg-stone-700 dark:text-[#c3c0ff]" : "text-[#6b6563] hover:text-[#3525cd] dark:text-stone-400"}`}
                  aria-label={fr ? "Vue liste" : "Vi lis"}
                  aria-pressed={view === "list"}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {compareIds.length > 0 && (
                <span className="hidden text-[12px] font-semibold text-[#3525cd] sm:inline dark:text-[#c3c0ff]">
                  {fr ? "Comparer" : "Konpare"} ({compareIds.length})
                </span>
              )}
              <span className="rounded-md bg-[#f5f0ee] px-2 py-1 text-[11px] font-semibold tabular-nums text-[#6b6563] dark:bg-stone-800 dark:text-stone-400">
                {filtered.length} {fr ? "résultats" : "rezilta"}
              </span>
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#464555] hover:text-[#3525cd] md:hidden dark:text-stone-300"
              >
                <Sliders className="h-3.5 w-3.5" />
                {fr ? "Filtres" : "Filt"}
                {activeCount > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#3525cd] px-1 text-[9px] font-extrabold text-white dark:bg-[#c3c0ff] dark:text-[#1d1b1a]">
                    {activeCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Empty state */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-[#f3ecea] bg-white px-4 py-16 text-center dark:border-stone-800 dark:bg-stone-900/95">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5f0ee] dark:bg-stone-800">
                <Search className="h-6 w-6 text-[#c7c4d8] dark:text-stone-500" />
              </div>
              <h3 className="mb-2 text-[16px] font-extrabold text-[#1d1b1a] dark:text-white">
                {fr ? "Aucune bourse trouvée" : "Pa gen bous ki jwenn"}
              </h3>
              <p className="max-w-xs text-sm leading-relaxed text-[#6b6563] dark:text-stone-400">
                {hasActive
                  ? fr
                    ? "Essayez d'ajuster vos filtres ou vos termes de recherche."
                    : "Eseye ajiste filt oswa tèm rechèch ou yo."
                  : fr
                    ? "Nous n'avons pas encore de bourses dans cette catégorie. Revenez bientôt !"
                    : "Nou poko gen bous nan kategori sa a. Tounen talè !"}
              </p>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((s) => (
                <ScholarshipGridCard
                  key={s.id}
                  scholarship={s}
                  lang={lang}
                  saved={saved.includes(s.id)}
                  onToggleSave={toggleSave}
                  onPreview={setPreview}
                  compared={compareIds.includes(s.id)}
                  onToggleCompare={toggleCompare}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#f3ecea] bg-white shadow-[0_1px_3px_rgba(29,27,26,0.04)] dark:border-stone-800 dark:bg-stone-900/95 dark:shadow-none">
              <div className="hidden grid-cols-[1.5rem_minmax(0,1fr)_7rem_9rem_6rem_3.5rem] items-center gap-x-4 border-b border-[#f3ecea] bg-[#faf7f5] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#a8a29e] sm:grid dark:border-stone-800 dark:bg-stone-900 dark:text-stone-600">
                <span aria-hidden="true" />
                <span>{fr ? "Bourse" : "Bous"}</span>
                <span>{fr ? "Financement" : "Finansman"}</span>
                <span>{fr ? "Niveau" : "Nivo"}</span>
                <span className="text-right">{fr ? "Date limite" : "Dat limit"}</span>
                <span aria-hidden="true" />
              </div>
              <div className="divide-y divide-[#f3ecea] dark:divide-stone-800">
                {visible.map((s) => (
                  <ScholarshipRow
                    key={s.id}
                    scholarship={s}
                    lang={lang}
                    saved={saved.includes(s.id)}
                    onToggleSave={toggleSave}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-6">
              <button
                onClick={() => setVisibleCount((p) => Math.min(p + PAGE_SIZE, filtered.length))}
                className="group inline-flex items-center gap-2 rounded-xl bg-[#3525cd] px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-[#3525cd]/20 transition-all hover:bg-[#2a1ea7] active:scale-[0.97] dark:bg-[#c3c0ff] dark:text-[#1d1b1a] dark:shadow-[#c3c0ff]/15 dark:hover:bg-[#a8a3ff]"
              >
                <Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" />
                {fr ? `Charger plus (${filtered.length - visibleCount})` : `Chaje plis (${filtered.length - visibleCount})`}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Mobile filter FAB (sits above the bottom nav; left side clears the back-to-top button) ─── */}
      <button
        type="button"
        onClick={() => setMobileFiltersOpen(true)}
        className={`fixed left-4 z-40 flex items-center gap-2 rounded-2xl bg-[#3525cd] px-4 py-3 text-sm font-extrabold text-white shadow-xl shadow-[#3525cd]/25 transition-transform active:scale-95 md:hidden dark:bg-[#c3c0ff] dark:text-[#1d1b1a] ${compareItems.length > 0 ? "bottom-[calc(9rem+env(safe-area-inset-bottom))]" : "bottom-[calc(5rem+env(safe-area-inset-bottom))]"}`}
        aria-label={fr ? "Filtrer" : "Filtre"}
      >
        <Sliders className="h-4 w-4" />
        {fr ? "Filtrer" : "Filtre"}
        {activeCount > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/25 px-1 text-[10px] dark:bg-[#1d1b1a]/25">
            {activeCount}
          </span>
        )}
      </button>

      {/* ─── Mobile filter drawer (z above the bottom nav so its apply button isn't covered) ─── */}
      <div
        className={`fixed inset-0 z-[60] md:hidden ${mobileFiltersOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!mobileFiltersOpen}
      >
        <div
          onClick={() => setMobileFiltersOpen(false)}
          className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${mobileFiltersOpen ? "opacity-100" : "opacity-0"}`}
        />
        <div
          className={`absolute inset-y-0 left-0 flex w-[86%] max-w-xs flex-col bg-[#faf7f5] shadow-2xl transition-transform duration-300 dark:bg-stone-950 ${mobileFiltersOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-between border-b border-[#f3ecea] px-4 py-3.5 dark:border-stone-800">
            <h2 className="flex items-center gap-2 font-display text-[15px] font-extrabold text-[#1d1b1a] dark:text-white">
              <Sliders className="h-4 w-4 text-[#3525cd] dark:text-[#c3c0ff]" />
              {fr ? "Filtres" : "Filt"}
            </h2>
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="rounded-lg p-1.5 text-[#6b6563] transition-colors hover:bg-[#f5f0ee] dark:text-stone-400 dark:hover:bg-stone-800"
              aria-label={fr ? "Fermer" : "Fèmen"}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <BoursesSidebar
              bare
              lang={lang}
              countries={countries}
              levels={levels}
              filters={filters}
              onFiltersChange={setFilters}
              counts={counts}
            />
          </div>
          <div className="border-t border-[#f3ecea] p-3 dark:border-stone-800">
            <button
              onClick={() => setMobileFiltersOpen(false)}
              className="w-full rounded-xl bg-[#3525cd] px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#2a1ea7] dark:bg-[#c3c0ff] dark:text-[#1d1b1a] dark:hover:bg-[#a8a3ff]"
            >
              {fr ? `Voir ${filtered.length} résultats` : `Wè ${filtered.length} rezilta`}
            </button>
          </div>
        </div>
      </div>

      {/* Quick preview */}
      <QuickPreviewModal
        scholarship={preview}
        lang={lang}
        saved={preview ? saved.includes(preview.id) : false}
        onToggleSave={toggleSave}
        onClose={() => setPreview(null)}
      />

      {/* Compare tray + modal */}
      <CompareBar
        items={compareItems}
        lang={lang}
        onRemove={(id) => setCompareIds((prev) => prev.filter((x) => x !== id))}
        onClear={() => setCompareIds([])}
      />
    </div>
  );
}
