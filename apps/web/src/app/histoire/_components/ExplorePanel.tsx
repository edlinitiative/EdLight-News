"use client";

/**
 * ExplorePanel — collapsible date-range explorer + category filter.
 *
 * Features:
 *  - Quick presets: "Ce mois", "Mois prochain", "Mois précédent"
 *  - Custom range: start date → end date (max 1 month apart)
 *  - Active-range indicator with clear button
 *  - Category filter pills
 */

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Compass, Tag, X, CalendarRange } from "lucide-react";
import type { ContentLanguage, AlmanacTag } from "@edlight-news/types";
import {
  TAG_LABELS,
  FILTER_TAGS,
  MONTH_NAMES_FR,
  MONTH_NAMES_HT,
  daysInMonth,
  isRangeValid,
  formatRange,
  type DateRange,
} from "./shared";

interface ExplorePanelProps {
  /** Currently active range (null = single-date mode via WeekStrip) */
  activeRange: DateRange | null;
  onRangeSelect: (range: DateRange) => void;
  onRangeClear: () => void;
  selectedTag: AlmanacTag | "";
  onTagChange: (tag: AlmanacTag | "") => void;
  lang: ContentLanguage;
  /** 1-12, used for computing preset months */
  currentMonth: number;
}

export function ExplorePanel({
  activeRange,
  onRangeSelect,
  onRangeClear,
  selectedTag,
  onTagChange,
  lang,
  currentMonth,
}: ExplorePanelProps) {
  const fr = lang === "fr";
  const [open, setOpen] = useState(false);
  const monthNames = fr ? MONTH_NAMES_FR : MONTH_NAMES_HT;

  // ── Custom range local state ──
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [startDay, setStartDay] = useState(1);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [endDay, setEndDay] = useState(daysInMonth(currentMonth));

  const startMD = `${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;
  const endMD = `${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
  const customValid = isRangeValid(startMD, endMD);

  // ── Presets ──
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

  const presets = useMemo(
    () => [
      {
        label: fr ? "Mois précédent" : "Mwa pase",
        range: {
          start: `${String(prevMonth).padStart(2, "0")}-01`,
          end: `${String(prevMonth).padStart(2, "0")}-${String(daysInMonth(prevMonth)).padStart(2, "0")}`,
        } as DateRange,
      },
      {
        label: fr ? "Ce mois" : "Mwa sa a",
        range: {
          start: `${String(currentMonth).padStart(2, "0")}-01`,
          end: `${String(currentMonth).padStart(2, "0")}-${String(daysInMonth(currentMonth)).padStart(2, "0")}`,
        } as DateRange,
      },
      {
        label: fr ? "Mois prochain" : "Mwa pwochèn",
        range: {
          start: `${String(nextMonth).padStart(2, "0")}-01`,
          end: `${String(nextMonth).padStart(2, "0")}-${String(daysInMonth(nextMonth)).padStart(2, "0")}`,
        } as DateRange,
      },
    ],
    [fr, currentMonth, prevMonth, nextMonth],
  );

  const isPresetActive = (range: DateRange) =>
    activeRange?.start === range.start && activeRange?.end === range.end;

  const handleApplyCustom = () => {
    if (customValid) onRangeSelect({ start: startMD, end: endMD });
  };

  const selectCls =
    "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm font-medium text-stone-700 shadow-sm dark:border-stone-600 dark:bg-stone-700 dark:text-stone-200";

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-stone-50 dark:hover:bg-stone-700/40"
      >
        <div className="flex items-center gap-2.5">
          <Compass className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-stone-900 dark:text-white">
            {fr ? "Explorer une autre période" : "Eksplore yon lòt peryòd"}
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
        <div className="space-y-5 border-t border-stone-100 px-5 pb-5 pt-4 dark:border-stone-700/60">
          {/* ── Quick presets ─────────────────────────────────── */}
          <div>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
              {fr ? "Raccourcis" : "Rakousi"}
            </p>
            <div className="flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => onRangeSelect(p.range)}
                  className={
                    "rounded-xl px-3.5 py-2 text-xs font-semibold transition " +
                    (isPresetActive(p.range)
                      ? "bg-blue-600 text-white shadow-sm dark:bg-blue-500"
                      : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700")
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Custom date range ────────────────────────────── */}
          <div>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
              <CalendarRange className="mr-1 inline h-3 w-3" />
              {fr ? "Période personnalisée" : "Peryòd pèsonalize"}
            </p>

            <div className="space-y-3">
              {/* Start date */}
              <div className="flex items-center gap-2">
                <span className="w-8 text-xs font-medium text-stone-400">
                  {fr ? "Du" : "De"}
                </span>
                <select
                  value={startMonth}
                  onChange={(e) => {
                    const m = parseInt(e.target.value, 10);
                    setStartMonth(m);
                    setStartDay(Math.min(startDay, daysInMonth(m)));
                  }}
                  className={selectCls}
                >
                  {monthNames.map((name, i) => (
                    <option key={i} value={i + 1}>
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  value={startDay}
                  onChange={(e) => setStartDay(parseInt(e.target.value, 10))}
                  className={selectCls}
                >
                  {Array.from({ length: daysInMonth(startMonth) }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>

              {/* End date */}
              <div className="flex items-center gap-2">
                <span className="w-8 text-xs font-medium text-stone-400">
                  {fr ? "Au" : "A"}
                </span>
                <select
                  value={endMonth}
                  onChange={(e) => {
                    const m = parseInt(e.target.value, 10);
                    setEndMonth(m);
                    setEndDay(Math.min(endDay, daysInMonth(m)));
                  }}
                  className={selectCls}
                >
                  {monthNames.map((name, i) => (
                    <option key={i} value={i + 1}>
                      {name.charAt(0).toUpperCase() + name.slice(1)}
                    </option>
                  ))}
                </select>
                <select
                  value={endDay}
                  onChange={(e) => setEndDay(parseInt(e.target.value, 10))}
                  className={selectCls}
                >
                  {Array.from({ length: daysInMonth(endMonth) }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>

              {/* Validation + apply */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleApplyCustom}
                  disabled={!customValid}
                  className={
                    "rounded-xl px-4 py-2 text-xs font-semibold transition " +
                    (customValid
                      ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                      : "cursor-not-allowed bg-stone-100 text-stone-400 dark:bg-stone-700 dark:text-stone-500")
                  }
                >
                  {fr ? "Appliquer" : "Aplike"}
                </button>
                {!customValid && (
                  <p className="text-[11px] text-red-500 dark:text-red-400">
                    {fr ? "Max. 1 mois de portée" : "Maks. 1 mwa pòte"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Active range indicator ───────────────────────── */}
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
                {fr ? "Effacer" : "Efase"}
              </button>
            </div>
          )}

          {/* ── Category filter pills ────────────────────────── */}
          <div>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
              {fr ? "Catégorie" : "Kategori"}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onTagChange("")}
                className={
                  "rounded-xl px-3.5 py-1.5 text-xs font-semibold transition " +
                  (selectedTag === ""
                    ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                    : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700")
                }
              >
                {fr ? "Tous" : "Tout"}
              </button>
              {FILTER_TAGS.map((t) => {
                const tl = TAG_LABELS[t];
                const isActive = selectedTag === t;
                return (
                  <button
                    key={t}
                    onClick={() => onTagChange(isActive ? "" : t)}
                    className={
                      "inline-flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition " +
                      (isActive
                        ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                        : `border border-stone-200 bg-white hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 ${tl.color}`)
                    }
                  >
                    <Tag className="h-3 w-3" />
                    {fr ? tl.fr : tl.ht}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
