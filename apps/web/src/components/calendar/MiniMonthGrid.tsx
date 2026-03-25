"use client";

/**
 * MiniMonthGrid — desktop sidebar calendar widget.
 *
 * Deadline days are highlighted with colored fills:
 *   • red fill   → ≤5 days away (urgent)
 *   • amber fill → 6–10 days away
 *   • blue fill  → 11+ days away or past
 *
 * Clicking a highlighted day scrolls the main timeline to the
 * corresponding cal-day-YYYY-MM-DD anchor.
 */

import { useState } from "react";
import type { ContentLanguage } from "@edlight-news/types";
import type { CalendarItem } from "./types";
import { getItemDateISO } from "./types";
import { parseISODateSafe, daysUntil } from "@/lib/deadlines";

interface Props {
  items: CalendarItem[];
  lang: ContentLanguage;
}

const DAY_HEADERS_FR = ["L", "M", "M", "J", "V", "S", "D"] as const;

function dayUrgencyClasses(dayDate: Date, now: Date): { bg: string; text: string; ring: string } {
  const days = daysUntil(dayDate, now);
  if (days >= 0 && days <= 5)
    return {
      bg: "bg-red-500 dark:bg-red-600",
      text: "text-white",
      ring: "",
    };
  if (days > 5 && days <= 10)
    return {
      bg: "bg-amber-400 dark:bg-amber-500",
      text: "text-white dark:text-stone-900",
      ring: "",
    };
  return {
    bg: "bg-blue-500 dark:bg-blue-500",
    text: "text-white",
    ring: "",
  };
}

export function MiniMonthGrid({ items, lang }: Props) {
  const fr = lang === "fr";
  const today = new Date();

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  // Collect days that have events in the viewed month, with their dates
  const eventDayMap = new Map<number, Date>();
  for (const item of items) {
    const dateISO = getItemDateISO(item);
    if (!dateISO) continue;
    const d = parseISODateSafe(dateISO);
    if (!d) continue;
    if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
      if (!eventDayMap.has(d.getDate())) {
        eventDayMap.set(d.getDate(), d);
      }
    }
  }

  // Count events per day for badge
  const eventDayCounts = new Map<number, number>();
  for (const item of items) {
    const dateISO = getItemDateISO(item);
    if (!dateISO) continue;
    const d = parseISODateSafe(dateISO);
    if (!d) continue;
    if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
      eventDayCounts.set(d.getDate(), (eventDayCounts.get(d.getDate()) ?? 0) + 1);
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

  const totalEventsThisMonth = [...eventDayCounts.values()].reduce((a, b) => a + b, 0);

  return (
    <div
      aria-label={fr ? "Mini-calendrier" : "Mini-kalandriye"}
      className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-900"
    >
      {/* Navigation */}
      <div className="mb-2.5 flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={prevMonth}
          aria-label={fr ? "Mois précédent" : "Mwa anvan"}
          className="flex h-6 w-6 items-center justify-center rounded-md text-sm text-stone-400 hover:bg-stone-100 dark:text-stone-500 dark:hover:bg-stone-800 transition"
        >
          ‹
        </button>
        <div className="text-center">
          <span className="block truncate text-xs font-bold capitalize text-stone-700 dark:text-stone-200">
            {monthLabel}
          </span>
          {totalEventsThisMonth > 0 && (
            <span className="text-[10px] text-stone-400 dark:text-stone-500">
              {totalEventsThisMonth} {fr ? "échéance" : "dat limit"}{totalEventsThisMonth > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={nextMonth}
          aria-label={fr ? "Mois suivant" : "Mwa pwochen"}
          className="flex h-6 w-6 items-center justify-center rounded-md text-sm text-stone-400 hover:bg-stone-100 dark:text-stone-500 dark:hover:bg-stone-800 transition"
        >
          ›
        </button>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {DAY_HEADERS_FR.map((d, i) => (
          <span key={i} className="text-[10px] font-semibold text-stone-400 dark:text-stone-600">
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
          const eventDate = eventDayMap.get(day);
          const hasEvent = !!eventDate;
          const eventCount = eventDayCounts.get(day) ?? 0;
          const isToday = isCurrentMonth && day === todayDay;

          // Style: event days get colored circle fills
          const uc = hasEvent ? dayUrgencyClasses(eventDate, today) : null;

          return (
            <button
              key={day}
              type="button"
              onClick={() => hasEvent && scrollToDay(day)}
              disabled={!hasEvent}
              title={
                hasEvent
                  ? `${eventCount} ${fr ? "échéance" : "dat limit"}${eventCount > 1 ? "s" : ""}`
                  : undefined
              }
              className={[
                "relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs transition-all",
                isToday && !hasEvent ? "font-bold ring-2 ring-blue-300 dark:ring-blue-600" : "",
                hasEvent
                  ? [
                      "cursor-pointer font-bold shadow-sm",
                      uc!.bg,
                      uc!.text,
                      isToday ? "ring-2 ring-offset-1 ring-stone-900 dark:ring-white dark:ring-offset-stone-900" : "",
                      "hover:scale-110",
                    ].join(" ")
                  : "cursor-default text-stone-400 dark:text-stone-500",
              ].join(" ")}
            >
              {day}
              {/* Multi-event indicator */}
              {eventCount > 1 && (
                <span
                  aria-hidden
                  className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white text-[7px] font-bold text-stone-700 shadow-sm dark:bg-stone-800 dark:text-stone-200"
                >
                  {eventCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-stone-100 pt-2 dark:border-stone-800">
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-[10px] text-stone-400 dark:text-stone-500">≤5{fr ? "j" : " jou"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="text-[10px] text-stone-400 dark:text-stone-500">6–10{fr ? "j" : " jou"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-[10px] text-stone-400 dark:text-stone-500">11+{fr ? "j" : " jou"}</span>
        </div>
      </div>
    </div>
  );
}
