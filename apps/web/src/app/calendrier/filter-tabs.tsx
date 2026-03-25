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
import { CalendarDays, RotateCcw } from "lucide-react";
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
    <details open className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium capitalize text-stone-600 dark:text-stone-200">
            {label}
          </span>
          <span className="rounded-full bg-stone-100 dark:bg-stone-700 px-1.5 py-px text-xs text-stone-400 dark:text-stone-300">
            {items.length}
          </span>
        </div>
        <span aria-hidden className="text-sm text-stone-400 dark:text-stone-500">
          ▸
        </span>
      </summary>

      <div className="divide-y divide-stone-50 dark:divide-stone-800 border-t border-stone-100 dark:border-stone-700">
        {items.map((item) => {
          const dateISO = getItemDateISO(item);
          const date = dateISO ? parseISODateSafe(dateISO) : null;
          const isHaiti = item.geo === "Haiti";

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-stone-50 dark:hover:bg-stone-800"
            >
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-stone-300 dark:text-stone-600">
                {date ? date.getDate() : "?"}
              </span>
              <span
                className={[
                  "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium",
                  isHaiti
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300"
                    : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
                ].join(" ")}
              >
                {isHaiti ? "HT" : "Intl"}
              </span>
              <span className="flex-1 truncate text-sm text-stone-600 dark:text-stone-200">
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
      <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
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

  const hasActiveFilters = geoTab !== "tous" || catFilter !== "tous";

  return (
    <div className="space-y-5">
      {/* ── Compact filter bar — mobile only (desktop filters live in sidebar) ── */}
      <div className="flex flex-wrap items-center gap-2 md:hidden">
        <div className="flex items-center gap-1.5">
          {geoTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={geoTab === t.key}
              onClick={() => setGeoTab(t.key)}
              className={[
                "rounded-full px-3 py-1 text-xs font-medium transition",
                geoTab === t.key
                  ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                  : "bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600",
              ].join(" ")}
            >
              {t.label}{" "}
              <span className="opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
        <span className="h-4 w-px bg-stone-200 dark:bg-stone-700" />
        <div className="flex flex-wrap items-center gap-1.5">
          {catPills.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setCatFilter(p.key)}
              className={[
                "rounded-full px-2.5 py-1 text-xs font-medium transition",
                catFilter === p.key
                  ? "bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900"
                  : "bg-stone-100 dark:bg-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-600",
              ].join(" ")}
            >
              {p.label}
            </button>
          ))}
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setGeoTab("tous");
              setCatFilter("tous");
            }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* ── Two-column layout: timeline + mini grid ───────────────────────────── */}
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-8 xl:gap-10">
        {/* Main timeline */}
        <div className="min-w-0 flex-1 space-y-6">
          {buckets.urgent.length > 0 && (
            <section className="section-shell p-4 sm:p-5">
              <div className="relative z-10">
                <UrgentDeadlines items={buckets.urgent} lang={lang} />
              </div>
            </section>
          )}
          {buckets.thisWeek.length > 0 && (
            <section className="section-shell p-4 sm:p-5">
              <div className="relative z-10">
                <ThisWeek items={buckets.thisWeek} lang={lang} />
              </div>
            </section>
          )}
          {buckets.thisMonth.length > 0 && (
            <section className="section-shell p-4 sm:p-5">
              <div className="relative z-10">
                <MonthGrouped items={buckets.thisMonth} lang={lang} />
              </div>
            </section>
          )}
          {buckets.archive.length > 0 && (
            <section className="section-shell p-4 sm:p-5">
              <div className="relative z-10">
                <ArchiveSection items={buckets.archive} lang={lang} />
              </div>
            </section>
          )}

          {noResults && (
            <div className="section-shell border-2 border-dashed py-12 text-center text-stone-400 dark:text-stone-500">
              <CalendarDays className="mx-auto mb-2 h-8 w-8" />
              <p className="text-sm">
                {fr
                  ? "Aucun événement pour ce filtre."
                  : "Pa gen evènman pou filt sa a."}
              </p>
            </div>
          )}
        </div>

        {/* Sidebar filters + mini month grid — desktop only */}
        <div className="hidden md:block md:w-72 md:shrink-0">
          <div className="sticky top-20 space-y-3">
            <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-900">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-500">
                    {fr ? "Filtres" : "Filtè"}
                  </p>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setGeoTab("tous");
                        setCatFilter("tous");
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300 transition"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </button>
                  )}
                </div>

                {/* Geo row */}
                <div
                  role="tablist"
                  aria-label={fr ? "Filtre géographique" : "Filt jewografik"}
                >
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
                    {fr ? "Zone" : "Zòn"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {geoTabs.map((t) => (
                      <button
                        key={`sidebar-${t.key}`}
                        type="button"
                        role="tab"
                        aria-selected={geoTab === t.key}
                        onClick={() => setGeoTab(t.key)}
                        className={[
                          "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                          geoTab === t.key
                            ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                            : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700",
                        ].join(" ")}
                      >
                        {t.label}{" "}
                        <span className="opacity-60">{t.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Separator */}
                <div className="h-px bg-stone-100 dark:bg-stone-800" />

                {/* Category row */}
                <div
                  role="group"
                  aria-label={fr ? "Filtre par catégorie" : "Filt pa kategori"}
                >
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
                    {fr ? "Type" : "Tip"}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {catPills.map((p) => (
                      <button
                        key={`sidebar-${p.key}`}
                        type="button"
                        onClick={() => setCatFilter(p.key)}
                        className={[
                          "rounded-full px-2.5 py-1 text-[11px] font-medium transition",
                          catFilter === p.key
                            ? "bg-stone-800 text-white dark:bg-stone-100 dark:text-stone-900"
                            : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700",
                        ].join(" ")}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <MiniMonthGrid items={filtered} lang={lang} />
          </div>
        </div>
      </div>
    </div>
  );
}
