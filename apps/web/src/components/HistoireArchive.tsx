/**
 * HistoireArchive — Always-visible month/tag archive for /histoire.
 *
 * Lazy-loads almanac entries via /api/histoire/archive when the user
 * selects a month, so the main page load stays fast.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Star, Tag, Loader2 } from "lucide-react";
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
const MONTH_SHORT_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];
const MONTH_SHORT_HT = [
  "Jan", "Fev", "Mas", "Avr", "Me", "Jen",
  "Jiy", "Out", "Sep", "Okt", "Nov", "Des",
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

  // Auto-fetch on mount and when month/tag changes
  useEffect(() => {
    void fetchArchive(month, tag);
  }, [month, tag, fetchArchive]);

  const monthIndex = parseInt(month, 10) - 1;
  const monthName = fr
    ? MONTH_NAMES_FR[monthIndex] ?? month
    : MONTH_NAMES_HT[monthIndex] ?? month;

  return (
    <section className="space-y-8">
      {/* ── Section heading ── */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          <Calendar className="mr-2 inline h-6 w-6 text-brand-600" />
          {fr ? "Parcourir par mois" : "Eksplore pa mwa"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {fr
            ? "Sélectionnez un mois pour explorer les événements."
            : "Chwazi yon mwa pou eksplore evènman yo."}
        </p>
      </div>

      {/* ── Month grid ── */}
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
              <span className={`text-[10px] font-medium ${isActive ? "text-white/80" : "text-gray-400"}`}>
                {shortName}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Tag filter pills ── */}
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

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          <p className="text-sm text-gray-400">{fr ? "Chargement…" : "Chajman…"}</p>
        </div>
      )}

      {/* ── Results ── */}
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
                  {entries.length} {fr ? "événements historiques" : "evènman istorik"}
                </span>
              </h3>

              <div className="relative">
                {/* Timeline line */}
                {entries.length > 1 && (
                  <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-200 via-brand-100 to-transparent" />
                )}

                <div className="space-y-4">
                  {entries
                    .sort((a, b) => a.monthDay.localeCompare(b.monthDay))
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
                            {entry.tags && entry.tags.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {entry.tags.slice(0, 3).map((t) => {
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
    </section>
  );
}
