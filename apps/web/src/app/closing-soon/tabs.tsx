/**
 * ClosingSoonTabs — client component for /closing-soon tab filtering.
 *
 * Tabs: Tout | Bourses (30j) | Calendrier Haïti (14j)
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

type TabKey = "tout" | "bourses" | "calendrier";

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
  const calCount = items.filter((i) => i.kind === "calendrier").length;

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "tout", label: fr ? "Tout" : "Tout", count: items.length },
    { key: "bourses", label: fr ? "Bourses (30j)" : "Bous (30j)", count: boursesCount },
    { key: "calendrier", label: fr ? "Calendrier Haïti (14j)" : "Kalandriye Ayiti (14j)", count: calCount },
  ];

  const filtered = useMemo(() => {
    if (tab === "tout") return items;
    if (tab === "bourses") return items.filter((i) => i.kind === "bourse");
    return items.filter((i) => i.kind === "calendrier");
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
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            ].join(" ")}
          >
            {t.label}{" "}
            <span className="ml-0.5 opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Items list */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
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
              className="flex items-center gap-4 rounded-lg border bg-white p-4 transition hover:shadow-sm"
            >
              {/* Kind icon */}
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  item.kind === "bourse"
                    ? "bg-amber-100 text-amber-600"
                    : "bg-blue-100 text-blue-600"
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
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {item.kind === "bourse"
                      ? (fr ? "Bourse" : "Bous")
                      : (fr ? "Calendrier" : "Kalandriye")}
                  </span>
                  <p className="font-medium text-gray-900 line-clamp-1">
                    {item.title}
                  </p>
                </div>
                {item.subtitle && (
                  <p className="mt-0.5 text-xs text-gray-500">
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
