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
              "rounded-lg px-4 py-1.5 text-sm font-medium transition",
              tab === t.key
                ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700",
            ].join(" ")}
          >
            {t.label}{" "}
            <span className="ml-0.5 opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-stone-200 dark:border-stone-700 py-16 text-center text-stone-400 dark:text-stone-400">
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
              className="flex items-center gap-4 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md dark:hover:border-stone-600"
            >
              {/* Kind icon */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  item.kind === "bourse"
                    ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
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
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : item.geo === "Haiti"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    }`}
                  >
                    {item.kind === "bourse"
                      ? (fr ? "Bourse" : "Bous")
                      : item.geo === "Haiti"
                        ? (fr ? "Calendrier Haïti" : "Kalandriye Ayiti")
                        : "International"}
                  </span>
                  <p className="font-medium text-stone-900 dark:text-white line-clamp-1">
                    {item.title}
                  </p>
                </div>
                {item.subtitle && (
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
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
                  className="shrink-0 rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-200 dark:bg-stone-700 dark:text-stone-300 dark:hover:bg-stone-600"
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
