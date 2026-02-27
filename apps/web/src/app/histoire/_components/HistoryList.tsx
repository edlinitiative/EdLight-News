"use client";

/**
 * HistoryList — list of almanac entries for the selected date.
 *
 * Shows top 3 by default with a "Voir tous (N)" expand button.
 * Single list per date — no duplication.
 */

import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { HistoryCard } from "./HistoryCard";
import { EmptyState } from "./EmptyState";
import type { SerializableAlmanacEntry } from "./shared";

/** Sort: high confidence first, then year descending. */
function sortEntries(entries: SerializableAlmanacEntry[]): SerializableAlmanacEntry[] {
  return [...entries].sort((a, b) => {
    if (a.confidence === "high" && b.confidence !== "high") return -1;
    if (a.confidence !== "high" && b.confidence === "high") return 1;
    return (b.year ?? 0) - (a.year ?? 0);
  });
}

const INITIAL_SHOW = 3;

interface HistoryListProps {
  entries: SerializableAlmanacEntry[];
  lang: ContentLanguage;
  emptyLabel?: string;
}

export function HistoryList({ entries, lang, emptyLabel }: HistoryListProps) {
  const fr = lang === "fr";
  const [expanded, setExpanded] = useState(false);

  // Reset expansion when entries change (date switch)
  useEffect(() => setExpanded(false), [entries]);

  const sorted = sortEntries(entries);
  const visible = expanded ? sorted : sorted.slice(0, INITIAL_SHOW);
  const remaining = sorted.length - INITIAL_SHOW;

  if (sorted.length === 0) {
    return <EmptyState lang={lang} dateLabel={emptyLabel} />;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((entry) => (
          <HistoryCard key={entry.id} entry={entry} lang={lang} />
        ))}
      </div>

      {remaining > 0 && (
        <div className="flex justify-center pt-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-600 shadow-sm transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            {expanded
              ? (fr ? "Voir moins" : "Wè mwens")
              : (fr ? `Voir tous (${sorted.length})` : `Wè tout (${sorted.length})`)}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      )}
    </div>
  );
}
