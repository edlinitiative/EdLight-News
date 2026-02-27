"use client";

/**
 * HistoireClient — client wrapper that orchestrates UI state for /histoire.
 *
 * Manages: selected date, category filter, and dispatches to sub-components.
 * All data is passed from the server component; no new fetching is added.
 * When the user selects a date outside the pre-fetched month, it calls
 * the existing /api/histoire/archive?month=MM endpoint to load that month.
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import type {
  ContentLanguage,
  AlmanacTag,
  HaitiHistoryAlmanacEntry,
  HaitiHoliday,
} from "@edlight-news/types";
import { HistoryHero } from "./HistoryHero";
import { WeekStrip } from "./WeekStrip";
import { ExplorePanel } from "./ExplorePanel";
import { HistoryList } from "./HistoryList";
import { getWeekAroundDate } from "./shared";

interface HistoireClientProps {
  /** Today's MM-DD in Haiti timezone */
  todayMD: string;
  /** All entries for the current month (pre-fetched server-side) */
  monthEntries: HaitiHistoryAlmanacEntry[];
  /** All holidays */
  allHolidays: HaitiHoliday[];
  /** The month that was pre-fetched (e.g., "02") */
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
  const [selectedTag, setSelectedTag] = useState<AlmanacTag | "">("");

  // Entries cache: keyed by month string, pre-seeded with server data
  const [entriesByMonth, setEntriesByMonth] = useState<Record<string, HaitiHistoryAlmanacEntry[]>>({
    [prefetchedMonth]: initialEntries,
  });
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);

  // ── Derived values ──
  const selectedMonth = parseInt(selectedDate.split("-")[0]!, 10);
  const selectedDay = parseInt(selectedDate.split("-")[1]!, 10);
  const selectedMonthStr = String(selectedMonth).padStart(2, "0");

  // Week strip days: 7 days centred around the selected date
  const weekDays = useMemo(() => getWeekAroundDate(selectedDate), [selectedDate]);

  // Fetch a month's data if not already cached
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
        // Silently fail — user sees empty state
      } finally {
        setLoadingMonth(null);
      }
    },
    [entriesByMonth, loadingMonth],
  );

  // When selected date changes, ensure we have the month data
  useEffect(() => {
    if (!entriesByMonth[selectedMonthStr]) {
      void ensureMonthLoaded(selectedMonthStr);
    }
  }, [selectedMonthStr, entriesByMonth, ensureMonthLoaded]);

  // Also preload months for week-strip days that span a month boundary
  useEffect(() => {
    const months = new Set(weekDays.map((d) => d.split("-")[0]!));
    for (const m of months) {
      if (!entriesByMonth[m]) {
        void ensureMonthLoaded(m);
      }
    }
  }, [weekDays, entriesByMonth, ensureMonthLoaded]);

  // Current month's entries (or empty while loading)
  const currentMonthEntries = entriesByMonth[selectedMonthStr] ?? [];

  // Filter entries for the selected MM-DD
  const entriesForDate = useMemo(() => {
    return currentMonthEntries.filter((e) => e.monthDay === selectedDate);
  }, [currentMonthEntries, selectedDate]);

  // Apply tag filter
  const filteredEntries = useMemo(() => {
    if (!selectedTag) return entriesForDate;
    return entriesForDate.filter((e) => e.tags?.includes(selectedTag));
  }, [entriesForDate, selectedTag]);

  // Holidays for the selected date
  const holidaysForDate = useMemo(() => {
    return allHolidays.filter((h) => h.monthDay === selectedDate);
  }, [allHolidays, selectedDate]);

  // Entry counts per day for the week strip
  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const md of weekDays) {
      const monthStr = md.split("-")[0]!;
      const monthData = entriesByMonth[monthStr] ?? [];
      counts[md] = monthData.filter((e) => e.monthDay === md).length;
    }
    return counts;
  }, [weekDays, entriesByMonth]);

  // ── Handlers ──
  const handleWeekSelect = useCallback((md: string) => {
    setSelectedDate(md);
    setSelectedTag("");
  }, []);

  const handleDateChange = useCallback((month: number, day: number) => {
    const mm = String(month).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    setSelectedDate(`${mm}-${dd}`);
  }, []);

  const isLoading = loadingMonth === selectedMonthStr;

  return (
    <div className="space-y-8">
      {/* Hero section */}
      <HistoryHero
        entries={filteredEntries}
        holidays={holidaysForDate}
        selectedDate={selectedDate}
        lang={lang}
      />

      {/* Week strip */}
      <WeekStrip
        days={weekDays}
        selectedDate={selectedDate}
        todayDate={todayMD}
        onSelect={handleWeekSelect}
        lang={lang}
        entryCounts={entryCounts}
      />

      {/* Explore panel (collapsed) */}
      <ExplorePanel
        selectedMonth={selectedMonth}
        selectedDay={selectedDay}
        onDateChange={handleDateChange}
        selectedTag={selectedTag}
        onTagChange={setSelectedTag}
        lang={lang}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-sm text-stone-400 dark:text-stone-500">
            {fr ? "Chargement…" : "Chajman…"}
          </p>
        </div>
      )}

      {/* History list */}
      {!isLoading && (
        <HistoryList
          entries={filteredEntries}
          selectedDate={selectedDate}
          lang={lang}
        />
      )}
    </div>
  );
}
