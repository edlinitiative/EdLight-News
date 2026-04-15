"use client";

/**
 * CalendarNav — premium monthly calendar strip for /histoire.
 *
 * Renders all days in the selected month as a horizontally-scrollable strip.
 * Features month-level navigation (prev/next), "Go to today" button,
 * auto-scroll to the selected date, and entry count dots per day.
 *
 * Uses burgundy accent for selected state and consistent editorial styling.
 */

import { useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { getDayLabel } from "./shared";

interface CalendarNavProps {
  days: string[];
  selectedDate: string;
  todayDate: string;
  onSelect: (day: string) => void;
  onMonthChange: (direction: "prev" | "next") => void;
  onGoToday: () => void;
  lang: ContentLanguage;
  entryCounts: Record<string, number>;
  monthName: string;
}

export function CalendarNav({
  days,
  selectedDate,
  todayDate,
  onSelect,
  onMonthChange,
  onGoToday,
  lang,
  entryCounts,
  monthName,
}: CalendarNavProps) {
  const fr = lang === "fr";
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const isOnToday = selectedDate === todayDate;
  const selectedMonth = selectedDate.split("-")[0]!;
  const todayMonth = todayDate.split("-")[0]!;

  // Auto-scroll to the selected date
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const element = selectedRef.current;
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const scrollLeft =
        element.offsetLeft -
        container.offsetLeft -
        containerRect.width / 2 +
        elementRect.width / 2;
      container.scrollTo({ left: scrollLeft, behavior: "smooth" });
    }
  }, [selectedDate]);

  return (
    <div className="sticky top-14 z-40 border-b border-stone-200/50 bg-white/92 backdrop-blur-xl dark:border-stone-700/30 dark:bg-stone-900/92">
      <div className="px-2 py-4">
        {/* ── Month selector row ────────────────────────── */}
        <div className="mb-3 flex items-center gap-2 px-1">
          <button
            onClick={() => onMonthChange("prev")}
            className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            aria-label={fr ? "Mois précédent" : "Mwa anvan"}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <h3 className="min-w-[100px] text-center font-serif text-lg font-bold capitalize text-[#1d1b1a] dark:text-white">
            {monthName}
          </h3>

          <button
            onClick={() => onMonthChange("next")}
            className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            aria-label={fr ? "Mois suivant" : "Pwochen mwa"}
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="flex-1" />

          {!isOnToday && (
            <button
              onClick={onGoToday}
              className="flex items-center gap-1.5 rounded-full border border-[#6f2438]/15 bg-[#6f2438]/5 px-3.5 py-1.5 text-sm font-medium text-[#6f2438] transition-colors hover:bg-[#6f2438]/10 dark:border-rose-400/15 dark:bg-rose-400/5 dark:text-rose-400 dark:hover:bg-rose-400/10"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              {fr ? "Aujourd\u2019hui" : "Jodi a"}
            </button>
          )}
        </div>

        {/* ── Day strip ─────────────────────────────────── */}
        <div
          ref={scrollRef}
          className="hide-scrollbar flex gap-1 overflow-x-auto px-1 pb-1"
          role="tablist"
          aria-label={fr ? "Sélection du jour" : "Chwazi jou"}
        >
          {days.map((day) => {
            const isToday = day === todayDate;
            const isSelected = day === selectedDate;
            const label = getDayLabel(day, lang);
            const count = entryCounts[day] ?? 0;

            return (
              <button
                key={day}
                ref={isSelected ? selectedRef : undefined}
                role="tab"
                aria-selected={isSelected}
                aria-label={`${label.dayName} ${label.dayNumber} ${label.monthName}${
                  count > 0
                    ? `, ${count} ${fr ? "événement" : "evènman"}${count > 1 ? "s" : ""}`
                    : ""
                }`}
                onClick={() => onSelect(day)}
                className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-2 transition-all duration-200 ${
                  isSelected
                    ? "bg-[#6f2438] text-white shadow-md"
                    : isToday && selectedMonth === todayMonth
                      ? "bg-[#6f2438]/8 text-[#6f2438] ring-1 ring-[#6f2438]/20 dark:bg-rose-400/8 dark:text-rose-400 dark:ring-rose-400/20"
                      : "text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-300"
                }`}
              >
                <span className="text-[9px] uppercase tracking-widest opacity-75">
                  {label.dayName.replace(".", "")}
                </span>
                <span className="text-sm font-bold leading-none">
                  {label.dayNumber}
                </span>
                {count > 0 ? (
                  <div className="mt-0.5 flex gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1 w-1 rounded-full ${
                          isSelected
                            ? "bg-white/60"
                            : "bg-[#6f2438] dark:bg-rose-400"
                        }`}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="mt-0.5 h-1" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
