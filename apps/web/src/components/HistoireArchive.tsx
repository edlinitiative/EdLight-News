/**
 * HistoireArchive — Collapsible month/tag archive for /histoire.
 *
 * Lazy-loads almanac entries via /api/histoire/archive when the user
 * expands the section and selects a month, so the main page load stays fast.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronUp, Calendar, Star, Tag } from "lucide-react";
import type { ContentLanguage, AlmanacTag, HaitiHistoryAlmanacEntry, HaitiHoliday } from "@edlight-news/types";

// ── Constants ────────────────────────────────────────────────────────────────

const TAG_LABELS: Record<AlmanacTag, { fr: string; ht: string; color: string }> = {
  independence:  { fr: "Indépendance",  ht: "Endepandans",  color: "bg-blue-100 text-blue-800" },
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
  "revolution",
  "culture",
  "education",
  "politics",
  "resistance",
];

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTH_NAMES_HT = [
  "Janvye", "Fevriye", "Mas", "Avril", "Me", "Jen",
  "Jiyè", "Out", "Septanm", "Oktòb", "Novanm", "Desanm",
];

// ── Component ────────────────────────────────────────────────────────────────

export function HistoireArchive({
  lang,
  defaultMonth,
}: {
  lang: ContentLanguage;
  defaultMonth: string;
}) {
  const fr = lang === "fr";

  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(defaultMonth);
  const [tag, setTag] = useState<AlmanacTag | "">("");
  const [entries, setEntries] = useState<HaitiHistoryAlmanacEntry[]>([]);
  const [holidays, setHolidays] = useState<HaitiHoliday[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchArchive = useCallback(async (m: string, t: string) => {
    setLoading(true);
    try {
      const url = `/api/histoire/archive?month=${m}${t ? `&tag=${t}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as {
          entries: HaitiHistoryAlmanacEntry[];
          holidays: HaitiHoliday[];
        };
        setEntries(data.entries);
        setHolidays(data.holidays);
      }
    } catch {
      /* swallow — user can retry */
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, []);

  // Fetch when opened (first time) or when month/tag changes while open
  useEffect(() => {
    if (open) {
      void fetchArchive(month, tag);
    }
  }, [open, month, tag, fetchArchive]);

  const monthIndex = parseInt(month, 10) - 1;
  const monthName = fr
    ? MONTH_NAMES_FR[monthIndex] ?? month
    : MONTH_NAMES_HT[monthIndex] ?? month;

  return (
    <section className="space-y-4">
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border bg-gray-50 px-5 py-3 text-left transition hover:bg-gray-100"
      >
        <span className="flex items-center gap-2 text-lg font-bold text-gray-800">
          <Calendar className="h-5 w-5 text-gray-500" />
          {fr ? "Explorer par date" : "Eksplore pa dat"}
        </span>
        {open ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {open && (
        <div className="space-y-4 pl-1">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Month selector */}
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const mm = String(i + 1).padStart(2, "0");
                const name = fr ? MONTH_NAMES_FR[i] : MONTH_NAMES_HT[i];
                return (
                  <option key={mm} value={mm}>
                    {name}
                  </option>
                );
              })}
            </select>

            {/* Tag filter pills */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setTag("")}
                className={
                  "rounded-full px-3 py-1 text-xs font-medium transition " +
                  (tag === ""
                    ? "bg-brand-700 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200")
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
                      "rounded-full px-3 py-1 text-xs font-medium transition " +
                      (isActive
                        ? "bg-brand-700 text-white"
                        : `${tl.color} hover:opacity-80`)
                    }
                  >
                    <Tag className="mr-1 inline h-3 w-3" />
                    {fr ? tl.fr : tl.ht}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-gray-100" />
              ))}
            </div>
          )}

          {/* Results */}
          {!loading && fetched && (
            <>
              {/* Holidays this month */}
              {holidays.length > 0 && (
                <div className="space-y-2">
                  <h3 className="flex items-center gap-1 text-sm font-semibold text-amber-700">
                    <Star className="h-4 w-4" />
                    {fr ? "Fêtes ce mois" : "Fèt mwa sa a"}
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {holidays.map((h) => {
                      const dd = h.monthDay.split("-")[1];
                      return (
                        <div
                          key={h.id}
                          className="flex items-center gap-3 rounded-lg border bg-amber-50/50 px-4 py-3"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-sm font-bold text-white">
                            {dd}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {fr ? h.name_fr : h.name_ht}
                            </p>
                            {h.isNationalHoliday && (
                              <span className="text-[10px] text-amber-600">
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

              {/* Entries */}
              {entries.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-gray-800">
                    {monthName} —{" "}
                    {fr ? "Événements historiques" : "Evènman istorik"}
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({entries.length} {fr ? "entrées" : "antre"})
                    </span>
                  </h3>
                  {entries
                    .sort((a, b) => a.monthDay.localeCompare(b.monthDay))
                    .map((entry) => {
                      const dd = entry.monthDay.split("-")[1];
                      return (
                        <div
                          key={entry.id}
                          className="flex gap-4 rounded-lg border bg-white p-4 shadow-sm"
                        >
                          <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-600 text-white">
                            <span className="text-lg font-bold leading-tight">
                              {dd}
                            </span>
                            <span className="text-[9px] uppercase">
                              {monthName?.slice(0, 3)}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold text-gray-900">
                              {entry.title_fr}
                              {entry.year != null && (
                                <span className="ml-1 text-xs text-gray-400">
                                  ({entry.year})
                                </span>
                              )}
                            </h4>
                            <p className="mt-1 line-clamp-2 text-xs text-gray-600">
                              {entry.summary_fr}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {entry.tags?.slice(0, 3).map((t) => {
                                const tl = TAG_LABELS[t];
                                return (
                                  <span
                                    key={t}
                                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${tl?.color ?? "bg-gray-100 text-gray-700"}`}
                                  >
                                    {fr ? tl?.fr : tl?.ht}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center text-gray-400">
                  <p>
                    {fr
                      ? "Aucune entrée pour ce mois."
                      : "Pa gen antre pou mwa sa a."}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
