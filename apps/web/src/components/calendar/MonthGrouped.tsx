"use client";

/**
 * MonthGrouped — current month's remaining events as collapsible week blocks.
 * Weeks: 1–7 · 8–14 · 15–21 · 22–end.
 * Items inside each week carry a cal-day-YYYY-MM-DD anchor for scroll targeting.
 */

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { CalendarItem } from "./types";
import { getItemTitle, getItemDateISO } from "./types";
import { parseISODateSafe } from "@/lib/deadlines";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekBucket {
  label: string;
  startDay: number;
  endDay: number;
  items: CalendarItem[];
}

interface Props {
  items: CalendarItem[];
  lang: ContentLanguage;
  /** Optional "YYYY-MM" override. Defaults to current month. */
  yearMonth?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBuckets(year: number, month: number, fr: boolean): WeekBucket[] {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return [
    {
      label: fr ? "Semaine 1 (1–7)" : "Semèn 1 (1–7)",
      startDay: 1,
      endDay: 7,
      items: [],
    },
    {
      label: fr ? "Semaine 2 (8–14)" : "Semèn 2 (8–14)",
      startDay: 8,
      endDay: 14,
      items: [],
    },
    {
      label: fr ? "Semaine 3 (15–21)" : "Semèn 3 (15–21)",
      startDay: 15,
      endDay: 21,
      items: [],
    },
    {
      label: fr
        ? `Semaine 4 (22–${lastDay})`
        : `Semèn 4 (22–${lastDay})`,
      startDay: 22,
      endDay: lastDay,
      items: [],
    },
  ];
}

// ─── CollapsibleWeek ──────────────────────────────────────────────────────────

function CollapsibleWeek({
  bucket,
  lang,
  defaultOpen,
}: {
  bucket: WeekBucket;
  lang: ContentLanguage;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const fr = lang === "fr";

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200/70 bg-white/70 shadow-sm dark:border-stone-700/60 dark:bg-stone-900/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-stone-50/80 dark:hover:bg-stone-800/60"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">
            {bucket.label}
          </span>
          <span className="rounded-full bg-stone-100 px-1.5 py-px text-xs text-stone-500 dark:bg-stone-700 dark:text-stone-300">
            {bucket.items.length}
          </span>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 dark:text-stone-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-400 dark:text-stone-500" />
        )}
      </button>

      {open && (
        <div className="divide-y divide-stone-50 border-t border-stone-100 dark:divide-stone-800 dark:border-stone-700">
          {(() => {
            const anchoredDays = new Set<string>();
            return bucket.items.map((item) => {
              const dateISO = getItemDateISO(item);
              const date = dateISO ? parseISODateSafe(dateISO) : null;
              const isHaiti = item.geo === "Haiti";

              let anchorId: string | undefined;
              if (
                dateISO !== null &&
                dateISO !== undefined &&
                !anchoredDays.has(dateISO)
              ) {
                anchoredDays.add(dateISO);
                anchorId = `cal-day-${dateISO}`;
              }

              return (
                <div
                  key={item.id}
                  id={anchorId}
                  className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-stone-50/80 dark:hover:bg-stone-800/50"
                >
                  {/* Day number */}
                  <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-stone-300 dark:text-stone-600">
                    {date ? date.getDate() : "?"}
                  </span>

                  {/* Geo pill */}
                  <span
                    className={[
                      "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium",
                      isHaiti
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
                    ].join(" ")}
                  >
                    {isHaiti ? "HT" : "Intl"}
                  </span>

                  {/* Audience badge */}
                  {item.audience === "HaitianStudents" && !isHaiti && (
                    <span className="shrink-0 rounded-full bg-violet-50 px-1.5 py-px text-[10px] font-medium text-violet-600 dark:bg-violet-900/20 dark:text-violet-300">
                      {fr ? "Haiti" : "Ayiti"}
                    </span>
                  )}

                  {/* Title */}
                  <span className="flex-1 truncate text-sm text-stone-700 dark:text-stone-200">
                    {getItemTitle(item)}
                  </span>
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
}

// ─── MonthGrouped ─────────────────────────────────────────────────────────────

export function MonthGrouped({ items, lang, yearMonth }: Props) {
  const fr = lang === "fr";
  const now = new Date();

  const year = yearMonth
    ? parseInt(yearMonth.slice(0, 4), 10)
    : now.getFullYear();
  const month = yearMonth
    ? parseInt(yearMonth.slice(5, 7), 10) - 1
    : now.getMonth();

  const monthLabel = new Date(year, month, 1).toLocaleDateString(
    fr ? "fr-FR" : "fr-HT",
    { month: "long", year: "numeric" },
  );

  // Build and populate week buckets
  const buckets = buildBuckets(year, month, fr);

  for (const item of items) {
    const dateISO = getItemDateISO(item);
    if (!dateISO) continue;
    const date = parseISODateSafe(dateISO);
    if (!date) continue;
    const day = date.getDate();
    const bucket = buckets.find((b) => day >= b.startDay && day <= b.endDay);
    if (bucket) bucket.items.push(item);
  }

  // Sort items within each bucket by date
  for (const bucket of buckets) {
    bucket.items.sort((a, b) =>
      (getItemDateISO(a) ?? "").localeCompare(getItemDateISO(b) ?? ""),
    );
  }

  const nonEmpty = buckets.filter((b) => b.items.length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <section
      aria-label={fr ? `Ce mois — ${monthLabel}` : `Mwa sa a — ${monthLabel}`}
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
          {fr ? `Ce mois — ${monthLabel}` : `Mwa sa a — ${monthLabel}`}
        </h2>
        <span className="rounded-full bg-stone-100 px-2 py-px text-xs text-stone-500 dark:bg-stone-700 dark:text-stone-300">
          {items.length}
        </span>
      </div>

      <div className="space-y-2">
        {nonEmpty.map((bucket, idx) => (
          <CollapsibleWeek
            key={bucket.label}
            bucket={bucket}
            lang={lang}
            defaultOpen={idx === 0}
          />
        ))}
      </div>
    </section>
  );
}
