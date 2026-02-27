"use client";

/**
 * MiniMonthGrid — desktop sidebar calendar widget (xl+ only).
 *
 * Dots mark days that have events. Clicking a dot-day scrolls the main
 * timeline to the corresponding cal-day-YYYY-MM-DD anchor.
 */

import { useState } from "react";
import type { ContentLanguage } from "@edlight-news/types";
import type { CalendarItem } from "./types";
import { getItemDateISO } from "./types";
import { parseISODateSafe } from "@/lib/deadlines";

interface Props {
  items: CalendarItem[];
  lang: ContentLanguage;
}

const DAY_HEADERS = ["L", "M", "M", "J", "V", "S", "D"] as const;

export function MiniMonthGrid({ items, lang }: Props) {
  const fr = lang === "fr";
  const today = new Date();

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Collect days that have events in the viewed month
  const eventDays = new Set<number>();
  for (const item of items) {
    const dateISO = getItemDateISO(item);
    if (!dateISO) continue;
    const d = parseISODateSafe(dateISO);
    if (!d) continue;
    if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
      eventDays.add(d.getDate());
    }
  }

  // Build Monday-first grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const offsetMon = (firstDay.getDay() + 6) % 7; // 0=Mon … 6=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(offsetMon).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = firstDay.toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
    month: "long",
    year: "numeric",
  });

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const scrollToDay = (day: number) => {
    const iso = [
      viewYear,
      String(viewMonth + 1).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-");
    document.getElementById(`cal-day-${iso}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  const todayDay = today.getDate();
  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  return (
    <aside
      aria-label={fr ? "Mini-calendrier" : "Mini-kalandriye"}
      className="sticky top-20 hidden w-52 shrink-0 self-start xl:block"
    >
      <div className="rounded-xl border border-stone-200/70 bg-white/80 p-3 shadow-card backdrop-blur-sm dark:border-stone-700/60 dark:bg-stone-900/65 dark:shadow-card-dark">
        {/* Navigation */}
        <div className="mb-2 flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={prevMonth}
            aria-label={fr ? "Mois précédent" : "Mwa anvan"}
            className="flex h-6 w-6 items-center justify-center rounded text-base text-stone-400 hover:bg-stone-100 dark:text-stone-500 dark:hover:bg-stone-800"
          >
            ‹
          </button>
          <span className="truncate text-center text-xs font-semibold capitalize text-stone-700 dark:text-stone-200">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            aria-label={fr ? "Mois suivant" : "Mwa pwochen"}
            className="flex h-6 w-6 items-center justify-center rounded text-base text-stone-400 hover:bg-stone-100 dark:text-stone-500 dark:hover:bg-stone-800"
          >
            ›
          </button>
        </div>

        {/* Day headers */}
        <div className="mb-0.5 grid grid-cols-7 text-center">
          {DAY_HEADERS.map((d, i) => (
            <span key={i} className="text-[10px] font-medium text-stone-300 dark:text-stone-600">
              {d}
            </span>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-y-0.5 text-center">
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={`e-${idx}`} className="h-7" />;
            }
            const hasEvent = eventDays.has(day);
            const isToday = isCurrentMonth && day === todayDay;
            return (
              <button
                key={day}
                type="button"
                onClick={() => hasEvent && scrollToDay(day)}
                disabled={!hasEvent}
                title={
                  hasEvent
                    ? fr
                      ? `Voir événements du ${day}`
                      : `Wè evènman ${day}`
                    : undefined
                }
                className={[
                  "relative flex h-7 w-7 items-center justify-center rounded-full text-xs transition",
                  isToday ? "font-bold ring-1 ring-blue-400 dark:ring-blue-500" : "",
                  hasEvent
                    ? "cursor-pointer font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/20"
                    : "cursor-default text-stone-400 dark:text-stone-500",
                ].join(" ")}
              >
                {day}
                {hasEvent && (
                  <span
                    aria-hidden
                    className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-500 dark:bg-blue-400"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
