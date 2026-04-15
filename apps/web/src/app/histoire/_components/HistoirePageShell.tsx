"use client";

/**
 * HistoirePageShell — premium client orchestrator for /histoire.
 *
 * Rebuilt from scratch with a focus on:
 *   ① HeroSection — cinematic full-bleed image + serif headline
 *   ② CalendarNav — full-month scrollable day strip with month navigation
 *   ③ HolidayBanner — elegant holiday ribbons
 *   ④ EventCard grid — clickable cards with hover effects
 *   ⑤ EventDetailPanel — slide-in panel with full event content
 *
 * All content is data-driven from Firestore. Month-level lazy loading
 * via /api/histoire/archive. URL state sync for deep linking.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { ContentLanguage } from "@edlight-news/types";
import { HeroSection } from "./HeroSection";
import { CalendarNav } from "./CalendarNav";
import { EventCard } from "./EventCard";
import { EventDetailPanel } from "./EventDetailPanel";
import { HolidayBanner } from "./HolidayBanner";
import {
  pickHeroEntry,
  formatMonthDay,
  getHaitiMonthDayClient,
  daysInMonth,
  MONTH_NAMES_FR,
  MONTH_NAMES_HT,
} from "./shared";
import type { SerializableAlmanacEntry, SerializableHoliday } from "./shared";

interface HistoirePageShellProps {
  todayMD: string;
  monthEntries: SerializableAlmanacEntry[];
  allHolidays: SerializableHoliday[];
  prefetchedMonth: string;
  lang: ContentLanguage;
}

export function HistoirePageShell({
  todayMD,
  monthEntries: initialEntries,
  allHolidays,
  prefetchedMonth,
  lang,
}: HistoirePageShellProps) {
  const fr = lang === "fr";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── State ─────────────────────────────────────────────────
  const initialDate = searchParams.get("date") ?? todayMD;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [liveTodayMD, setLiveTodayMD] = useState(todayMD);
  const [selectedEvent, setSelectedEvent] =
    useState<SerializableAlmanacEntry | null>(null);

  const [entriesByMonth, setEntriesByMonth] = useState<
    Record<string, SerializableAlmanacEntry[]>
  >({ [prefetchedMonth]: initialEntries });
  const [loadingMonths, setLoadingMonths] = useState<Set<string>>(new Set());
  const entriesByMonthRef = useRef(entriesByMonth);
  entriesByMonthRef.current = entriesByMonth;

  // ── Client-side today sync ────────────────────────────────
  useEffect(() => {
    const clientToday = getHaitiMonthDayClient();
    if (clientToday !== todayMD) {
      setLiveTodayMD(clientToday);
      if (!searchParams.get("date")) setSelectedDate(clientToday);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── URL sync ──────────────────────────────────────────────
  const updateURL = useCallback(
    (date: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (date === liveTodayMD) params.delete("date");
      else params.set("date", date);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams, liveTodayMD],
  );

  // ── Lazy month fetch ──────────────────────────────────────
  const ensureMonthLoaded = useCallback(async (monthStr: string) => {
    if (entriesByMonthRef.current[monthStr]) return;
    setLoadingMonths((prev) => new Set(prev).add(monthStr));
    try {
      const res = await fetch(`/api/histoire/archive?month=${monthStr}`);
      if (res.ok) {
        const data = await res.json();
        setEntriesByMonth((prev) => ({ ...prev, [monthStr]: data.entries }));
      }
    } catch {
      /* network error — silently degrade */
    } finally {
      setLoadingMonths((prev) => {
        const next = new Set(prev);
        next.delete(monthStr);
        return next;
      });
    }
  }, []);

  const selectedMonth = selectedDate.split("-")[0]!;

  useEffect(() => {
    void ensureMonthLoaded(selectedMonth);
  }, [selectedMonth, ensureMonthLoaded]);

  // ── Derived data ──────────────────────────────────────────
  const currentMonthEntries = useMemo(
    () => entriesByMonth[selectedMonth] ?? [],
    [entriesByMonth, selectedMonth],
  );

  const todayEntries = useMemo(
    () => currentMonthEntries.filter((e) => e.monthDay === selectedDate),
    [currentMonthEntries, selectedDate],
  );

  const heroEntry = useMemo(
    () => pickHeroEntry(todayEntries),
    [todayEntries],
  );

  const isLoading = loadingMonths.has(selectedMonth);

  // Calendar days for selected month
  const calendarDays = useMemo(() => {
    const monthNum = parseInt(selectedMonth, 10);
    const numDays = daysInMonth(monthNum);
    return Array.from({ length: numDays }, (_, i) =>
      `${selectedMonth}-${String(i + 1).padStart(2, "0")}`,
    );
  }, [selectedMonth]);

  // Entry counts per day
  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const day of calendarDays) {
      counts[day] = currentMonthEntries.filter((e) => e.monthDay === day).length;
    }
    return counts;
  }, [calendarDays, currentMonthEntries]);

  // Holidays for selected date
  const todayHolidays = useMemo(
    () => allHolidays.filter((h) => h.monthDay === selectedDate),
    [allHolidays, selectedDate],
  );

  // Labels
  const monthNames = fr ? MONTH_NAMES_FR : MONTH_NAMES_HT;
  const monthName = monthNames[parseInt(selectedMonth, 10) - 1] ?? "";
  const dateLabel = formatMonthDay(selectedDate, lang);
  const todayLabel = formatMonthDay(liveTodayMD, lang);

  // ── Handlers ──────────────────────────────────────────────
  const handleMonthChange = useCallback(
    (direction: "prev" | "next") => {
      const m = parseInt(selectedMonth, 10);
      const newM =
        direction === "prev"
          ? m === 1
            ? 12
            : m - 1
          : m === 12
            ? 1
            : m + 1;
      const newDate = `${String(newM).padStart(2, "0")}-01`;
      setSelectedDate(newDate);
      updateURL(newDate);
    },
    [selectedMonth, updateURL],
  );

  const handleDaySelect = useCallback(
    (day: string) => {
      setSelectedDate(day);
      updateURL(day);
    },
    [updateURL],
  );

  const handleGoToday = useCallback(() => {
    setSelectedDate(liveTodayMD);
    updateURL(liveTodayMD);
  }, [liveTodayMD, updateURL]);

  // ── Render ────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-0">
        {/* ① Cinematic hero */}
        <HeroSection
          lang={lang}
          heroEntry={heroEntry}
          todayLabel={todayLabel}
          totalEvents={currentMonthEntries.length}
          onReadMore={heroEntry ? () => setSelectedEvent(heroEntry) : undefined}
        />

        {/* ② Calendar navigation */}
        <CalendarNav
          days={calendarDays}
          selectedDate={selectedDate}
          todayDate={liveTodayMD}
          onSelect={handleDaySelect}
          onMonthChange={handleMonthChange}
          onGoToday={handleGoToday}
          lang={lang}
          entryCounts={entryCounts}
          monthName={monthName}
        />

        {/* ③ Holiday ribbons */}
        {todayHolidays.length > 0 && (
          <div className="px-1 pt-8">
            <div className="flex flex-wrap gap-3">
              {todayHolidays.map((h) => (
                <HolidayBanner key={h.id} holiday={h} lang={lang} />
              ))}
            </div>
          </div>
        )}

        {/* ④ Events for selected date */}
        <section className="pb-20 pt-12">
          {/* Section header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="h-px w-6 bg-[#6f2438] dark:bg-rose-400"
                  aria-hidden="true"
                />
                <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#6f2438] dark:text-rose-400">
                  {fr ? "Événements historiques" : "Evènman istorik"}
                </span>
              </div>
              <h2 className="font-serif text-2xl font-bold text-[#1d1b1a] dark:text-white md:text-3xl">
                {dateLabel}
              </h2>
            </div>
            {!isLoading && todayEntries.length > 0 && (
              <span className="rounded-full border border-[#6f2438]/15 bg-[#6f2438]/5 px-3.5 py-1.5 text-sm font-medium text-[#6f2438] dark:border-rose-400/15 dark:bg-rose-400/5 dark:text-rose-400">
                {todayEntries.length}{" "}
                {fr
                  ? todayEntries.length === 1
                    ? "fait"
                    : "faits"
                  : "reyalite"}
              </span>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <LoadingSkeleton />
          ) : todayEntries.length === 0 ? (
            <EmptyDateState
              dateLabel={dateLabel}
              lang={lang}
              showGoToday={selectedDate !== liveTodayMD}
              onGoToday={handleGoToday}
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {todayEntries.map((entry, i) => (
                <EventCard
                  key={entry.id}
                  entry={entry}
                  lang={lang}
                  onClick={() => setSelectedEvent(entry)}
                  index={i}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ⑤ Event detail slide-over */}
      <EventDetailPanel
        event={selectedEvent}
        lang={lang}
        onClose={() => setSelectedEvent(null)}
      />
    </>
  );
}

