"use client";

/**
 * CalendarDashboard — interactive timeline dashboard for /calendrier.
 *
 * Export name kept as CalendarFilterTabs for backward compatibility with page.tsx.
 *
 * State:
 *  - geoTab: "tous" | "haiti" | "international"
 *  - catFilter: "tous" | "examens" | "admissions" | "bourses" | "concours" | "autres"
 *
 * Rendering order:
 *  1. Geo tab row  (Tous · Haïti · International)
 *  2. Category pill row (Examens · Admissions · Bourses · Concours · Autres)
 *  3. Urgent Deadlines section
 *  4. This Week section
 *  5. This Month section
 *  6. Archive section
 *  7. MiniMonthGrid sidebar (xl only)
 */

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type {
  CalendarItem,
  HaitiCalendarItem,
  IntlCalendarItem,
  GeoFilter,
  CategoryFilter,
} from "@/components/calendar/types";
import {
  filterCalendarItems,
  getItemTitle,
  getItemDateISO,
} from "@/components/calendar/types";
import {
  bucketItems,
  groupArchiveByMonth,
} from "@/components/calendar/calendarUtils";
import { UrgentDeadlines } from "@/components/calendar/UrgentDeadlines";
import { ThisWeek } from "@/components/calendar/ThisWeek";
import { MonthGrouped } from "@/components/calendar/MonthGrouped";
import { MiniMonthGrid } from "@/components/calendar/MiniMonthGrid";
import { parseISODateSafe } from "@/lib/deadlines";

// ─── Archive section ──────────────────────────────────────────────────────────

