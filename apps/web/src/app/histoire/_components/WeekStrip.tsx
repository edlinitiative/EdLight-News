"use client";

/**
 * WeekStrip — sticky 7-day calendar strip below the site header.
 *
 * Primary navigation control for the /histoire page.
 * Sticky with frosted backdrop, horizontal-scroll on mobile,
 * grid-cols-7 on desktop. ARIA tablist for accessibility.
 */

import { CalendarCheck } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { getDayLabel } from "./shared";

interface WeekStripProps {
  days: string[];
  selectedDate: string;
  todayDate: string;
  onSelect: (monthDay: string) => void;
  lang: ContentLanguage;
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
  const isOnToday = selectedDate === todayDate;

  return (
    <div className="sticky top-14 z-40 -mx-4 border-b border-stone-200/60 bg-stone-50/80 px-4 py-3 backdrop-blur-xl dark:border-stone-700/40 dark:bg-[#0c0a09]/80 sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-2">
        {/* Day pills — scrollable on mobile, grid on desktop */}
        <div
          role="tablist"
          aria-label={fr ? "Sélection du jour" : "Seleksyon jou"}
          className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-none sm:grid sm:grid-cols-7 sm:gap-1.5 sm:overflow-visible"
        >
          {days.map((md) => {
            const label = getDayLabel(md, lang);
            const isSelected = md === selectedDate;
            const isToday = md === todayDate;
            const count = entryCounts?.[md] ?? 0;

            return (
              <button
                key={md}
                role="tab"
                aria-selected={isSelected}
                aria-label={`${label.dayName} ${label.dayNumber} ${label.monthName}${count > 0 ? ` — ${count} ${fr ? "fait" : "reyalite"}${count > 1 ? "s" : ""}` : ""}`}
                onClick={() => onSelect(md)}
                className={
                  "flex shrink-0 flex-col items-center gap-0.5 rounded-2xl px-4 py-2.5 transition-all sm:px-0 " +
                  (isSelected
                    ? "bg-blue-600 text-white shadow-md ring-1 ring-blue-500/30 dark:bg-blue-500"
                    : isToday
                      ? "bg-blue-600/10 text-blue-700 ring-1 ring-blue-500/20 dark:bg-blue-500/15 dark:text-blue-300"
                      : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800")
                }
              >
                <span
                  className={
                    "text-[10px] font-semibold uppercase tracking-wider " +
                    (isSelected
                      ? "text-blue-200"
                      : isToday
                        ? "text-blue-500 dark:text-blue-400"
                        : "text-stone-400 dark:text-stone-500")
                  }
                >
                  {label.dayName.replace(".", "")}
                </span>
                <span className="text-lg font-bold leading-none">{label.dayNumber}</span>
                {/* Entry dots (max 3) */}
                <span className="mt-0.5 flex h-1.5 items-center gap-[3px]">
                  {count > 0 &&
                    Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span
                        key={i}
                        className={
                          "inline-block h-1 w-1 rounded-full " +
                          (isSelected ? "bg-white/70" : "bg-blue-400/70 dark:bg-blue-400/50")
                        }
                      />
                    ))}
                </span>
              </button>
            );
          })}
        </div>

        {/* "Today" button — appears when navigated away */}
        {!isOnToday && (
          <button
            onClick={() => onSelect(todayDate)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-600/10 px-3 py-2 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25"
          >
            <CalendarCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{fr ? "Aujourd\u2019hui" : "Jodi a"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