/* ── Inline sub-components ──────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl border border-stone-200/40 bg-white dark:border-stone-700/20 dark:bg-stone-800/50"
        >
          <div className="aspect-[16/10] bg-stone-100 dark:bg-stone-700" />
          <div className="space-y-3 p-5">
            <div className="h-3 w-16 rounded-full bg-stone-100 dark:bg-stone-700" />
            <div className="h-5 w-3/4 rounded bg-stone-200 dark:bg-stone-600" />
            <div className="h-3 w-full rounded bg-stone-100 dark:bg-stone-700" />
            <div className="h-3 w-2/3 rounded bg-stone-100 dark:bg-stone-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyDateState({
  dateLabel,
  lang,
  showGoToday,
  onGoToday,
}: {
  dateLabel: string;
  lang: ContentLanguage;
  showGoToday: boolean;
  onGoToday: () => void;
}) {
  const fr = lang === "fr";
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300/50 bg-stone-50/40 py-20 text-center dark:border-stone-700/30 dark:bg-stone-800/20">
      <span className="mb-4 text-5xl">📜</span>
      <h3 className="mb-2 font-serif text-xl font-bold text-stone-700 dark:text-stone-300">
        {fr ? "Aucun événement répertorié" : "Pa gen evènman"}
      </h3>
      <p className="mb-6 max-w-md text-sm text-stone-500 dark:text-stone-400">
        {fr
          ? `Aucun fait historique n'est encore répertorié pour le ${dateLabel}. Explorez d'autres dates.`
          : `Pa gen okenn reyalite istorik ki anrejistre pou ${dateLabel}. Eksplore lòt dat.`}
      </p>
      {showGoToday && (
        <button
          onClick={onGoToday}
          className="rounded-full bg-[#6f2438] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#8a2d47]"
        >
          {fr ? "Revenir à aujourd\u2019hui" : "Retounen jodi a"}
        </button>
      )}
    </div>
  );
}