function ArchiveMonthBlock({
  monthKey,
  items,
  lang,
}: {
  monthKey: string;
  items: CalendarItem[];
  lang: ContentLanguage;
}) {
  const fr = lang === "fr";

  const label =
    monthKey === "nodate"
      ? fr
        ? "Date à confirmer"
        : "Dat pou konfime"
      : (() => {
          const yr = parseInt(monthKey.slice(0, 4), 10);
          const mo = parseInt(monthKey.slice(5, 7), 10) - 1;
          return new Date(yr, mo, 1).toLocaleDateString(
            fr ? "fr-FR" : "fr-HT",
            { month: "long", year: "numeric" },
          );
        })();

  return (
    <details className="overflow-hidden rounded-lg border border-gray-100 dark:border-slate-700">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium capitalize text-gray-600 dark:text-slate-300">
            {label}
          </span>
          <span className="rounded-full bg-gray-100 dark:bg-slate-700 px-1.5 py-px text-xs text-gray-400 dark:text-slate-500">
            {items.length}
          </span>
        </div>
        <span aria-hidden className="text-sm text-gray-400 dark:text-slate-500">
          ▸
        </span>
      </summary>

      <div className="divide-y divide-gray-50 dark:divide-slate-700 border-t border-gray-100 dark:border-slate-700">
        {items.map((item) => {
          const dateISO = getItemDateISO(item);
          const date = dateISO ? parseISODateSafe(dateISO) : null;
          const isHaiti = item.geo === "Haiti";

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-gray-300 dark:text-slate-600">
                {date ? date.getDate() : "?"}
              </span>
              <span
                className={[
                  "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium",
                  isHaiti
                    ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400"
                    : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
                ].join(" ")}
              >
                {isHaiti ? "HT" : "Intl"}
              </span>
              <span className="flex-1 truncate text-sm text-gray-600 dark:text-slate-300">
                {getItemTitle(item)}
              </span>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function ArchiveSection({
  items,
  lang,
}: {
  items: CalendarItem[];
  lang: ContentLanguage;
}) {
  const fr = lang === "fr";
  const grouped = groupArchiveByMonth(items);
  if (grouped.size === 0) return null;

  const sortedKeys = [...grouped.keys()]
    .filter((k) => k !== "nodate")
    .sort();
  if (grouped.has("nodate")) sortedKeys.push("nodate");

  return (
    <section
      aria-label={fr ? "Prochains mois" : "Mwa k ap vini yo"}
      className="space-y-3"
    >
      <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
        {fr ? "Prochains mois" : "Mwa k ap vini yo"}
      </h2>
      <div className="space-y-2">
        {sortedKeys.map((key) => (
          <ArchiveMonthBlock
            key={key}
            monthKey={key}
            items={grouped.get(key)!}
            lang={lang}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export function CalendarFilterTabs({
  haitiItems,
  intlItems,
  lang,
}: {
  haitiItems: HaitiCalendarItem[];
  intlItems: IntlCalendarItem[];
  lang: ContentLanguage;
}) {
  const fr = lang === "fr";
  const [geoTab, setGeoTab] = useState<GeoFilter>("tous");
  const [catFilter, setCatFilter] = useState<CategoryFilter>("tous");

  const allItems: CalendarItem[] = [...haitiItems, ...intlItems];

  // Geo counts reflect full item set (not category-filtered)
  const haitiCount = allItems.filter((i) => i.geo === "Haiti").length;
  const intlCount = allItems.filter((i) => i.geo === "International").length;

  const geoTabs: { key: GeoFilter; label: string; count: number }[] = [
    { key: "tous", label: fr ? "Tous" : "Tout", count: allItems.length },
    { key: "haiti", label: fr ? "Haïti" : "Ayiti", count: haitiCount },
    { key: "international", label: "International", count: intlCount },
  ];

  const catPills: { key: CategoryFilter; label: string }[] = [
    { key: "tous", label: fr ? "Tous" : "Tout" },
    { key: "examens", label: fr ? "Examens" : "Egzamen" },
    { key: "admissions", label: fr ? "Admissions" : "Admisyon" },
    { key: "bourses", label: fr ? "Bourses" : "Bous" },
    { key: "concours", label: fr ? "Concours" : "Konkou" },
    { key: "autres", label: fr ? "Autres" : "Lòt" },
  ];

  // Filter then bucket
  const filtered = filterCalendarItems(allItems, geoTab, catFilter);
  const buckets = bucketItems(filtered);

  const noResults =
    buckets.urgent.length === 0 &&
    buckets.thisWeek.length === 0 &&
    buckets.thisMonth.length === 0 &&
    buckets.archive.length === 0;

  return (
    <div className="space-y-5">
      {/* ── Geo tabs ─────────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label={fr ? "Filtre géographique" : "Filt jewografik"}
        className="flex flex-wrap gap-2"
      >
        {geoTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={geoTab === t.key}
            onClick={() => setGeoTab(t.key)}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              geoTab === t.key
                ? "bg-brand-600 text-white"
                : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600",
            ].join(" ")}
          >
            {t.label}{" "}
            <span className="ml-1 opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* ── Category pills ───────────────────────────────────────────────────── */}
      <div
        role="group"
        aria-label={fr ? "Filtre par catégorie" : "Filt pa kategori"}
        className="flex flex-wrap gap-1.5"
      >
        {catPills.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setCatFilter(p.key)}
            className={[
              "rounded-full px-3 py-1 text-xs font-medium transition",
              catFilter === p.key
                ? "bg-gray-800 text-white"
                : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600",
            ].join(" ")}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Two-column layout: timeline + mini grid ───────────────────────────── */}
      <div className="flex items-start gap-8">
        {/* Main timeline */}
        <div className="min-w-0 flex-1 space-y-10">
          <UrgentDeadlines items={buckets.urgent} lang={lang} />
          <ThisWeek items={buckets.thisWeek} lang={lang} />
          <MonthGrouped items={buckets.thisMonth} lang={lang} />
          <ArchiveSection items={buckets.archive} lang={lang} />

          {noResults && (
            <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-700 py-12 text-center text-gray-400 dark:text-slate-500">
              <CalendarDays className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">
                {fr
                  ? "Aucun événement pour ce filtre."
                  : "Pa gen evènman pou filt sa a."}
              </p>
            </div>
          )}
        </div>

        {/* Mini month grid — desktop only */}
        <MiniMonthGrid items={filtered} lang={lang} />
      </div>
    </div>
  );
}
