"use client";

/**
 * HistoireClient — client orchestrator for /histoire.
 *
 * New editorial layout flow:
 *   ① Hero Fact   — the single most important event, immersive card
 *   ② Holidays    — ribbon banners (if any)
 *   ③ WeekStrip   — sticky 7-day nav (clicking exits range mode)
 *   ④ Sub-facts   — "Aussi ce jour-là" grid with inline category pills
 *   ⑤ Explore     — month-level accordion (presets + dropdown)
 *
 * Supports two modes:
 *   - Single-date (default, driven by WeekStrip)
 *   - Range/month (driven by ExplorePanel)
 */

import { useState, useMemo, useCallback, useEffect } from "react";
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

  // ── State ──
  const [selectedDate, setSelectedDate] = useState(todayMD);
  const [liveTodayMD, setLiveTodayMD] = useState(todayMD);
  const [dateRange, setDateRange] = useState<DateRange | null>(null);

  const [entriesByMonth, setEntriesByMonth] = useState<Record<string, SerializableAlmanacEntry[]>>({
    [prefetchedMonth]: initialEntries,
  });
  const [loadingMonths, setLoadingMonths] = useState<Set<string>>(new Set());

  // ── Rehydrate today's date on the client (ISR page may be stale) ──
  useEffect(() => {
    const clientToday = getHaitiMonthDayClient();
    if (clientToday !== todayMD) {
      setLiveTodayMD(clientToday);
      setSelectedDate(clientToday);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ──
  const selectedMonthStr = selectedDate.split("-")[0]!;
  const todayMonth = parseInt(liveTodayMD.split("-")[0]!, 10);
  const weekDays = useMemo(() => getWeekAroundDate(selectedDate), [selectedDate]);

  // ── Month loading ──
  const ensureMonthLoaded = useCallback(
    async (monthStr: string) => {
      if (entriesByMonth[monthStr]) return;
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
    [entriesByMonth],
  );

  // Load months for current view
  useEffect(() => {
    if (dateRange) {
      for (const m of monthsInRange(dateRange.start, dateRange.end)) {
        if (!entriesByMonth[m]) void ensureMonthLoaded(m);
      }
    } else {
      if (!entriesByMonth[selectedMonthStr]) void ensureMonthLoaded(selectedMonthStr);
      const months = new Set(weekDays.map((d) => d.split("-")[0]!));
      for (const m of months) if (!entriesByMonth[m]) void ensureMonthLoaded(m);
    }
  }, [selectedMonthStr, weekDays, dateRange, entriesByMonth, ensureMonthLoaded]);

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
  }, []);

  const handleRangeSelect = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  const handleRangeClear = useCallback(() => {
    setDateRange(null);
  }, []);

  // ── Labels ──
  const dateLabel = dateRange
    ? formatRange(dateRange, lang)
    : formatMonthDay(selectedDate, lang);

  return (
    <div className="space-y-6">
      {/* ── ① Hero Fact ──────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
          <p className="text-sm text-stone-400 dark:text-stone-500">
            {fr ? "Chargement…" : "Chajman…"}
          </p>
        </div>
      ) : hero ? (
        <div className="space-y-3">
          {/* Date context label */}
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
              {dateRange
                ? (fr ? "Fait marquant" : "Reyalite enpòtan")
                : `${dateLabel} — ${fr ? "fait marquant" : "reyalite enpòtan"}`}
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
        />
      )}

      {/* ── ② Holiday banners ────────────────────────────────── */}
      {activeHolidays.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeHolidays.map((h) => (
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
              {dateRange && (
                <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                  {formatMonthDay(h.monthDay, lang)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── ③ Sticky WeekStrip ───────────────────────────────── */}
      <WeekStrip
        days={weekDays}
        selectedDate={selectedDate}
        todayDate={liveTodayMD}
        onSelect={handleWeekSelect}
        lang={lang}
        entryCounts={entryCounts}
      />

      {/* ── ④ Sub-facts: "Aussi ce jour-là" ──────────────────── */}
      {!isLoading && secondaryEntries.length > 0 && (
        <HistoryList
          entries={secondaryEntries}
          lang={lang}
          emptyLabel={dateLabel}
          showDate={!!dateRange}
        />
      )}

      {/* ── ⑤ Explore — quiet footer navigation ─────────────── */}
      <div className="border-t border-stone-100 pt-5 dark:border-stone-800">
        <ExplorePanel
          activeRange={dateRange}
          onRangeSelect={handleRangeSelect}
          onRangeClear={handleRangeClear}
          lang={lang}
          currentMonth={todayMonth}
        />
      </div>
    </div>
  );
}
