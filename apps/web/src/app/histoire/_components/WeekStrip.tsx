"use client";

/**
 * WeekStrip — clean 7-day calendar strip centred on today.
 *
 * Design: minimal two-line pills (day abbreviation + number),
 * small dots below to indicate entry count. Feels like a
 * native calendar week selector.
 */

import type { ContentLanguage } from "@edlight-news/types";
import { getDayLabel, MONTH_NAMES_FR, MONTH_NAMES_HT } from "./shared";

interface WeekStripProps {
  days: string[];          // array of MM-DD
  selectedDate: string;    // MM-DD
  todayDate: string;       // MM-DD
  onSelect: (monthDay: string) => void;
  lang: ContentLanguage;
  entryCounts?: Record<string, number>;
}

/** Build a human-readable date-range label, e.g. "24 fév. – 2 mars" */
function rangeLabel(days: string[], lang: ContentLanguage): string {
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const mNames = lang === "fr" ? MONTH_NAMES_FR : MONTH_NAMES_HT;

  const [m1, d1] = first.split("-");
  const [m2, d2] = last.split("-");
  const month1 = mNames[parseInt(m1!, 10) - 1]?.slice(0, 3) ?? m1;
  const month2 = mNames[parseInt(m2!, 10) - 1]?.slice(0, 3) ?? m2;

  if (m1 === m2) return `${parseInt(d1!, 10)} – ${parseInt(d2!, 10)} ${month2}.`;
  return `${parseInt(d1!, 10)} ${month1}. – ${parseInt(d2!, 10)} ${month2}.`;
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
    <section className="space-y-3">
      {/* Header: range + today reset */}
      <div className="flex items-baseline justify-between px-1">
        <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
          {rangeLabel(days, lang)}
        </p>
        {selectedDate !== todayDate && (
          <button
            onClick={() => onSelect(todayDate)}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            {fr ? "Aujourd\u2019hui" : "Jodi a"}
          </button>
        )}
      </div>

      {/* Pills */}
      <div className="grid grid-cols-7 gap-1">
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
                "flex flex-col items-center gap-0.5 rounded-xl py-2 transition-colors " +
                (isSelected
                  ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                  : isToday
                    ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-700/50")
              }
            >
              {/* Day abbreviation — 3 letters, no dot */}
              <span
                className={
                  "text-[11px] font-medium uppercase " +
                  (isSelected
                    ? "text-blue-200"
                    : isToday
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-stone-400 dark:text-stone-500")
                }
              >
                {label.dayName.replace(".", "")}
              </span>

              {/* Day number */}
              <span className="text-lg font-bold leading-none">
                {label.dayNumber}
              </span>

              {/* Entry-count dots (max 3 visible) */}
              <span className="mt-0.5 flex h-1.5 items-center gap-[3px]">
                {count > 0 &&
                  Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <span
                      key={i}
                      className={
                        "inline-block h-1 w-1 rounded-full " +
                        (isSelected
                          ? "bg-white/70"
                          : "bg-blue-500 dark:bg-blue-400")
                      }
                    />
                  ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
