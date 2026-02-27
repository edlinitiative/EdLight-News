"use client";

/**
 * HistoireClient — client orchestrator for /histoire.
 *
 * Layout flow:
 *   A) Hero date block (selected date OR active range)
 *   B) Sticky WeekStrip (primary navigation — clicking clears range)
 *   C) Content tabs: Faits | Personnalités | Fêtes
 *   D) HistoryList (top 3 + "Voir tous")
 *   E) ExplorePanel accordion (range presets, custom range, category filter)
 *
 * Supports two modes:
 *   - Single-date mode (default, driven by WeekStrip)
 *   - Range mode (driven by ExplorePanel, shows all entries in the range)
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { CalendarHeart, CalendarRange, Loader2, Star } from "lucide-react";
import type { ContentLanguage, AlmanacTag } from "@edlight-news/types";
import { WeekStrip } from "./WeekStrip";
import { HistoryTabs, type HistoireTab } from "./HistoryTabs";
import { HistoryList } from "./HistoryList";
import { EmptyState } from "./EmptyState";
import { ExplorePanel } from "./ExplorePanel";
import {
  getWeekAroundDate,
  formatMonthDay,
  formatRange,
  isInRange,
  monthsInRange,
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
  const [dateRange, setDateRange] = useState<DateRange | null>(null);
  const [activeTab, setActiveTab] = useState<HistoireTab>("faits");
  const [selectedTag, setSelectedTag] = useState<AlmanacTag | "">("");

  const [entriesByMonth, setEntriesByMonth] = useState<Record<string, SerializableAlmanacEntry[]>>({
    [prefetchedMonth]: initialEntries,
  });
  const [loadingMonths, setLoadingMonths] = useState<Set<string>>(new Set());

  // ── Derived ──
  const selectedMonthStr = selectedDate.split("-")[0]!;
  const todayMonth = parseInt(todayMD.split("-")[0]!, 10);
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
      // Range mode — load all months in range
      for (const m of monthsInRange(dateRange.start, dateRange.end)) {
        if (!entriesByMonth[m]) void ensureMonthLoaded(m);
      }
    } else {
      // Single-date mode — load selected month + week neighbours
      if (!entriesByMonth[selectedMonthStr]) void ensureMonthLoaded(selectedMonthStr);
      const months = new Set(weekDays.map((d) => d.split("-")[0]!));
      for (const m of months) if (!entriesByMonth[m]) void ensureMonthLoaded(m);
    }
  }, [selectedMonthStr, weekDays, dateRange, entriesByMonth, ensureMonthLoaded]);

  // ── Entries computation ──
  // Single-date entries
  const entriesForDate = useMemo(
    () => (entriesByMonth[selectedMonthStr] ?? []).filter((e) => e.monthDay === selectedDate),
    [entriesByMonth, selectedMonthStr, selectedDate],
  );

  // Range entries
  const entriesForRange = useMemo(() => {
    if (!dateRange) return [];
    const months = monthsInRange(dateRange.start, dateRange.end);
    const allEntries: SerializableAlmanacEntry[] = [];
    for (const m of months) {
      const entries = entriesByMonth[m] ?? [];
      allEntries.push(...entries.filter((e) => isInRange(e.monthDay, dateRange.start, dateRange.end)));
    }
    // Sort by monthDay then year desc
    return allEntries.sort((a, b) => {
      if (a.monthDay !== b.monthDay) return a.monthDay < b.monthDay ? -1 : 1;
      return (b.year ?? 0) - (a.year ?? 0);
    });
  }, [dateRange, entriesByMonth]);

  // Which entries are we showing?
  const activeEntries = dateRange ? entriesForRange : entriesForDate;

  // Apply category filter
  const filteredEntries = useMemo(() => {
    if (!selectedTag) return activeEntries;
    return activeEntries.filter((e) => e.tags?.includes(selectedTag));
  }, [activeEntries, selectedTag]);

  // Holidays (single-date only; for range, show all in range)
  const activeHolidays = useMemo(() => {
    if (dateRange) {
      return allHolidays.filter((h) => isInRange(h.monthDay, dateRange.start, dateRange.end));
    }
    return allHolidays.filter((h) => h.monthDay === selectedDate);
  }, [allHolidays, selectedDate, dateRange]);

  // Tab counts
  const tabCounts: Record<HistoireTab, number> = useMemo(() => ({
    faits: activeEntries.length,
    personnalites: 0,
    fetes: activeHolidays.length,
  }), [activeEntries, activeHolidays]);

  // Entry counts for week strip
  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const md of weekDays) {
      const mStr = md.split("-")[0]!;
      counts[md] = (entriesByMonth[mStr] ?? []).filter((e) => e.monthDay === md).length;
    }
    return counts;
  }, [weekDays, entriesByMonth]);

  // ── Loading state ──
  const isLoading = dateRange
    ? monthsInRange(dateRange.start, dateRange.end).some((m) => loadingMonths.has(m))
    : loadingMonths.has(selectedMonthStr);

  // ── Handlers ──
  const handleWeekSelect = useCallback((md: string) => {
    setSelectedDate(md);
    setDateRange(null); // exit range mode
    setSelectedTag("");
    setActiveTab("faits");
  }, []);

  const handleRangeSelect = useCallback((range: DateRange) => {
    setDateRange(range);
    setSelectedTag("");
    setActiveTab("faits");
  }, []);

  const handleRangeClear = useCallback(() => {
    setDateRange(null);
  }, []);

  // ── Labels ──
  const dateLabel = dateRange
    ? formatRange(dateRange, lang)
    : formatMonthDay(selectedDate, lang);

  return (
    <div>
      {/* ── A) Hero date block ─────────────────────────────────────── */}
      <section className="mb-2 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
              {dateRange
                ? (fr ? "Période sélectionnée" : "Peryòd ou chwazi")
                : (fr ? "Date sélectionnée" : "Dat ou chwazi")}
            </p>
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-stone-900 dark:text-white sm:text-3xl">
              {dateRange && <CalendarRange className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
              {dateLabel}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
            <CalendarHeart className="h-4 w-4" />
            <span>
              {activeEntries.length} {fr ? "fait" : "reyalite"}{activeEntries.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Holiday banners */}
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
            showDate={!!dateRange}
          />
        ) : activeTab === "fetes" ? (
          activeHolidays.length > 0 ? (
            <div className="space-y-3">
              {activeHolidays.map((h) => (
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
                  {dateRange && (
                    <p className="mt-2 text-[11px] text-stone-400">
                      {formatMonthDay(h.monthDay, lang)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              lang={lang}
              dateLabel={dateLabel}
              hint={fr ? "Aucune fête enregistrée pour cette période." : "Pa gen fèt anrejistre pou peryòd sa a."}
            />
          )
        ) : (
          <EmptyState
            lang={lang}
            dateLabel={dateLabel}
            hint={fr ? "Les personnalités arrivent bientôt !" : "Pèsonalite yo ap vini byento !"}
          />
        )}

        {/* ── E) Explore accordion ───────────────────────────────── */}
        <ExplorePanel
          activeRange={dateRange}
          onRangeSelect={handleRangeSelect}
          onRangeClear={handleRangeClear}
          selectedTag={selectedTag}
          onTagChange={setSelectedTag}
          lang={lang}
          currentMonth={todayMonth}
        />
      </div>
    </div>
  );
}
