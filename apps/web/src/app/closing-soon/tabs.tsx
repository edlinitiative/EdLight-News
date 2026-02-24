/**
 * ClosingSoonTabs — client component for /closing-soon tab filtering.
 *
 * Tabs: Tout | Bourses (30j) | Calendrier Haïti (14j) | International (14j)
 */

"use client";

import { useState, useMemo } from "react";
import {
  DollarSign,
  CalendarDays,
  ExternalLink,
  Clock,
} from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import type { ClosingItem } from "./page";

type TabKey = "tout" | "bourses" | "calendrier-haiti" | "calendrier-intl";

export function ClosingSoonTabs({
  items,
  lang,
}: {
  items: ClosingItem[];
  lang: ContentLanguage;
}) {
  const [tab, setTab] = useState<TabKey>("tout");
  const fr = lang === "fr";

  const boursesCount = items.filter((i) => i.kind === "bourse").length;
  const calHaitiCount = items.filter(
    (i) => i.kind === "calendrier" && i.geo === "Haiti",
  ).length;
  const calIntlCount = items.filter(
    (i) => i.kind === "calendrier" && i.geo !== "Haiti",
  ).length;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "tout", label: fr ? "Tout" : "Tout", count: items.length },
    { key: "bourses", label: fr ? "Bourses (30j)" : "Bous (30j)", count: boursesCount },
    {
      key: "calendrier-haiti",
      label: fr ? "Calendrier Haïti (14j)" : "Kalandriye Ayiti (14j)",
      count: calHaitiCount,
    },
    {
      key: "calendrier-intl",
      label: fr ? "International (14j)" : "Entènasyonal (14j)",
      count: calIntlCount,
    },
  ];

  const filtered = useMemo(() => {
    if (tab === "tout") return items;
    if (tab === "bourses") return items.filter((i) => i.kind === "bourse");
    if (tab === "calendrier-haiti")
      return items.filter((i) => i.kind === "calendrier" && i.geo === "Haiti");
    // calendrier-intl
    return items.filter((i) => i.kind === "calendrier" && i.geo !== "Haiti");
  }, [items, tab]);

  return (
    <div className="space-y-6">
      {/* Tab pills */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              tab === t.key
                ? "bg-red-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600",
            ].join(" ")}
          >
            {t.label}{" "}
            <span className="ml-0.5 opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-700 py-16 text-center text-gray-400 dark:text-slate-400">
          <Clock className="mx-auto mb-2 h-8 w-8" />
          <p>
            {fr
              ? "Aucune échéance prochaine pour ce filtre."
              : "Pa gen dat limit pou filt sa a."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={`${item.kind}-${item.id}`}
              className="flex items-center gap-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            >
              {/* Kind icon */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  item.kind === "bourse"
                    ? "bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                    : "bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400"
                }`}
              >
                {item.kind === "bourse" ? (
                  <DollarSign className="h-5 w-5" />
                ) : (
                  <CalendarDays className="h-5 w-5" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      item.kind === "bourse"
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                        : item.geo === "Haiti"
                          ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    }`}
                  >
                    {item.kind === "bourse"
                      ? (fr ? "Bourse" : "Bous")
                      : item.geo === "Haiti"
                        ? (fr ? "Calendrier Haïti" : "Kalandriye Ayiti")
                        : "International"}
                  </span>
                  <p className="font-medium text-gray-900 dark:text-white line-clamp-1">
                    {item.title}
                  </p>
                </div>
                {item.subtitle && (
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                    {item.subtitle}
                  </p>
                )}
              </div>

              {/* Deadline badge */}
              <DeadlineBadge
                dateISO={item.dateISO}
                windowDays={item.kind === "bourse" ? 30 : 14}
                lang={lang}
                prefix={
                  item.kind === "bourse"
                    ? undefined
                    : { fr: "Événement", ht: "Evènman" }
                }
              />

              {/* Action link */}
              {item.actionUrl && (
                <a
                  href={item.actionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
                >
                  <ExternalLink className="mr-1 inline h-3 w-3" />
                  {fr ? item.actionLabel?.fr : item.actionLabel?.ht}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
