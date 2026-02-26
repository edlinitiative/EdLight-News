"use client";

/**
 * BoursesFilters — Client component for /bourses page.
 *
 * Provides filter chips (Funding, Level, Country, Eligibility, Type),
 * sort controls, and renders scholarship cards with badges.
 *
 * All filter state is URL-driven via search params so external links
 * (e.g. the StartHere block) can pre-set filters.
 */

import { useMemo, useCallback, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { ContentLanguage, DatasetCountry, AcademicLevel, ScholarshipFundingType, ScholarshipKind, ScholarshipHaitianEligibility, ScholarshipDeadlineAccuracy } from "@edlight-news/types";
import { CalendarDays, BookOpen, CheckCircle, Paperclip, HelpCircle, FolderOpen, ExternalLink, ArrowUpDown, ChevronDown } from "lucide-react";
import { MetaBadges } from "@/components/MetaBadges";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import { FILTER_PARAM_KEYS } from "@/lib/scholarship-params";

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

const FUNDING_LABELS: Record<string, { fr: string; ht: string; color: string }> = {
  full:          { fr: "Complet",    ht: "Konplè",        color: "bg-green-100 text-green-800" },
  partial:       { fr: "Partiel",    ht: "Pasyèl",        color: "bg-yellow-100 text-yellow-800" },
  stipend:       { fr: "Partiel",    ht: "Pasyèl",        color: "bg-yellow-100 text-yellow-800" },
  "tuition-only":{ fr: "Scolarité",  ht: "Frè etid sèlman", color: "bg-purple-100 text-purple-800" },
  unknown:       { fr: "Inconnu",    ht: "Enkonni",       color: "bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300" },
};

const LEVEL_LABELS: Record<AcademicLevel, { fr: string; ht: string }> = {
  bachelor:       { fr: "Bachelor",         ht: "Lisans" },
  master:         { fr: "Master",           ht: "Metriz" },
  phd:            { fr: "PhD",              ht: "Doktora" },
  short_programs: { fr: "Courts programmes", ht: "Pwogram kout" },
};

const COUNTRY_LABELS: Record<DatasetCountry, { fr: string; ht: string; code: string }> = {
  US: { fr: "États-Unis", ht: "Etazini", code: "US" },
  CA: { fr: "Canada",     ht: "Kanada",  code: "CA" },
  FR: { fr: "France",     ht: "Frans",   code: "FR" },
  UK: { fr: "Royaume-Uni",ht: "Wayòm Ini", code: "UK" },
  DO: { fr: "Rép. Dominicaine", ht: "Rep. Dominikèn", code: "DO" },
  MX: { fr: "Mexique",    ht: "Meksik",  code: "MX" },
  CN: { fr: "Chine",      ht: "Lachin",  code: "CN" },
  RU: { fr: "Russie",     ht: "Larisi",  code: "RU" },
  HT: { fr: "Haïti",      ht: "Ayiti",   code: "HT" },
  Global: { fr: "International", ht: "Entènasyonal", code: "GL" },
};

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
  { key: "unknown", fr: "À confirmer",  ht: "Pou konfime" },
];

const TYPE_FILTER_CHIPS: { key: string; fr: string; ht: string }[] = [
  { key: "all",       fr: "Tous",        ht: "Tout" },
  { key: "program",   fr: "Programmes",  ht: "Pwogram" },
  { key: "directory",  fr: "Répertoires", ht: "Repètwa" },
];

type SortMode = "deadline" | "latest" | "relevance";

