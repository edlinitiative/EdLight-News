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
import { CalendarDays, RotateCcw, Sparkles } from "lucide-react";
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
    <details className="overflow-hidden rounded-xl border border-gray-200/70 bg-white/70 shadow-sm dark:border-slate-700/60 dark:bg-slate-900/50">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 transition-colors hover:bg-gray-50/80 dark:hover:bg-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium capitalize text-gray-600 dark:text-slate-200">
            {label}
          </span>
          <span className="rounded-full bg-gray-100 dark:bg-slate-700 px-1.5 py-px text-xs text-gray-400 dark:text-slate-300">
            {items.length}
          </span>
        </div>
        <span aria-hidden className="text-sm text-gray-400 dark:text-slate-500">
          ▸
        </span>
      </summary>

      <div className="divide-y divide-gray-50 dark:divide-slate-800 border-t border-gray-100 dark:border-slate-700">
        {items.map((item) => {
          const dateISO = getItemDateISO(item);
          const date = dateISO ? parseISODateSafe(dateISO) : null;
          const isHaiti = item.geo === "Haiti";

          return (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-gray-50/80 dark:hover:bg-slate-800/50"
            >
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-gray-300 dark:text-slate-600">
                {date ? date.getDate() : "?"}
              </span>
              <span
                className={[
                  "shrink-0 rounded-full px-1.5 py-px text-[10px] font-medium",
                  isHaiti
                    ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-300"
                    : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
                ].join(" ")}
              >
                {isHaiti ? "HT" : "Intl"}
              </span>
              <span className="flex-1 truncate text-sm text-gray-600 dark:text-slate-200">
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

  const activeGeoLabel =
    geoTabs.find((t) => t.key === geoTab)?.label ?? (fr ? "Tous" : "Tout");
  const activeCatLabel =
    catPills.find((p) => p.key === catFilter)?.label ?? (fr ? "Tous" : "Tout");
  const hasActiveFilters = geoTab !== "tous" || catFilter !== "tous";

  const timelineSections = [
    {
      key: "urgent",
      count: buckets.urgent.length,
      label: fr ? "Urgences" : "Ijans",
      tone: "text-red-700 dark:text-red-300",
      node: <UrgentDeadlines items={buckets.urgent} lang={lang} />,
    },
    {
      key: "week",
      count: buckets.thisWeek.length,
      label: fr ? "Cette semaine" : "Semèn sa",
      tone: "text-brand-700 dark:text-brand-300",
      node: <ThisWeek items={buckets.thisWeek} lang={lang} />,
    },
    {
      key: "month",
      count: buckets.thisMonth.length,
      label: fr ? "Ce mois" : "Mwa sa",
      tone: "text-gray-700 dark:text-slate-200",
      node: <MonthGrouped items={buckets.thisMonth} lang={lang} />,
    },
    {
      key: "archive",
      count: buckets.archive.length,
      label: fr ? "Prochains mois" : "Mwa k ap vini",
      tone: "text-gray-700 dark:text-slate-200",
      node: <ArchiveSection items={buckets.archive} lang={lang} />,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="section-shell p-4 sm:p-5">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-slate-400">
                <Sparkles className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                {fr ? "Navigation calendrier" : "Navigasyon kalandriye"}
              </p>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                {fr
                  ? "Filtre la vue par zone et type, puis explore la timeline par priorité."
                  : "Filtre vi a pa zòn ak kalite, epi eksplore timeline nan pa priyorite."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-gray-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-gray-700 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200">
                {fr ? "Vue" : "Vi"}: {activeGeoLabel}
              </span>
              <span className="rounded-full border border-gray-200/80 bg-white/80 px-3 py-1 text-xs font-semibold text-gray-700 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-200">
                {fr ? "Catégorie" : "Kategori"}: {activeCatLabel}
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setGeoTab("tous");
                    setCatFilter("tous");
                  }}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {fr ? "Réinitialiser" : "Reyinisyalize"}
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {timelineSections.map((s) => (
              <div
                key={`${s.key}-stat`}
                className="rounded-xl border border-gray-200/80 bg-white/80 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-900/55"
              >
                <p className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-slate-500">
                  {s.label}
                </p>
                <p className={`mt-0.5 text-lg font-bold tracking-tight ${s.tone}`}>{s.count}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
            <div
              role="tablist"
              aria-label={fr ? "Filtre géographique" : "Filt jewografik"}
              className="rounded-2xl border border-gray-200/70 bg-white/70 p-2.5 dark:border-slate-700/60 dark:bg-slate-900/60"
            >
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-slate-500">
                {fr ? "Zone" : "Zòn"}
              </p>
              <div className="flex flex-wrap gap-2">
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
                        ? "bg-brand-600 text-white shadow-sm"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600",
                    ].join(" ")}
                  >
                    {t.label} <span className="ml-1 opacity-70">({t.count})</span>
                  </button>
                ))}
              </div>
            </div>

            <div
              role="group"
              aria-label={fr ? "Filtre par catégorie" : "Filt pa kategori"}
              className="rounded-2xl border border-gray-200/70 bg-white/70 p-2.5 dark:border-slate-700/60 dark:bg-slate-900/60"
            >
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-slate-500">
                {fr ? "Type d'échéance" : "Tip dat limit"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {catPills.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setCatFilter(p.key)}
                    className={[
                      "rounded-full px-3 py-1 text-xs font-medium transition",
                      catFilter === p.key
                        ? "bg-gray-800 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600",
                    ].join(" ")}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Two-column layout: timeline + mini grid ───────────────────────────── */}
      <div className="flex items-start gap-8 xl:gap-10">
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
            <div className="section-shell border-2 border-dashed py-12 text-center text-gray-400 dark:text-slate-500">
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
        <div className="hidden xl:block xl:w-56 xl:shrink-0">
          <div className="sticky top-20 space-y-3">
            <MiniMonthGrid items={filtered} lang={lang} />
            <div className="section-shell p-3">
              <div className="relative z-10 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-slate-500">
                  {fr ? "Légende" : "Lejand"}
                </p>
                <div className="space-y-1.5 text-xs text-gray-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-semibold text-brand-700 dark:bg-brand-900/20 dark:text-brand-300">HT</span>
                    <span>{fr ? "Événement Haïti" : "Evènman Ayiti"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">Intl</span>
                    <span>{fr ? "International" : "Entènasyonal"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-brand-500 dark:bg-brand-400" />
                    <span>{fr ? "Jour avec événement" : "Jou ki gen evènman"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
