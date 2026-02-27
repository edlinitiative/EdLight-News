"use client";

/**
 * WeekStrip — horizontally scrollable strip of 7 day pills
 * centred around today (±3 days).
 *
 * Clicking a pill updates the selected date in the parent.
 */

import { CalendarDays } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { getDayLabel } from "./shared";

interface WeekStripProps {
  days: string[]; // array of MM-DD
  selectedDate: string; // MM-DD
  todayDate: string; // MM-DD
  onSelect: (monthDay: string) => void;
  lang: ContentLanguage;
  /** Map of MM-DD → count of entries, for showing dot indicators */
  entryCounts?: Record<string, number>;
}

export function WeekStrip({
  days,
  selectedDate,
  todayDate,
  onSelect,
  lang,
  entryCounts,
}: WeekStripProps) {
  const fr = lang === "fr";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-800/80 sm:p-5">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <p className="text-xs font-bold uppercase tracking-widest text-stone-900 dark:text-white">
            {fr ? "Cette semaine" : "Semèn sa a"}
          </p>
        </div>
        {selectedDate !== todayDate && (
          <button
            onClick={() => onSelect(todayDate)}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {fr ? "Aujourd\u2019hui" : "Jodi a"}
          </button>
        )}
      </div>

      {/* Day pills row */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none sm:gap-0 sm:justify-between">
        {days.map((md) => {
          const label = getDayLabel(md, lang);
          const isSelected = md === selectedDate;
          const isToday = md === todayDate;
          const count = entryCounts?.[md] ?? 0;

          return (
            <button
              key={md}
              onClick={() => onSelect(md)}
              className={
                "group relative flex shrink-0 flex-col items-center rounded-xl px-3 py-2 text-center transition-all sm:flex-1 sm:px-1 " +
                (isSelected
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 dark:bg-blue-500"
                  : isToday
                    ? "bg-blue-50 text-blue-700 ring-2 ring-blue-400/50 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-500/40"
                    : "text-stone-500 hover:bg-stone-50 dark:text-stone-400 dark:hover:bg-stone-700/40")
              }
            >
              {/* Day name */}
              <span
                className={
                  "text-[10px] font-semibold uppercase tracking-wide " +
                  (isSelected
                    ? "text-blue-100"
                    : "text-stone-400 dark:text-stone-500")
                }
              >
                {label.dayName.replace(".", "")}
              </span>

              {/* Day number — large and prominent */}
              <span className="text-xl font-bold leading-tight">
                {label.dayNumber}
              </span>

              {/* Month abbreviation */}
              <span
                className={
                  "text-[10px] font-medium " +
                  (isSelected
                    ? "text-blue-200"
                    : "text-stone-400 dark:text-stone-500")
                }
              >
                {label.monthName.slice(0, 3)}.
              </span>

              {/* Count badge — floating dot */}
              {count > 0 && !isSelected && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white shadow-sm dark:bg-blue-500">
                  {count}
                </span>
              )}

              {/* Count label under selected pill */}
              {count > 0 && isSelected && (
                <span className="mt-0.5 rounded-full bg-white/20 px-2 py-0.5 text-[9px] font-semibold leading-none">
                  {count}
                </span>
              )}

              {/* Today dot indicator */}
              {isToday && !isSelected && (
                <span className="mt-1 h-1 w-1 rounded-full bg-blue-500 dark:bg-blue-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
