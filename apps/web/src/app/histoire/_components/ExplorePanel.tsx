"use client";

/**
 * ExplorePanel — minimal inline month navigator.
 *
 * No accordion, no box — just a quiet row of controls that lets users
 * jump to another month without dominating the page. Feels like part of
 * the editorial footer rather than a separate "section".
 */

import { useMemo } from "react";
import { X } from "lucide-react";
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
    <div className="flex flex-col gap-3">
      {/* Active range banner — only when browsing a different month */}
      {activeRange && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
            📅 {formatRange(activeRange, lang)}
          </span>
          <button
            onClick={onRangeClear}
            className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-medium text-stone-500 transition hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700"
          >
            <X className="h-2.5 w-2.5" />
            {fr ? "Aujourd\u2019hui" : "Jodi a"}
          </button>
        </div>
      )}

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
          {fr ? "Explorer" : "Eksplore"}
        </span>

        {presets.map((p) => (
          <button
            key={p.month}
            onClick={() => onRangeSelect(monthRange(p.month))}
            className={
              "rounded-full px-3 py-1.5 text-[11px] font-semibold transition " +
              (isPresetActive(p.month)
                ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                : "text-stone-500 hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200")
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
          className="rounded-full bg-transparent px-2 py-1.5 text-[11px] font-semibold text-stone-500 transition hover:bg-stone-100 hover:text-stone-700 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
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
  );
}
