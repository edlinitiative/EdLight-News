"use client";

/**
 * DateNavigator — data-driven sticky horizontal date navigation strip.
 *
 * Replaces the old WeekStrip with the editorial frosted-glass design.
 * Accepts pre-computed day strings from getWeekAroundDate and renders
 * an accessible tablist of date buttons centred on "today".
 */

import { CalendarCheck } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { getDayLabel } from "./shared";

interface DateNavigatorProps {
  days: string[];                        // MM-DD strings from getWeekAroundDate (7 items)
  selectedDate: string;                  // currently selected MM-DD
  todayDate: string;                     // today's MM-DD
  onSelect: (monthDay: string) => void;
  lang: ContentLanguage;
  entryCounts?: Record<string, number>;
}

export function DateNavigator({
  days,
  selectedDate,
  todayDate,
  onSelect,
  lang,
  entryCounts,
}: DateNavigatorProps) {
  const fr = lang === "fr";

  return (
    <section
      id="date-nav"
      className="sticky top-14 z-40 border-y border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-stone-700/40 dark:bg-stone-900/80"
    >
      <div className="py-5">
        {/* ── Header row ─────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#464555]/70 dark:text-stone-500">
              {fr ? "Navigation temporelle" : "Navigasyon tanporèl"}
            </p>
            <p className="mt-1 text-sm text-[#464555] dark:text-stone-400">
              {fr
                ? "Parcourez les jours et les repères du mois"
                : "Navige nan jou yo ak repè mwa a"}
            </p>
          </div>

          {selectedDate !== todayDate && (
            <button
              type="button"
              onClick={() => onSelect(todayDate)}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-black/5 bg-white px-3.5 py-2 text-sm font-medium text-[#3525cd] transition-colors hover:bg-[#f3ecea] dark:border-stone-700 dark:bg-stone-800 dark:text-indigo-400 dark:hover:bg-stone-700"
            >
              <CalendarCheck className="h-4 w-4" />
              {fr ? "Aujourd\u2019hui" : "Jodi a"}
            </button>
          )}
        </div>

        {/* ── Date items strip ────────────────────────────────── */}
        <div
          className="hide-scrollbar flex items-end gap-4 overflow-x-auto py-1 sm:grid sm:grid-cols-7 sm:gap-0"
          role="tablist"
          aria-label={fr ? "Sélection de la date" : "Chwazi dat la"}
        >
          {days.map((day) => {
            const isToday = day === todayDate;
            const isSelected = day === selectedDate;
            const label = getDayLabel(day, lang);
            const count = entryCounts?.[day] ?? 0;

            return isToday ? (
              <TodayPill
                key={day}
                day={day}
                label={label}
                isSelected={isSelected}
                count={count}
                lang={lang}
                onSelect={onSelect}
              />
            ) : (
              <DateCircle
                key={day}
                day={day}
                label={label}
                isSelected={isSelected}
                count={count}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Sub-components ────────────────────────────────────────── */

interface DayLabel {
  dayName: string;
  dayNumber: number;
  monthName: string;
  monthDay: string;
}

/* ── DateCircle ──────────────────────────────────────────────── */

function DateCircle({
  day,
  label,
  isSelected,
  count,
  onSelect,
}: {
  day: string;
  label: DayLabel;
  isSelected: boolean;
  count: number;
  onSelect: (monthDay: string) => void;
}) {
  const ariaLabel = `${label.dayName} ${label.dayNumber} ${label.monthName}${count > 0 ? `, ${count} entrée${count > 1 ? "s" : ""}` : ""}`;

  return (
    <button
      role="tab"
      aria-selected={isSelected}
      aria-label={ariaLabel}
      onClick={() => onSelect(day)}
      className="flex min-w-[84px] shrink-0 flex-col items-center gap-1 text-[#464555]/60 transition-colors dark:text-stone-500"
    >
      {/* Day name abbreviation */}
      <span className="mb-1 text-[11px] uppercase tracking-[0.18em]">
        {label.dayName}
      </span>

      {/* Circle with day number */}
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full border text-base font-semibold transition-colors ${
          isSelected
            ? "border-transparent bg-stone-900 text-white shadow-md dark:bg-white dark:text-stone-900"
            : "border-[#cfc5be] hover:border-[#3525cd] hover:text-[#3525cd] dark:border-stone-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400"
        }`}
      >
        {label.dayNumber}
      </div>

      {/* Entry-count dots */}
      <EntryDots count={count} />
    </button>
  );
}

/* ── TodayPill ───────────────────────────────────────────────── */

function TodayPill({
  day,
  label,
  isSelected,
  count,
  lang,
  onSelect,
}: {
  day: string;
  label: DayLabel;
  isSelected: boolean;
  count: number;
  lang: ContentLanguage;
  onSelect: (monthDay: string) => void;
}) {
  const fr = lang === "fr";
  const ariaLabel = `${fr ? "Aujourd\u2019hui" : "Jodi a"}, ${label.dayName} ${label.dayNumber} ${label.monthName}${count > 0 ? `, ${count} entrée${count > 1 ? "s" : ""}` : ""}`;

  return (
    <button
      role="tab"
      aria-selected={isSelected}
      aria-label={ariaLabel}
      onClick={() => onSelect(day)}
      className="min-w-[108px] shrink-0 rounded-[1.25rem] bg-[#3525cd] px-4 py-4 text-white shadow-[0_10px_30px_rgba(29,27,26,0.05)] transition-shadow hover:shadow-[0_10px_30px_rgba(53,37,205,0.18)]"
    >
      {/* "Today" label */}
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] opacity-75">
        {fr ? "Aujourd\u2019hui" : "Jodi a"}
      </p>

      {/* Day number + month abbreviation */}
      <div className="flex items-end justify-between gap-3">
        <span className="font-display text-3xl font-extrabold leading-none">
          {label.dayNumber}
        </span>
        <span className="text-sm uppercase tracking-[0.18em] opacity-85">
          {label.monthName.slice(0, 3)}.
        </span>
      </div>

      {/* Entry-count dots (white) */}
      {count > 0 && (
        <div className="mt-2 flex justify-center gap-1">
          {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
            <span
              key={i}
              className="inline-block h-1.5 w-1.5 rounded-full bg-white/60"
            />
          ))}
        </div>
      )}
    </button>
  );
}

/* ── EntryDots ───────────────────────────────────────────────── */

function EntryDots({ count }: { count: number }) {
  if (count <= 0) return <div className="h-3" />;

  return (
    <div className="flex h-3 items-center justify-center gap-1">
      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-[#3525cd] dark:bg-indigo-400"
        />
      ))}
    </div>
  );
}
