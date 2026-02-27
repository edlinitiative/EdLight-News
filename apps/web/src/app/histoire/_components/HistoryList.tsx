"use client";

/**
 * HistoryList — list of almanac entries for the selected date,
 * with "Voir plus" expand behaviour (max 5 shown initially).
 */

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { HistoryCard } from "./HistoryCard";
import { EmptyState } from "./EmptyState";
import { formatMonthDay } from "./shared";
import type { SerializableAlmanacEntry } from "./shared";

/** Sort: high confidence first, then year descending. */
function sortEntries(entries: SerializableAlmanacEntry[]): SerializableAlmanacEntry[] {
  return [...entries].sort((a, b) => {
    if (a.confidence === "high" && b.confidence !== "high") return -1;
    if (a.confidence !== "high" && b.confidence === "high") return 1;
    return (b.year ?? 0) - (a.year ?? 0);
  });
}

const INITIAL_SHOW = 5;

interface HistoryListProps {
  entries: SerializableAlmanacEntry[];
  selectedDate: string; // MM-DD
  lang: ContentLanguage;
}

export function HistoryList({ entries, selectedDate, lang }: HistoryListProps) {
  const fr = lang === "fr";
  const [expanded, setExpanded] = useState(false);

  const sorted = sortEntries(entries);
  const visible = expanded ? sorted : sorted.slice(0, INITIAL_SHOW);
  const hasMore = sorted.length > INITIAL_SHOW;

  if (sorted.length === 0) {
    return <EmptyState lang={lang} dateLabel={formatMonthDay(selectedDate, lang)} />;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-stone-500 dark:text-stone-400">
          {fr ? "Tous les faits" : "Tout reyalite yo"}
        </h3>
        <span className="text-xs text-stone-400 dark:text-stone-500">
          {sorted.length} {fr ? "résultat" : "rezilta"}{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {visible.map((entry) => (
          <HistoryCard key={entry.id} entry={entry} lang={lang} variant="compact" />
        ))}
      </div>

      {/* Voir plus / Voir moins */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-medium text-stone-600 shadow-sm transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            {expanded
              ? (fr ? "Voir moins" : "Wè mwens")
              : (fr ? `Voir plus (${sorted.length - INITIAL_SHOW})` : `Wè plis (${sorted.length - INITIAL_SHOW})`)}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      )}
    </section>
  );
}
