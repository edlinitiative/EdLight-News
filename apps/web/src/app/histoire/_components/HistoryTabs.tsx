"use client";

/**
 * HistoryTabs — "Faits" | "Personnalités" | "Fêtes" tab bar.
 *
 * Filters the already-loaded dataset for the selected date.
 * If a tab has no data, it still renders but the content area shows EmptyState.
 *
 * "Personnalités" is a placeholder for future person-type entries.
 * "Fêtes" filters from the holidays array.
 */

import type { ContentLanguage } from "@edlight-news/types";

export type HistoireTab = "faits" | "personnalites" | "fetes";

interface TabDef {
  key: HistoireTab;
  fr: string;
  ht: string;
}

const TABS: TabDef[] = [
  { key: "faits", fr: "Faits", ht: "Reyalite" },
  { key: "personnalites", fr: "Personnalités", ht: "Pèsonalite" },
  { key: "fetes", fr: "Fêtes", ht: "Fèt" },
];

interface HistoryTabsProps {
  active: HistoireTab;
  onChange: (tab: HistoireTab) => void;
  counts: Record<HistoireTab, number>;
  lang: ContentLanguage;
}

export function HistoryTabs({ active, onChange, counts, lang }: HistoryTabsProps) {
  const fr = lang === "fr";

  return (
    <div className="flex gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const count = counts[tab.key];
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={
              "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition " +
              (isActive
                ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-white"
                : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200")
            }
          >
            {fr ? tab.fr : tab.ht}
            {count > 0 && (
              <span
                className={
                  "min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold leading-none " +
                  (isActive
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                    : "bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-400")
                }
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
