"use client";

/**
 * HistoireClient — client orchestrator for /histoire.
 *
 * Redesigned layout flow:
 *   ① WeekStrip  — sticky 7-day nav (always visible at top)
 *   ② Holidays   — ribbon banners (if any)
 *   ③ Explore    — month navigator (visible, not buried)
 *   ④ Hero Fact  — the single most important event, editorial card
 *   ⑤ Sub-facts  — "Aussi ce jour-là" with inline category pills
 *
 * Features:
 *   - URL state sync (date= searchParam)
 *   - CSS transitions on content swap
 *   - "Back to today" in empty states
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarHeart, Loader2, Star } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { WeekStrip } from "./WeekStrip";
import { HeroFact } from "./HeroFact";
import { HistoryList } from "./HistoryList";
import { EmptyState } from "./EmptyState";
import { ExplorePanel } from "./ExplorePanel";
import {
  getWeekAroundDate,
  formatMonthDay,
  formatRange,
  isInRange,
  monthsInRange,
  pickHeroEntry,
  getHaitiMonthDayClient,
  type DateRange,
} from "./shared";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── State ──
  const initialDate = searchParams.get("date") ?? todayMD;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [liveTodayMD, setLiveTodayMD] = useState(todayMD);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [contentKey, setContentKey] = useState(0); // for CSS transitions

  const [entriesByMonth, setEntriesByMonth] = useState<Record<string, SerializableAlmanacEntry[]>>({
    [prefetchedMonth]: initialEntries,
  });
  const [loadingMonths, setLoadingMonths] = useState<Set<string>>(new Set());

  // Ref to avoid stale closures in ensureMonthLoaded
  const entriesByMonthRef = useRef(entriesByMonth);
  entriesByMonthRef.current = entriesByMonth;

  // ── Rehydrate today's date on the client (ISR page may be stale) ──
  useEffect(() => {
    const clientToday = getHaitiMonthDayClient();
    if (clientToday !== todayMD) {
      setLiveTodayMD(clientToday);
      // Only auto-navigate to today if no date param was provided
      if (!searchParams.get("date")) {
        setSelectedDate(clientToday);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── URL sync ──
  const updateURL = useCallback(
    (date: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (date === liveTodayMD) {
        params.delete("date");
      } else {
        params.set("date", date);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams, liveTodayMD],
  );

  // ── Derived ──
  const selectedMonthStr = selectedDate.split("-")[0]!;
  const todayMonth = parseInt(liveTodayMD.split("-")[0]!, 10);
  const weekDays = useMemo(() => getWeekAroundDate(selectedDate), [selectedDate]);

  // ── Month loading (stable callback — uses ref to avoid dep on entriesByMonth) ──
  const ensureMonthLoaded = useCallback(
    async (monthStr: string) => {
      if (entriesByMonthRef.current[monthStr]) return;
      setLoadingMonths((prev) => {
        if (prev.has(monthStr)) return prev;
        const next = new Set(prev);
        next.add(monthStr);
        return next;
      });
      try {
        const res = await fetch(`/api/histoire/archive?month=${monthStr}`);
        if (res.ok) {
          const data = await res.json();
          setEntriesByMonth((prev) => ({ ...prev, [monthStr]: data.entries }));
        }
      } catch {
        /* silently fail */
      } finally {
        setLoadingMonths((prev) => {
          const next = new Set(prev);
          next.delete(monthStr);
          return next;
        });
      }
    },
    [], // stable — reads from ref
  );

  // Load months for current view
  useEffect(() => {
    if (dateRange) {
      for (const m of monthsInRange(dateRange.start, dateRange.end)) {
        void ensureMonthLoaded(m);
      }
    } else {
      void ensureMonthLoaded(selectedMonthStr);
      const months = new Set(weekDays.map((d) => d.split("-")[0]!));
      for (const m of months) void ensureMonthLoaded(m);
    }
  }, [selectedMonthStr, weekDays, dateRange, ensureMonthLoaded]);

  // ── Entries computation ──
  const entriesForDate = useMemo(
    () => (entriesByMonth[selectedMonthStr] ?? []).filter((e) => e.monthDay === selectedDate),
    [entriesByMonth, selectedMonthStr, selectedDate],
  );

  const entriesForRange = useMemo(() => {
    if (!dateRange) return [];
    const months = monthsInRange(dateRange.start, dateRange.end);
    const all: SerializableAlmanacEntry[] = [];
    for (const m of months) {
      const entries = entriesByMonth[m] ?? [];
      all.push(...entries.filter((e) => isInRange(e.monthDay, dateRange.start, dateRange.end)));
    }
    return all.sort((a, b) => {
      if (a.monthDay !== b.monthDay) return a.monthDay < b.monthDay ? -1 : 1;
      return (b.year ?? 0) - (a.year ?? 0);
    });
  }, [dateRange, entriesByMonth]);

  const activeEntries = dateRange ? entriesForRange : entriesForDate;

  // ── Hero + secondary split ──
  const hero = useMemo(() => pickHeroEntry(activeEntries), [activeEntries]);
  const secondaryEntries = useMemo(
    () => (hero ? activeEntries.filter((e) => e.id !== hero.id) : []),
    [activeEntries, hero],
  );

  // ── Holidays ──
  const activeHolidays = useMemo(() => {
    if (dateRange) {
      return allHolidays.filter((h) => isInRange(h.monthDay, dateRange.start, dateRange.end));
    }
    return allHolidays.filter((h) => h.monthDay === selectedDate);
  }, [allHolidays, selectedDate, dateRange]);

  // ── Entry counts for WeekStrip ──
  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const md of weekDays) {
      const mStr = md.split("-")[0]!;
      counts[md] = (entriesByMonth[mStr] ?? []).filter((e) => e.monthDay === md).length;
    }
    return counts;
  }, [weekDays, entriesByMonth]);

  // ── Loading ──
  const isLoading = dateRange
    ? monthsInRange(dateRange.start, dateRange.end).some((m) => loadingMonths.has(m))
    : loadingMonths.has(selectedMonthStr);

  // ── Handlers ──
  const handleWeekSelect = useCallback((md: string) => {
    setSelectedDate(md);
    setDateRange(null);
    setContentKey((k) => k + 1);
    updateURL(md);
  }, [updateURL]);

  const handleGoToday = useCallback(() => {
    setSelectedDate(liveTodayMD);
    setDateRange(null);
    setContentKey((k) => k + 1);
    updateURL(liveTodayMD);
  }, [liveTodayMD, updateURL]);

  const handleRangeSelect = useCallback((range: DateRange) => {
    setDateRange(range);
    setContentKey((k) => k + 1);
  }, []);

  const handleRangeClear = useCallback(() => {
    setDateRange(null);
    setContentKey((k) => k + 1);
  }, []);

  // ── Labels ──
  const dateLabel = dateRange
    ? formatRange(dateRange, lang)
    : formatMonthDay(selectedDate, lang);

  return (
    <div className="space-y-8">
      {/* ── ① Sticky WeekStrip ───────────────────────────────── */}
      <WeekStrip
        days={weekDays}
        selectedDate={selectedDate}
        todayDate={liveTodayMD}
        onSelect={handleWeekSelect}
        lang={lang}
        entryCounts={entryCounts}
      />

      {/* ── ② Holiday banners ────────────────────────────────── */}
      {activeHolidays.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeHolidays.map((h) => (
            <div
              key={h.id}
              className="inline-flex items-center gap-2 rounded-full border border-amber-200/50 bg-gradient-to-r from-amber-50 to-amber-100/60 px-3.5 py-2.5 text-sm font-medium shadow-sm dark:border-amber-700/30 dark:from-amber-900/20 dark:to-amber-800/15"
            >
              <Star className="h-3.5 w-3.5 text-amber-500" />
              <span className="font-serif italic text-amber-800 dark:text-amber-200">{fr ? h.name_fr : h.name_ht}</span>
              {h.isNationalHoliday && (
                <span className="ml-1 rounded-full bg-amber-200/60 px-2 py-0.5 text-[10px] font-semibold uppercase dark:bg-amber-800/30 dark:text-amber-300">
                  {fr ? "National" : "Nasyonal"}
                </span>
              )}
              {dateRange && (
                <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                  {formatMonthDay(h.monthDay, lang)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── ③ Explore — month navigator ──────────────────────── */}
      <ExplorePanel
        activeRange={dateRange}
        onRangeSelect={handleRangeSelect}
        onRangeClear={handleRangeClear}
        lang={lang}
        currentMonth={todayMonth}
      />

      {/* ── ④ Hero Fact ──────────────────────────────────────── */}
      <div
        key={contentKey}
        className="animate-in fade-in duration-200"
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            <p className="font-serif text-sm italic text-stone-400 dark:text-stone-500">
              {fr ? "Chargement\u2026" : "Chajman\u2026"}
            </p>
          </div>
        ) : hero ? (
          <div className="space-y-3">
            {/* Date context label */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                {dateRange
                  ? (fr ? "Fait marquant" : "Reyalite enp\u00f2tan")
                  : `${dateLabel} \u2014 ${fr ? "fait marquant" : "reyalite enp\u00f2tan"}`}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500">
                <CalendarHeart className="h-3.5 w-3.5" />
                <span>
                  {activeEntries.length} {fr ? "fait" : "reyalite"}{activeEntries.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <HeroFact
              entry={hero}
              lang={lang}
              showDate={!!dateRange}
            />
          </div>
        ) : (
          <EmptyState
            lang={lang}
            dateLabel={dateLabel}
            onGoToday={selectedDate !== liveTodayMD ? handleGoToday : undefined}
          />
        )}

        {/* ── ⑤ Sub-facts: "Aussi ce jour-là" ──────────────────── */}
        {!isLoading && secondaryEntries.length > 0 && (
          <div className="mt-10">
            <HistoryList
              entries={secondaryEntries}
              lang={lang}
              emptyLabel={dateLabel}
              showDate={!!dateRange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
