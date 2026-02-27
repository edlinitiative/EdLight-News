"use client";

/**
 * WeekStrip — horizontally scrollable strip of 7 day pills
 * centred around today (±3 days).
 *
 * Clicking a pill updates the selected date in the parent.
 */

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
    <div className="relative">
      {/* Label */}
      <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
        {fr ? "Cette semaine" : "Semèn sa a"}
      </p>

      {/* Scrollable strip */}
      <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-2 scrollbar-none sm:justify-center sm:gap-2.5">
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
                "relative flex shrink-0 flex-col items-center rounded-2xl px-3.5 py-2.5 text-center transition-all " +
                (isSelected
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 dark:bg-blue-500"
                  : isToday
                    ? "border-2 border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300"
                    : "border border-stone-200 bg-white text-stone-600 hover:border-blue-200 hover:bg-blue-50/50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-blue-700")
              }
            >
              <span className={`text-[10px] font-semibold uppercase ${isSelected ? "text-white/80" : "text-stone-400 dark:text-stone-500"}`}>
                {label.dayName}
              </span>
              <span className={`text-lg font-bold leading-tight ${isSelected ? "" : ""}`}>
                {label.dayNumber}
              </span>
              <span className={`text-[10px] ${isSelected ? "text-white/70" : "text-stone-400 dark:text-stone-500"}`}>
                {label.monthName.slice(0, 3)}
              </span>

              {/* Dot indicator for days with content */}
              {count > 0 && !isSelected && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-bold text-white">
                  {count}
                </span>
              )}
              {count > 0 && isSelected && (
                <span className="mt-0.5 text-[9px] font-semibold text-white/80">
                  {count} {count === 1 ? (fr ? "fait" : "reyalite") : (fr ? "faits" : "reyalite")}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
