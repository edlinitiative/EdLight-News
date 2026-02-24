/**
 * HistoireArchive — Weekly / Monthly archive for /histoire.
 *
 * Default view: **Week** (Sunday→Saturday) showing 1 main fact + up to 2
 * secondary facts per day, with prev/next navigation arrows.
 * Alternate view: Month grid (12 buttons) with tag filter + timeline results.
 *
 * Lazy-loads almanac entries via /api/histoire/archive so the main page
 * load stays fast.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Star,
  Tag,
  Loader2,
  BookOpen,
} from "lucide-react";
import type {
  ContentLanguage,
  AlmanacTag,
  HaitiHistoryAlmanacEntry,
  HaitiHoliday,
} from "@edlight-news/types";

// ── Constants ────────────────────────────────────────────────────────────────

const TAG_LABELS: Record<AlmanacTag, { fr: string; ht: string; color: string }> = {
  independence:  { fr: "Indépendance",  ht: "Endepandans",  color: "bg-brand-100 text-brand-800" },
  culture:       { fr: "Culture",       ht: "Kilti",        color: "bg-purple-100 text-purple-800" },
  education:     { fr: "Éducation",     ht: "Edikasyon",    color: "bg-green-100 text-green-800" },
  politics:      { fr: "Politique",     ht: "Politik",      color: "bg-red-100 text-red-800" },
  science:       { fr: "Science",       ht: "Syans",        color: "bg-cyan-100 text-cyan-800" },
  military:      { fr: "Militaire",     ht: "Militè",       color: "bg-gray-100 text-gray-800" },
  economy:       { fr: "Économie",      ht: "Ekonomi",      color: "bg-yellow-100 text-yellow-800" },
  literature:    { fr: "Littérature",   ht: "Literati",     color: "bg-indigo-100 text-indigo-800" },
  art:           { fr: "Art",           ht: "La",           color: "bg-pink-100 text-pink-800" },
  religion:      { fr: "Religion",      ht: "Relijyon",     color: "bg-amber-100 text-amber-800" },
  sports:        { fr: "Sports",        ht: "Espò",         color: "bg-emerald-100 text-emerald-800" },
  disaster:      { fr: "Catastrophe",   ht: "Katastwòf",    color: "bg-orange-100 text-orange-800" },
  diplomacy:     { fr: "Diplomatie",    ht: "Diplomasi",    color: "bg-teal-100 text-teal-800" },
  resistance:    { fr: "Résistance",    ht: "Rezistans",    color: "bg-rose-100 text-rose-800" },
  revolution:    { fr: "Révolution",    ht: "Revolisyon",   color: "bg-red-100 text-red-700" },
};

/** Tags exposed in the filter UI (subset of all tags). */
const FILTER_TAGS: AlmanacTag[] = [
  "revolution", "culture", "education", "politics", "resistance",
];

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTH_NAMES_HT = [
  "Janvye", "Fevriye", "Mas", "Avril", "Me", "Jen",
  "Jiyè", "Out", "Septanm", "Oktòb", "Novanm", "Desanm",
];
const MONTH_SHORT_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];
const MONTH_SHORT_HT = [
  "Jan", "Fev", "Mas", "Avr", "Me", "Jen",
  "Jiy", "Out", "Sep", "Okt", "Nov", "Des",
];

/** Max facts shown per day in week view. */
const MAX_FACTS_PER_DAY = 3;

// ── Types ────────────────────────────────────────────────────────────────────

type ViewMode = "week" | "month";