const SORT_LABELS: Record<SortMode, { fr: string; ht: string }> = {
  deadline:  { fr: "Deadline proche", ht: "Dat limit pi pre" },
  latest:    { fr: "Dernières",       ht: "Dènye yo" },
  relevance: { fr: "Pertinence",      ht: "Pètinans" },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string, lang: ContentLanguage): string {
  try {
    return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "fr-HT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const MONTH_NAMES_FR = [
  "", "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function deadlineLabel(s: SerializedScholarship, lang: ContentLanguage): string | null {
  const fr = lang === "fr";
  const accuracy = s.deadlineAccuracy ?? (s.deadline?.dateISO ? "exact" : "unknown");

  switch (accuracy) {
    case "exact":
      if (s.deadline?.dateISO) return `${fr ? "Date limite:" : "Dat limit:"} ${formatDate(s.deadline.dateISO, lang)}`;
      return fr ? "À confirmer" : "Pou konfime";
    case "month-only": {
      const m = s.deadline?.month;
      if (m && m >= 1 && m <= 12) {
        const monthName = MONTH_NAMES_FR[m];
        return fr ? `Fin ${monthName} (à confirmer)` : `Fen ${monthName} (pou konfime)`;
      }
      return s.deadline?.notes ?? (fr ? "À confirmer" : "Pou konfime");
    }
    case "varies":
      return fr ? "Délais variables (voir source)" : "Dat limit varyab (wè sous)";
    case "unknown":
    default:
      return fr ? "À confirmer" : "Pou konfime";
  }
}

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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ── Read filter state from URL ──────────────────────────────────────────
  const fundingFilter = searchParams.get("funding") ?? "all";
  const levelFilter = searchParams.get("level") ?? "all";
  const countryFilter = searchParams.get("country") ?? "all";
  const eligibilityFilter = searchParams.get("eligibility") ?? "all";
  const typeFilter = searchParams.get("type") ?? "all";
  const sortMode: SortMode = (["deadline", "latest", "relevance"].includes(searchParams.get("sort") ?? "")
    ? searchParams.get("sort") as SortMode
    : "deadline");

  /** Push a filter change into the URL (replaces current entry). */
  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all" || value === "deadline") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      // Preserve lang param
      if (lang !== "fr" && !params.has("lang")) params.set("lang", lang);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, pathname, router, lang],
  );

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    FILTER_PARAM_KEYS.forEach((k) => params.delete(k));
    if (lang !== "fr") params.set("lang", lang);
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
  }, [lang, pathname, router, searchParams]);

  // Compute available countries
  const availableCountries = useMemo(() => {
    const s = new Set(scholarships.map((sc) => sc.country));
    return Array.from(s).sort();
  }, [scholarships]);

  // Compute available levels
  const availableLevels = useMemo(() => {
    const s = new Set(scholarships.flatMap((sc) => sc.level));
    return Array.from(s).sort();
  }, [scholarships]);

  // Filter & sort
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

    // Sort
    items = [...items].sort((a, b) => {
      if (sortMode === "deadline") {
        const aISO = a.deadline?.dateISO ?? "";
        const bISO = b.deadline?.dateISO ?? "";
        const aDays = aISO ? daysUntil(aISO) : 9999;
        const bDays = bISO ? daysUntil(bISO) : 9999;
        // Put closing-soon (within 30 days, future) first
        const aClosing = aDays >= 0 && aDays <= 30 ? 0 : 1;
        const bClosing = bDays >= 0 && bDays <= 30 ? 0 : 1;
        if (aClosing !== bClosing) return aClosing - bClosing;
        // Then sort by soonest
        if (aISO && bISO) return aISO.localeCompare(bISO);
        if (aISO) return -1;
        if (bISO) return 1;
        // Fallback: verifiedAt desc
        return (b.verifiedAtISO ?? "").localeCompare(a.verifiedAtISO ?? "");
      }
      if (sortMode === "latest") {
        return (b.verifiedAtISO ?? "").localeCompare(a.verifiedAtISO ?? "");
      }
      // relevance: programs before directories, then full funding first
      const kindOrder = { program: 0, directory: 1 };
      const fundingOrder: Record<string, number> = { full: 0, partial: 1, stipend: 2, "tuition-only": 3, unknown: 4 };
      const aKind = kindOrder[a.kind ?? "program"] ?? 0;
      const bKind = kindOrder[b.kind ?? "program"] ?? 0;
      if (aKind !== bKind) return aKind - bKind;
      return (fundingOrder[a.fundingType] ?? 4) - (fundingOrder[b.fundingType] ?? 4);
    });

    return items;
  }, [scholarships, fundingFilter, levelFilter, countryFilter, eligibilityFilter, typeFilter, sortMode]);

  const activeFilterCount = useMemo(() => {
    return [
      fundingFilter !== "all",
      levelFilter !== "all",
      countryFilter !== "all",
      eligibilityFilter !== "all",
      typeFilter !== "all",
      sortMode !== "deadline",
    ].filter(Boolean).length;
  }, [fundingFilter, levelFilter, countryFilter, eligibilityFilter, typeFilter, sortMode]);

  // Chip component
  const Chip = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
        active
          ? "bg-brand-600 text-white shadow-sm ring-2 ring-brand-100 dark:ring-brand-500/20"
          : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </button>
  );

  const FilterGroups = ({ compact = false }: { compact?: boolean }) => (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div>
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
          {fr ? "Type" : "Tip"}
        </span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {TYPE_FILTER_CHIPS.map((c) => (
            <Chip
              key={c.key}
              active={typeFilter === c.key}
              onClick={() => setFilter("type", c.key)}
              label={fr ? c.fr : c.ht}
            />
          ))}
        </div>
      </div>

      <div>
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
          {fr ? "Financement" : "Finansman"}
        </span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {FUNDING_FILTER_CHIPS.map((c) => (
            <Chip
              key={c.key}
              active={fundingFilter === c.key}
              onClick={() => setFilter("funding", c.key)}
              label={fr ? c.fr : c.ht}
            />
          ))}
        </div>
      </div>

      <div>
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
          {fr ? "Niveau" : "Nivo"}
        </span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Chip
            active={levelFilter === "all"}
            onClick={() => setFilter("level", "all")}
            label={fr ? "Tous" : "Tout"}
          />
          {availableLevels.map((l) => {
            const lbl = LEVEL_LABELS[l as AcademicLevel];
            return (
              <Chip
                key={l}
                active={levelFilter === l}
                onClick={() => setFilter("level", l)}
                label={lbl ? (fr ? lbl.fr : lbl.ht) : l}
              />
            );
          })}
        </div>
      </div>

      <div>
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
          {fr ? "Pays" : "Peyi"}
        </span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Chip
            active={countryFilter === "all"}
            onClick={() => setFilter("country", "all")}
            label={fr ? "Tous" : "Tout"}
          />
          {availableCountries.map((c) => {
            const cl = COUNTRY_LABELS[c as DatasetCountry];
            return (
              <Chip
                key={c}
                active={countryFilter === c}
                onClick={() => setFilter("country", c)}
                label={cl ? `${cl.code} · ${fr ? cl.fr : cl.ht}` : c}
              />
            );
          })}
        </div>
      </div>

      <div>
        <span className="mr-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">
          {fr ? "Éligible Haïti" : "Elijib Ayiti"}
        </span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {ELIGIBILITY_FILTER_CHIPS.map((c) => (
            <Chip
              key={c.key}
              active={eligibilityFilter === c.key}
              onClick={() => setFilter("eligibility", c.key)}
              label={fr ? c.fr : c.ht}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="sticky top-16 z-20 rounded-3xl border border-gray-200/80 bg-white/95 p-3.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">
              {fr ? "Bourses" : "Bous"}
            </p>
            <p className="text-sm text-gray-700 dark:text-slate-200">
              <span className="font-semibold text-gray-900 dark:text-white">{filtered.length}</span>{" "}
              {fr ? "résultat(s)" : "rezilta"}
              <span className="ml-2 text-xs text-gray-400 dark:text-slate-500">
                {fr ? `${scholarships.length} au total` : `${scholarships.length} an total`}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-brand-200 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {fr ? "Réinitialiser" : "Reyinisyalize"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2.5 dark:border-slate-800">
          <ArrowUpDown className="h-4 w-4 text-gray-400 dark:text-slate-500" />
          <span className="text-xs font-medium text-gray-400 dark:text-slate-500">{fr ? "Trier:" : "Triye:"}</span>
          {(["deadline", "latest", "relevance"] as SortMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter("sort", mode)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                sortMode === mode
                  ? "bg-brand-50 text-brand-700 ring-1 ring-brand-100 dark:bg-brand-900/20 dark:text-brand-300 dark:ring-brand-500/20"
                  : "text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {fr ? SORT_LABELS[mode].fr : SORT_LABELS[mode].ht}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[260px,minmax(0,1fr)] xl:grid-cols-[300px,minmax(0,1fr)]">
        <aside>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 md:sticky md:top-36 xl:top-28 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-slate-500">
                  {fr ? "Filtres intelligents" : "Filtè entèlijan"}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {fr ? "URL partageable" : "URL patajab"}
                </p>
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:border-brand-200 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {fr ? "Reset" : "Reset"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileSidebarOpen((v) => !v)}
              className="mb-2 inline-flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 md:hidden"
              aria-expanded={mobileSidebarOpen}
            >
              <span className="inline-flex items-center gap-1.5">
                {fr ? "Afficher les filtres" : "Montre filtè yo"}
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">
                    {activeFilterCount}
                  </span>
                )}
              </span>
              <ChevronDown className={`h-4 w-4 transition ${mobileSidebarOpen ? "rotate-180" : ""}`} />
            </button>

            <div className={mobileSidebarOpen ? "block md:block" : "hidden md:block"}>
              <FilterGroups />
            </div>
          </div>
        </aside>

        <div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => {
          const funding = FUNDING_LABELS[s.fundingType];
          const cl = COUNTRY_LABELS[s.country];
          const isDirectory = s.kind === "directory";
          const dlLabel = deadlineLabel(s, lang);
          const elig = s.haitianEligibility ?? "unknown";

          return (
            <div
              key={s.id}
              className={`flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-900 ${
                isDirectory ? "border-l-4 border-l-indigo-300 dark:border-l-indigo-600" : ""
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between">
                <h3 className="pr-2 text-[15px] font-semibold leading-snug text-gray-900 dark:text-white">{s.name}</h3>
                {cl && (
                  <span
                    className="ml-2 inline-flex shrink-0 items-center rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    title={fr ? cl.fr : cl.ht}
                  >
                    {cl.code}
                  </span>
                )}
              </div>

              {/* Badges row */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {/* Funding badge */}
                {funding && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${funding.color}`}>
                    {fr ? funding.fr : funding.ht}
                  </span>
                )}

                {/* Eligibility badge */}
                {elig === "yes" && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-300">
                    <CheckCircle className="h-3 w-3" />
                    {fr ? "Haïti: Oui" : "Ayiti: Wi"}
                  </span>
                )}
                {elig === "unknown" && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/20 dark:text-brand-300">
                    <HelpCircle className="h-3 w-3" />
                    {fr ? "Haïti: À confirmer" : "Ayiti: Pou konfime"}
                  </span>
                )}

                {/* Directory badge */}
                {isDirectory && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                    <FolderOpen className="h-3 w-3" />
                    {fr ? "Répertoire" : "Repètwa"}
                  </span>
                )}
              </div>

              {/* Description */}
              {s.eligibilitySummary && (
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-gray-600 dark:text-slate-300">
                  {s.eligibilitySummary}
                </p>
              )}

              <div className="my-3 h-px bg-gray-100 dark:bg-slate-800" />

              {/* Levels */}
              {s.level.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  <BookOpen className="mr-1 inline h-3 w-3" />
                  {s.level.map((l) => {
                    const lbl = LEVEL_LABELS[l];
                    return lbl ? (fr ? lbl.fr : lbl.ht) : l;
                  }).join(", ")}
                </p>
              )}

              {/* Deadline display */}
              {dlLabel && (
                <p className="mt-1 text-xs font-medium text-brand-700 dark:text-brand-300">
                  <CalendarDays className="mr-1 inline h-3 w-3" /> {dlLabel}
                </p>
              )}
              {/* Urgency badge — only for exact deadlines */}
              {s.deadline?.dateISO && (s.deadlineAccuracy ?? "exact") === "exact" && (
                <div className="mt-1">
                  <DeadlineBadge
                    dateISO={s.deadline.dateISO}
                    windowDays={30}
                    lang={lang}
                  />
                </div>
              )}

              {/* Haitian-friendly (legacy: eligibleCountries) */}
              {!s.haitianEligibility && s.eligibleCountries?.includes("HT") && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle className="mr-0.5 inline h-3 w-3" /> {fr ? "Ouvert aux Haïtiens" : "Ouvè pou Ayisyen"}
                </p>
              )}

              {/* Tags */}
              {s.tags && s.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Action links */}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {isDirectory ? (
                  <a
                    href={s.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/40 dark:bg-indigo-900/20 dark:text-indigo-300 dark:hover:bg-indigo-900/30"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {fr ? "Consulter la source officielle" : "Wè sous ofisyèl la"}
                  </a>
                ) : (
                  <>
                    {s.howToApplyUrl && (
                      <a
                        href={s.howToApplyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-800/40 dark:bg-brand-900/20 dark:text-brand-300 dark:hover:bg-brand-900/30"
                      >
                        {fr ? "Postuler" : "Aplike"}
                      </a>
                    )}
                    {s.officialUrl && (
                      <a
                        href={s.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {fr ? "Site officiel" : "Sit ofisyèl"}
                      </a>
                    )}
                  </>
                )}
                {s.deadline?.sourceUrl && (
                  <a
                    href={s.deadline.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-600 hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:text-brand-400 dark:hover:bg-slate-800"
                  >
                    {fr ? "Source deadline" : "Sous dat limit"}
                  </a>
                )}
              </div>

              {/* Sources */}
              {s.sources.length > 0 && (
                <details className="mt-2 rounded-lg border border-gray-100 bg-gray-50/70 p-2 dark:border-slate-800 dark:bg-slate-800/40">
                  <summary className="cursor-pointer list-none text-[11px] font-medium text-gray-500 hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-300">
                    <span className="inline-flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      {fr ? "Sources" : "Sous"} ({s.sources.length})
                    </span>
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {s.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-brand-700 hover:underline dark:bg-slate-900 dark:text-slate-400 dark:hover:text-brand-300"
                      >
                        {src.label}
                      </a>
                    ))}
                  </div>
                </details>
              )}

              {/* Trust badges */}
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-2.5 dark:border-slate-800">
                <MetaBadges
                  verifiedAt={s.verifiedAtISO ?? null}
                  updatedAt={s.updatedAtISO ?? null}
                  lang={lang}
                />
                <ReportIssueButton itemId={s.id} lang={lang} />
              </div>
            </div>
          );
        })}
          </div>

          {filtered.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-14 text-center text-gray-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-500">
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
        </div>
      </div>
    </div>
  );
}
