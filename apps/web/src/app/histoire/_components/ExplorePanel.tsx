"use client";

/**
 * ExplorePanel — lightweight month explorer accordion.
 *
 * Simplified UX:
 *   - 3 quick presets: Mois précédent · Ce mois · Mois prochain
 *   - Simple month dropdown for any month of the year
 *   - Active range indicator with clear button
 *
 * No complex custom date-range picker — month-level granularity is enough
 * for exploration, while the WeekStrip handles day-level navigation.
 */

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Compass, X } from "lucide-react";
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
  /** Currently active range (null = single-date mode via WeekStrip) */
  activeRange: DateRange | null;
  onRangeSelect: (range: DateRange) => void;
  onRangeClear: () => void;
  lang: ContentLanguage;
  /** 1-12, used for computing preset months */
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
  const [open, setOpen] = useState(false);
  const monthNames = fr ? MONTH_NAMES_FR : MONTH_NAMES_HT;

  // ── Presets ──
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

  // Active month for the dropdown (derives from activeRange if it's a full month)
  const activeMonthFromRange = useMemo(() => {
    if (!activeRange) return 0;
    const sm = parseInt(activeRange.start.split("-")[0]!, 10);
    const expected = monthRange(sm);
    if (activeRange.start === expected.start && activeRange.end === expected.end) return sm;
    return 0;
  }, [activeRange]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left transition hover:bg-stone-50 dark:hover:bg-stone-700/40"
      >
        <div className="flex items-center gap-2.5">
          <Compass className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-stone-900 dark:text-white">
            {fr ? "Explorer un autre mois" : "Eksplore yon lòt mwa"}
          </span>
          {activeRange && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {formatRange(activeRange, lang)}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-stone-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-stone-400" />
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-stone-100 px-5 pb-5 pt-4 dark:border-stone-700/60">
          {/* ── Presets + month dropdown — all on one row ── */}
          <div className="flex flex-wrap items-center gap-2">
            {presets.map((p) => (
              <button
                key={p.month}
                onClick={() => onRangeSelect(monthRange(p.month))}
                className={
                  "rounded-xl px-4 py-2 text-xs font-semibold transition " +
                  (isPresetActive(p.month)
                    ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                    : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700")
                }
              >
                {p.label}
              </button>
            ))}

            <span className="mx-1 text-xs font-medium text-stone-300 dark:text-stone-600">
              {fr ? "ou" : "oswa"}
            </span>

            <select
              value={activeMonthFromRange}
              onChange={(e) => {
                const m = parseInt(e.target.value, 10);
                if (m >= 1 && m <= 12) onRangeSelect(monthRange(m));
              }}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 shadow-sm transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            >
              <option value={0} disabled>
                {fr ? "Choisir un mois…" : "Chwazi yon mwa…"}
              </option>
              {monthNames.map((name, i) => (
                <option key={i} value={i + 1}>
                  {name.charAt(0).toUpperCase() + name.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* ── Active range indicator ────────────────── */}
          {activeRange && (
            <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-2.5 dark:bg-blue-900/20">
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                📅 {formatRange(activeRange, lang)}
              </span>
              <button
                onClick={onRangeClear}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                <X className="h-3 w-3" />
                {fr ? "Revenir à aujourd\u2019hui" : "Retounen jodi a"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
