"use client";

/**
 * ExplorePanel — month-level navigator with visual presence.
 *
 * Redesigned: contained card with presets + dropdown, big enough
 * touch targets, prominent enough to discover without burying at bottom.
 */

import { useMemo } from "react";
import { CalendarDays, Compass, X } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import {
  MONTH_NAMES_FR,
  MONTH_NAMES_HT,
  daysInMonth,
  formatRange,
  type DateRange,
} from "./shared";

/** Build a full-month DateRange for a 1-indexed month. */
function monthRange(month: number): DateRange {
  const mm = String(month).padStart(2, "0");
  return { start: `${mm}-01`, end: `${mm}-${String(daysInMonth(month)).padStart(2, "0")}` };
}

interface ExplorePanelProps {
  activeRange: DateRange | null;
  onRangeSelect: (range: DateRange) => void;
  onRangeClear: () => void;
  lang: ContentLanguage;
  currentMonth: number;
}

export function ExplorePanel({
  activeRange,
  onRangeSelect,
  onRangeClear,
  lang,
  currentMonth,
}: ExplorePanelProps) {
  const fr = lang === "fr";
  const monthNames = fr ? MONTH_NAMES_FR : MONTH_NAMES_HT;

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  const presets = useMemo(
    () => [
      { label: fr ? "Mois précédent" : "Mwa pase", month: prevMonth },
      { label: fr ? "Ce mois" : "Mwa sa a", month: currentMonth },
      { label: fr ? "Mois prochain" : "Mwa pwochèn", month: nextMonth },
    ],
    [fr, currentMonth, prevMonth, nextMonth],
  );

  const isPresetActive = (month: number) => {
    const r = monthRange(month);
    return activeRange?.start === r.start && activeRange?.end === r.end;
  };

  const activeMonthFromRange = useMemo(() => {
    if (!activeRange) return 0;
    const sm = parseInt(activeRange.start.split("-")[0]!, 10);
    const expected = monthRange(sm);
    if (activeRange.start === expected.start && activeRange.end === expected.end) return sm;
    return 0;
  }, [activeRange]);

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-700/60 dark:bg-stone-800/60 sm:p-5">
      <div className="flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-stone-400 dark:text-stone-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              {fr ? "Explorer par mois" : "Eksplore pa mwa"}
            </span>
          </div>
          {/* Active range banner */}
          {activeRange && (
            <button
              onClick={onRangeClear}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
            >
              <CalendarDays className="h-3 w-3" />
              {formatRange(activeRange, lang)}
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <button
              key={p.month}
              onClick={() => onRangeSelect(monthRange(p.month))}
              className={
                "rounded-lg px-3.5 py-2 text-xs font-semibold transition " +
                (isPresetActive(p.month)
                  ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                  : "bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-800 dark:bg-stone-700/50 dark:text-stone-300 dark:hover:bg-stone-700 dark:hover:text-white")
              }
            >
              {p.label}
            </button>
          ))}

          <span className="text-stone-200 dark:text-stone-700">·</span>

          <select
            value={activeMonthFromRange}
            onChange={(e) => {
              const m = parseInt(e.target.value, 10);
              if (m >= 1 && m <= 12) onRangeSelect(monthRange(m));
            }}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-stone-600"
          >
            <option value={0} disabled>
              {fr ? "Autre mois…" : "Lòt mwa…"}
            </option>
            {monthNames.map((name, i) => (
              <option key={i} value={i + 1}>
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
