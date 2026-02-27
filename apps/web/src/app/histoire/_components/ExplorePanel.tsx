"use client";

/**
 * ExplorePanel — collapsible advanced filtering panel.
 *
 * Provides:
 *  - "Choisir une date" (month + day dropdowns)
 *  - Category filter pills
 *
 * All filtering is client-side on already-fetched data.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, Search, Tag } from "lucide-react";
import type { ContentLanguage, AlmanacTag } from "@edlight-news/types";
import { TAG_LABELS, FILTER_TAGS, MONTH_NAMES_FR, MONTH_NAMES_HT } from "./shared";

interface ExplorePanelProps {
  selectedMonth: number; // 1-12
  selectedDay: number; // 1-31
  onDateChange: (month: number, day: number) => void;
  selectedTag: AlmanacTag | "";
  onTagChange: (tag: AlmanacTag | "") => void;
  lang: ContentLanguage;
}

export function ExplorePanel({
  selectedMonth,
  selectedDay,
  onDateChange,
  selectedTag,
  onTagChange,
  lang,
}: ExplorePanelProps) {
  const fr = lang === "fr";
  const [open, setOpen] = useState(false);

  const monthNames = fr ? MONTH_NAMES_FR : MONTH_NAMES_HT;
  const daysInMonth = new Date(2024, selectedMonth, 0).getDate(); // leap year safe

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800">
      {/* Toggle header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-stone-50 dark:hover:bg-stone-700/40"
      >
        <div className="flex items-center gap-2.5">
          <Search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-stone-900 dark:text-white">
            {fr ? "Explorer une autre date" : "Eksplore yon lòt dat"}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-stone-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-stone-400" />
        )}
      </button>

      {/* Collapsible body */}
      {open && (
        <div className="space-y-5 border-t border-stone-100 px-5 pb-5 pt-4 dark:border-stone-700/60">
          {/* Date pickers */}
          <div>
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
              {fr ? "Choisir une date" : "Chwazi yon dat"}
            </p>
            <div className="flex flex-wrap gap-3">
              {/* Month dropdown */}
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const newMonth = parseInt(e.target.value, 10);
                  const maxDay = new Date(2024, newMonth, 0).getDate();
                  onDateChange(newMonth, Math.min(selectedDay, maxDay));
                }}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm dark:border-stone-600 dark:bg-stone-700 dark:text-stone-200"
              >
                {monthNames.map((name, i) => (
                  <option key={i} value={i + 1}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </option>
                ))}
              </select>

              {/* Day dropdown */}
              <select
                value={selectedDay}
                onChange={(e) => onDateChange(selectedMonth, parseInt(e.target.value, 10))}
                className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm dark:border-stone-600 dark:bg-stone-700 dark:text-stone-200"
              >
                {Array.from({ length: daysInMonth }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Category filter pills */}
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