interface DayLabel {
  dayName: string;
  dayShort: string;
  dayNumber: number;
  monthShort: string;
  monthIndex: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Sort entries: confidence "high" first, then year descending (newest first). */
function sortEntries(
  entries: HaitiHistoryAlmanacEntry[],
): HaitiHistoryAlmanacEntry[] {
  return [...entries].sort((a, b) => {
    if (a.confidence === "high" && b.confidence !== "high") return -1;
    if (a.confidence !== "high" && b.confidence === "high") return 1;
    return (b.year ?? 0) - (a.year ?? 0);
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export function HistoireArchive({
  lang,
  defaultMonth,
}: {
  lang: ContentLanguage;
  defaultMonth: string;
}) {
  const fr = lang === "fr";

  // ── View mode ──
  const [viewMode, setViewMode] = useState<ViewMode>("week");

  // ── Month state ──
  const [month, setMonth] = useState(defaultMonth);

  // ── Week state ──
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekLabel, setWeekLabel] = useState("");
  const [weekDays, setWeekDays] = useState<string[]>([]);
  const [weekDayLabels, setWeekDayLabels] = useState<DayLabel[]>([]);

  // ── Shared state ──
  const [tag, setTag] = useState<AlmanacTag | "">("");
  const [entries, setEntries] = useState<HaitiHistoryAlmanacEntry[]>([]);
  const [holidays, setHolidays] = useState<HaitiHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // ── Fetchers ──

  const fetchWeek = useCallback(
    async (offset: number, t: string) => {
      setLoading(true);
      try {
        const url = `/api/histoire/archive?view=week&weekOffset=${offset}&lang=${lang}${t ? `&tag=${t}` : ""}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.entries);
          setHolidays(data.holidays);
          setWeekLabel(data.weekLabel);
          setWeekDays(data.days);
          setWeekDayLabels(data.dayLabels);
        }
      } catch {
        /* swallow — user can retry */
      } finally {
        setLoading(false);
        setFetched(true);
      }
    },
    [lang],
  );

  const fetchMonth = useCallback(async (m: string, t: string) => {
    setLoading(true);
    try {
      const url = `/api/histoire/archive?month=${m}${t ? `&tag=${t}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
        setHolidays(data.holidays);
      }
    } catch {
      /* swallow */
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, []);

  // Auto-fetch on mount and when params change
  useEffect(() => {
    if (viewMode === "week") {
      void fetchWeek(weekOffset, tag);
    } else {
      void fetchMonth(month, tag);
    }
  }, [viewMode, weekOffset, month, tag, fetchWeek, fetchMonth]);

  // ── Derived values ──

  const monthIndex = parseInt(month, 10) - 1;
  const monthName = fr
    ? MONTH_NAMES_FR[monthIndex] ?? month
    : MONTH_NAMES_HT[monthIndex] ?? month;

  // Group entries by monthDay for week view
  const entriesByDay: Record<string, HaitiHistoryAlmanacEntry[]> = {};
  for (const e of entries) {
    if (!entriesByDay[e.monthDay]) entriesByDay[e.monthDay] = [];
    entriesByDay[e.monthDay]!.push(e);
  }

  const holidaysByDay: Record<string, HaitiHoliday[]> = {};
  for (const h of holidays) {
    if (!holidaysByDay[h.monthDay]) holidaysByDay[h.monthDay] = [];
    holidaysByDay[h.monthDay]!.push(h);
  }

  // ── Render ──

  return (
    <section className="space-y-8">
      {/* ── Section heading ── */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          <Calendar className="mr-2 inline h-6 w-6 text-brand-600" />
          {fr ? "Explorer l\u2019histoire" : "Eksplore istwa"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {fr
            ? "Parcourez les événements historiques par semaine ou par mois."
            : "Navige nan evènman istorik pa semèn oswa pa mwa."}
        </p>
      </div>

      {/* ── View mode toggle ── */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            onClick={() => setViewMode("week")}
            className={
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition " +
              (viewMode === "week"
                ? "bg-white text-brand-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700")
            }
          >
            📅 {fr ? "Semaine" : "Semèn"}
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition " +
              (viewMode === "month"
                ? "bg-white text-brand-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700")
            }
          >
            🗓️ {fr ? "Mois" : "Mwa"}
          </button>
        </div>
      </div>

      {/* ── Tag filter pills (both views) ── */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => setTag("")}
          className={
            "rounded-full px-4 py-1.5 text-xs font-medium transition " +
            (tag === ""
              ? "bg-brand-700 text-white shadow-sm"
              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50")
          }
        >
          {fr ? "Tous" : "Tout"}
        </button>
        {FILTER_TAGS.map((t) => {
          const tl = TAG_LABELS[t];
          const isActive = tag === t;
          return (
            <button
              key={t}
              onClick={() => setTag(isActive ? "" : t)}
              className={
                "inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-medium transition " +
                (isActive
                  ? "bg-brand-700 text-white shadow-sm"
                  : `border border-gray-200 bg-white hover:bg-gray-50 ${tl.color}`)
              }
            >
              <Tag className="h-3 w-3" />
              {fr ? tl.fr : tl.ht}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
       *  WEEK VIEW
       * ══════════════════════════════════════════════════════════════════ */}
      {viewMode === "week" && (
        <>
          {/* Week navigation */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setWeekOffset((o) => o - 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-brand-600"
              aria-label={fr ? "Semaine précédente" : "Semèn anvan"}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-center">
              <span className="text-base font-semibold text-gray-900 sm:text-lg">
                {weekLabel || "\u00a0"}
              </span>
              {weekOffset !== 0 && (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="ml-3 text-xs font-medium text-brand-600 hover:underline"
                >
                  {fr ? "Aujourd\u2019hui" : "Jodi a"}
                </button>
              )}
            </div>
            <button
              onClick={() => setWeekOffset((o) => o + 1)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm transition hover:bg-gray-50 hover:text-brand-600"
              aria-label={fr ? "Semaine suivante" : "Semèn kap vini"}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              <p className="text-sm text-gray-400">
                {fr ? "Chargement…" : "Chajman…"}
              </p>
            </div>
          )}

          {/* Day cards */}
          {!loading && fetched && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
              {weekDays.map((md, i) => {
                const dl = weekDayLabels[i];
                const dayEntries = sortEntries(
                  entriesByDay[md] ?? [],
                ).slice(0, MAX_FACTS_PER_DAY);
                const mainFact = dayEntries[0];
                const secondaryFacts = dayEntries.slice(1);
                const dayHolidays = holidaysByDay[md] ?? [];

                return (
                  <div
                    key={md}
                    className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    {/* Day header */}
                    <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                        <span className="text-base font-bold leading-tight">
                          {dl?.dayNumber}
                        </span>
                        <span className="text-[8px] font-semibold uppercase text-brand-400">
                          {dl?.monthShort}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">
                        {dl?.dayName}
                      </span>
                    </div>

                    {/* Holiday banners */}
                    {dayHolidays.map((h) => (
                      <div
                        key={h.id}
                        className="mx-3 mt-3 flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 text-xs font-semibold text-amber-700"
                      >
                        <Star className="h-3.5 w-3.5 text-amber-500" />
                        {fr ? h.name_fr : h.name_ht}
                        {h.isNationalHoliday && (
                          <span className="ml-auto text-amber-400">🇭🇹</span>
                        )}
                      </div>
                    ))}

                    {/* Facts */}
                    <div className="flex flex-1 flex-col gap-3 p-3">
                      {mainFact ? (
                        <>
                          {/* Main fact */}
                          <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-3">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              {mainFact.year != null && (
                                <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                                  {mainFact.year}
                                </span>
                              )}
                              {mainFact.confidence === "high" && (
                                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                                  ✓
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold leading-snug text-gray-900">
                              {mainFact.title_fr}
                            </h4>
                            <p className="mt-1 text-xs leading-relaxed text-gray-600 line-clamp-3">
                              {mainFact.summary_fr}
                            </p>
                            {mainFact.student_takeaway_fr && (
                              <p className="mt-2 text-[11px] leading-relaxed text-brand-700">
                                💡 {mainFact.student_takeaway_fr}
                              </p>
                            )}
                            {mainFact.tags && mainFact.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {mainFact.tags.slice(0, 2).map((t) => {
                                  const tl = TAG_LABELS[t];
                                  return (
                                    <span
                                      key={t}
                                      className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${tl?.color ?? "bg-gray-100 text-gray-700"}`}
                                    >
                                      {fr ? tl?.fr : tl?.ht}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Secondary facts */}
                          {secondaryFacts.map((entry) => (
                            <div
                              key={entry.id}
                              className="rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2"
                            >
                              <div className="flex items-start gap-1.5">
                                {entry.year != null && (
                                  <span className="shrink-0 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                                    {entry.year}
                                  </span>
                                )}
                                <h5 className="text-xs font-semibold leading-snug text-gray-800">
                                  {entry.title_fr}
                                </h5>
                              </div>
                              <p className="mt-1 text-[11px] leading-relaxed text-gray-500 line-clamp-1">
                                {entry.summary_fr}
                              </p>
                            </div>
                          ))}
                        </>
                      ) : (
                        /* Empty day placeholder */
                        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-100 py-6 text-center">
                          <BookOpen className="mb-1.5 h-5 w-5 text-gray-300" />
                          <p className="text-[11px] text-gray-400">
                            {fr
                              ? "Aucun événement historique"
                              : "Pa gen evènman istorik"}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
       *  MONTH VIEW
       * ══════════════════════════════════════════════════════════════════ */}
      {viewMode === "month" && (
        <>
          {/* Month grid */}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
            {Array.from({ length: 12 }, (_, i) => {
              const mm = String(i + 1).padStart(2, "0");
              const shortName = fr ? MONTH_SHORT_FR[i] : MONTH_SHORT_HT[i];
              const isActive = month === mm;
              return (
                <button
                  key={mm}
                  onClick={() => setMonth(mm)}
                  className={
                    "flex flex-col items-center rounded-xl px-2 py-3 text-center transition " +
                    (isActive
                      ? "bg-brand-600 text-white shadow-md ring-2 ring-brand-300"
                      : "border border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50")
                  }
                >
                  <span className="text-lg font-bold leading-tight">
                    {String(i + 1)}
                  </span>
                  <span
                    className={`text-[10px] font-medium ${isActive ? "text-white/80" : "text-gray-400"}`}
                  >
                    {shortName}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              <p className="text-sm text-gray-400">
                {fr ? "Chargement…" : "Chajman…"}
              </p>
            </div>
          )}

          {/* Results */}
          {!loading && fetched && (
            <div className="space-y-8">
              {/* Holidays this month */}
              {holidays.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-amber-700">
                    <Star className="h-4 w-4" />
                    {fr ? "Fêtes ce mois" : "Fèt mwa sa a"}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {holidays.map((h) => {
                      const dd = h.monthDay.split("-")[1];
                      return (
                        <div
                          key={h.id}
                          className="flex items-center gap-4 rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white shadow-sm">
                            {dd}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">
                              {fr ? h.name_fr : h.name_ht}
                            </p>
                            {h.isNationalHoliday && (
                              <span className="text-xs font-medium text-amber-600">
                                🇭🇹 {fr ? "Fête nationale" : "Fèt nasyonal"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Entries — timeline style */}
              {entries.length > 0 ? (
                <div>
                  <h3 className="mb-4 text-lg font-bold text-gray-900">
                    {monthName} —{" "}
                    <span className="font-normal text-gray-500">
                      {entries.length}{" "}
                      {fr ? "événements historiques" : "evènman istorik"}
                    </span>
                  </h3>

                  <div className="relative">
                    {/* Timeline line */}
                    {entries.length > 1 && (
                      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-200 via-brand-100 to-transparent" />
                    )}

                    <div className="space-y-4">
                      {entries
                        .sort((a, b) =>
                          a.monthDay.localeCompare(b.monthDay),
                        )
                        .map((entry) => {
                          const dd = entry.monthDay.split("-")[1];
                          return (
                            <div
                              key={entry.id}
                              className="relative flex gap-4"
                            >
                              {/* Timeline date node */}
                              <div className="relative z-10 flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border-2 border-brand-200 bg-white text-brand-700 shadow-sm">
                                <span className="text-sm font-bold leading-tight">
                                  {dd}
                                </span>
                                <span className="text-[8px] font-semibold uppercase text-brand-400">
                                  {monthName?.slice(0, 3)}
                                </span>
                              </div>

                              {/* Entry card */}
                              <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <h4 className="text-sm font-bold text-gray-900 sm:text-base">
                                    {entry.title_fr}
                                    {entry.year != null && (
                                      <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
                                        {entry.year}
                                      </span>
                                    )}
                                  </h4>
                                </div>
                                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600">
                                  {entry.summary_fr}
                                </p>
                                {entry.tags &&
                                  entry.tags.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                      {entry.tags
                                        .slice(0, 3)
                                        .map((t) => {
                                          const tl = TAG_LABELS[t];
                                          return (
                                            <span
                                              key={t}
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tl?.color ?? "bg-gray-100 text-gray-700"}`}
                                            >
                                              {fr ? tl?.fr : tl?.ht}
                                            </span>
                                          );
                                        })}
                                    </div>
                                  )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center text-gray-400">
                  <Calendar className="mx-auto mb-2 h-8 w-8" />
                  <p className="text-sm">
                    {fr
                      ? "Aucune entrée pour ce mois."
                      : "Pa gen antre pou mwa sa a."}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
