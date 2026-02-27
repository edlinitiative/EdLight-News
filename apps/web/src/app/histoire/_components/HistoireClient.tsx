"use client";

/**
 * HistoireClient — client orchestrator for /histoire.
 *
 * Layout flow:
 *   A) Hero date block (selected date + fact count)
 *   B) Sticky WeekStrip (primary navigation)
 *   C) Content tabs: Faits | Personnalités | Fêtes
 *   D) HistoryList (top 3 + "Voir tous")
 *   E) ExplorePanel accordion (deeper date/category navigation)
 *
 * No duplication — single list per date.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { CalendarHeart, Loader2, Star } from "lucide-react";
import type { ContentLanguage, AlmanacTag } from "@edlight-news/types";
import { WeekStrip } from "./WeekStrip";
import { HistoryTabs, type HistoireTab } from "./HistoryTabs";
import { HistoryList } from "./HistoryList";
import { EmptyState } from "./EmptyState";
import { ExplorePanel } from "./ExplorePanel";
import { getWeekAroundDate, formatMonthDay } from "./shared";
import type { SerializableAlmanacEntry, SerializableHoliday } from "./shared";

interface HistoireClientProps {
  todayMD: string;
  monthEntries: SerializableAlmanacEntry[];
  allHolidays: SerializableHoliday[];
  prefetchedMonth: string;
  lang: ContentLanguage;
}

export function HistoireClient({
  todayMD,
  monthEntries: initialEntries,
  allHolidays,
  prefetchedMonth,
  lang,
}: HistoireClientProps) {
  const fr = lang === "fr";

  // ── State ──
  const [selectedDate, setSelectedDate] = useState(todayMD);
  const [activeTab, setActiveTab] = useState<HistoireTab>("faits");
  const [selectedTag, setSelectedTag] = useState<AlmanacTag | "">("");

  // Entries cache: keyed by month string
  const [entriesByMonth, setEntriesByMonth] = useState<Record<string, SerializableAlmanacEntry[]>>({
    [prefetchedMonth]: initialEntries,
  });
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);

  // ── Derived ──
  const selectedMonthStr = selectedDate.split("-")[0]!;
  const selectedMonth = parseInt(selectedMonthStr, 10);
  const selectedDay = parseInt(selectedDate.split("-")[1]!, 10);
  const weekDays = useMemo(() => getWeekAroundDate(selectedDate), [selectedDate]);

  // Fetch month data on demand
  const ensureMonthLoaded = useCallback(
    async (monthStr: string) => {
      if (entriesByMonth[monthStr] || loadingMonth === monthStr) return;
      setLoadingMonth(monthStr);
      try {
        const res = await fetch(`/api/histoire/archive?month=${monthStr}`);
        if (res.ok) {
          const data = await res.json();
          setEntriesByMonth((prev) => ({ ...prev, [monthStr]: data.entries }));
        }
      } catch {
        /* silently fail — empty state */
      } finally {
        setLoadingMonth(null);
      }
    },
    [entriesByMonth, loadingMonth],
  );

  useEffect(() => {
    if (!entriesByMonth[selectedMonthStr]) void ensureMonthLoaded(selectedMonthStr);
  }, [selectedMonthStr, entriesByMonth, ensureMonthLoaded]);

  useEffect(() => {
    const months = new Set(weekDays.map((d) => d.split("-")[0]!));
    for (const m of months) if (!entriesByMonth[m]) void ensureMonthLoaded(m);
  }, [weekDays, entriesByMonth, ensureMonthLoaded]);

  // Entries for selected date
  const entriesForDate = useMemo(
    () => (entriesByMonth[selectedMonthStr] ?? []).filter((e) => e.monthDay === selectedDate),
    [entriesByMonth, selectedMonthStr, selectedDate],
  );

  // Apply category filter (only for "faits" tab)
  const filteredEntries = useMemo(() => {
    if (!selectedTag) return entriesForDate;
    return entriesForDate.filter((e) => e.tags?.includes(selectedTag));
  }, [entriesForDate, selectedTag]);

  // Holidays for selected date
  const holidaysForDate = useMemo(
    () => allHolidays.filter((h) => h.monthDay === selectedDate),
    [allHolidays, selectedDate],
  );

  // Tab counts
  const tabCounts: Record<HistoireTab, number> = useMemo(() => ({
    faits: entriesForDate.length,
    personnalites: 0, // future: filter entries with person tags
    fetes: holidaysForDate.length,
  }), [entriesForDate, holidaysForDate]);

  // Entry counts for week strip
  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const md of weekDays) {
      const mStr = md.split("-")[0]!;
      counts[md] = (entriesByMonth[mStr] ?? []).filter((e) => e.monthDay === md).length;
    }
    return counts;
  }, [weekDays, entriesByMonth]);

  // ── Handlers ──
  const handleWeekSelect = useCallback((md: string) => {
    setSelectedDate(md);
    setSelectedTag("");
    setActiveTab("faits");
  }, []);

  const handleDateChange = useCallback((month: number, day: number) => {
    setSelectedDate(`${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    setActiveTab("faits");
  }, []);

  const isLoading = loadingMonth === selectedMonthStr;
  const dateLabel = formatMonthDay(selectedDate, lang);

  return (
    <div>
      {/* ── A) Hero date block ─────────────────────────────────────── */}
      <section className="mb-2 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
              {fr ? "Date sélectionnée" : "Dat ou chwazi"}
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white sm:text-3xl">
              {dateLabel}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
            <CalendarHeart className="h-4 w-4" />
            <span>
              {entriesForDate.length} {fr ? "fait" : "reyalite"}{entriesForDate.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Holiday banners */}
        {holidaysForDate.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {holidaysForDate.map((h) => (
              <div
                key={h.id}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/60 px-3.5 py-2 text-sm font-medium text-amber-800 dark:from-amber-900/20 dark:to-amber-900/10 dark:text-amber-300"
              >
                <Star className="h-3.5 w-3.5 text-amber-500" />
                {fr ? h.name_fr : h.name_ht}
                {h.isNationalHoliday && (
                  <span className="ml-1 rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-semibold uppercase dark:bg-amber-800/30">
                    {fr ? "National" : "Nasyonal"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── B) Sticky WeekStrip ────────────────────────────────────── */}
      <WeekStrip
        days={weekDays}
        selectedDate={selectedDate}
        todayDate={todayMD}
        onSelect={handleWeekSelect}
        lang={lang}
        entryCounts={entryCounts}
      />

      {/* Content below sticky strip */}
      <div className="mt-6 space-y-6">
        {/* ── C) Content tabs ────────────────────────────────────── */}
        <HistoryTabs
          active={activeTab}
          onChange={setActiveTab}
          counts={tabCounts}
          lang={lang}
        />

        {/* ── D) Tab content ─────────────────────────────────────── */}
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <p className="text-sm text-stone-400 dark:text-stone-500">
              {fr ? "Chargement…" : "Chajman…"}
            </p>
          </div>
        ) : activeTab === "faits" ? (
          <HistoryList
            entries={filteredEntries}
            lang={lang}
            emptyLabel={dateLabel}
          />
        ) : activeTab === "fetes" ? (
          holidaysForDate.length > 0 ? (
            <div className="space-y-3">
              {holidaysForDate.map((h) => (
                <div
                  key={h.id}
                  className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700 dark:bg-stone-800"
                >
                  <h3 className="text-base font-bold text-stone-900 dark:text-white">
                    {fr ? h.name_fr : h.name_ht}
                  </h3>
                  {(fr ? h.description_fr : h.description_ht) && (
                    <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                      {fr ? h.description_fr : h.description_ht}
                    </p>
                  )}
                  {h.isNationalHoliday && (
                    <span className="mt-3 inline-block rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                      🇭🇹 {fr ? "Fête nationale" : "Fèt nasyonal"}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              lang={lang}
              dateLabel={dateLabel}
              hint={fr ? "Aucune fête enregistrée pour cette date." : "Pa gen fèt anrejistre pou dat sa a."}
            />
          )
        ) : (
          /* personnalites — future content */
          <EmptyState
            lang={lang}
            dateLabel={dateLabel}
            hint={fr ? "Les personnalités arrivent bientôt !" : "Pèsonalite yo ap vini byento !"}
          />
        )}

        {/* ── E) Explore accordion ───────────────────────────────── */}
        <ExplorePanel
          selectedMonth={selectedMonth}
          selectedDay={selectedDay}
          onDateChange={handleDateChange}
          selectedTag={selectedTag}
          onTagChange={setSelectedTag}
          lang={lang}
        />
      </div>
    </div>
  );
}
