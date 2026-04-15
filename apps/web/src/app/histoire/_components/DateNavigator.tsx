"use client";

/**
 * DateNavigator — sticky horizontal date navigation strip.
 *
 * Shows a scrollable row of dates centered on "today" with
 * month navigation controls. Sticks below the site header
 * when scrolling for persistent temporal navigation.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DateNavItem } from "./data";

interface DateNavigatorProps {
  items: readonly DateNavItem[];
  selectedDate: string;
  onSelect: (monthDay: string) => void;
}

export function DateNavigator({
  items,
  selectedDate,
  onSelect,
}: DateNavigatorProps) {
  return (
    <section
      id="date-nav"
      className="sticky top-[72px] z-30 border-y border-black/[0.06] bg-white/45 backdrop-blur-sm dark:border-stone-700/40 dark:bg-stone-900/45"
    >
      <div className="py-5">
        {/* Header row */}
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#464555]/70 dark:text-stone-500">
              Navigation temporelle
            </p>
            <p className="mt-1 text-sm text-[#464555] dark:text-stone-400">
              Parcourez les jours et les repères du mois
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white transition-colors hover:bg-[#f3ecea] dark:border-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700"
              aria-label="Mois précédent"
            >
              <ChevronLeft className="h-[18px] w-[18px]" />
            </button>
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border border-black/5 bg-white transition-colors hover:bg-[#f3ecea] dark:border-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700"
              aria-label="Mois suivant"
            >
              <ChevronRight className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>

        {/* Date items strip */}
        <div
          className="hide-scrollbar flex items-center gap-4 overflow-x-auto py-1"
          role="tablist"
          aria-label="Sélection de la date"
        >
          {items.map((item) =>
            item.isToday ? (
              <TodayPill
                key={item.monthDay}
                item={item}
                isSelected={selectedDate === item.monthDay}
                onSelect={onSelect}
              />
            ) : (
              <DateCircle
                key={item.monthDay}
                item={item}
                isSelected={selectedDate === item.monthDay}
                onSelect={onSelect}
              />
            ),
          )}
        </div>
      </div>
    </section>
  );
}

/* ── Sub-components ────────────────────────────────────────── */

function DateCircle({
  item,
  isSelected,
  onSelect,
}: {
  item: DateNavItem;
  isSelected: boolean;
  onSelect: (monthDay: string) => void;
}) {
  const day = item.monthDay.split("-")[1]!;

  return (
    <button
      role="tab"
      aria-selected={isSelected}
      onClick={() => onSelect(item.monthDay)}
      className="flex min-w-[84px] shrink-0 flex-col items-center text-[#464555]/60 dark:text-stone-500"
    >
      <span className="mb-2 text-[11px] uppercase tracking-[0.18em]">
        {item.label}
      </span>
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full border transition-colors ${
          isSelected
            ? "border-[#3525cd] bg-[#3525cd] text-white shadow-md"
            : "border-[#cfc5be] hover:border-[#3525cd] hover:text-[#3525cd] dark:border-stone-600 dark:hover:border-indigo-400 dark:hover:text-indigo-400"
        }`}
      >
        {day}
      </div>
    </button>
  );
}

function TodayPill({
  item,
  isSelected,
  onSelect,
}: {
  item: DateNavItem;
  isSelected: boolean;
  onSelect: (monthDay: string) => void;
}) {
  const day = item.monthDay.split("-")[1]!;
  const monthPart = item.label.split(" ")[1] ?? "";

  return (
    <button
      role="tab"
      aria-selected={isSelected}
      onClick={() => onSelect(item.monthDay)}
      className="min-w-[108px] shrink-0 rounded-[1.25rem] bg-[#3525cd] px-4 py-4 text-white shadow-[0_10px_30px_rgba(29,27,26,0.05)]"
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] opacity-75">
        Aujourd&apos;hui
      </p>
      <div className="flex items-end justify-between gap-3">
        <span className="font-display text-3xl font-extrabold">{day}</span>
        <span className="text-sm uppercase tracking-[0.18em] opacity-85">
          {monthPart}
        </span>
      </div>
    </button>
  );
}
