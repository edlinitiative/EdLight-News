"use client";

/**
 * HistoryList — "Aussi ce jour-là" section.
 *
 * Shows secondary facts (everything except the hero entry) in a
 * compact 2-column grid. Includes:
 *   - Section heading
 *   - Inline category filter pills
 *   - Top 4 by default + "Voir tous (N)" expand
 */

import { useState, useEffect, useMemo } from "react";
import { ChevronDown, Tag } from "lucide-react";
import type { ContentLanguage, AlmanacTag } from "@edlight-news/types";
import { HistoryCard } from "./HistoryCard";
import { EmptyState } from "./EmptyState";
import { TAG_LABELS, FILTER_TAGS } from "./shared";
import type { SerializableAlmanacEntry } from "./shared";

/** Sort: high confidence first, then year descending. */
function sortEntries(entries: SerializableAlmanacEntry[]): SerializableAlmanacEntry[] {
  return [...entries].sort((a, b) => {
    if (a.confidence === "high" && b.confidence !== "high") return -1;
    if (a.confidence !== "high" && b.confidence === "high") return 1;
    return (b.year ?? 0) - (a.year ?? 0);
  });
}

const INITIAL_SHOW = 4;

interface HistoryListProps {
  entries: SerializableAlmanacEntry[];
  lang: ContentLanguage;
  emptyLabel?: string;
  /** Pass true when showing entries from a date range (shows date on each card) */
  showDate?: boolean;
}

export function HistoryList({ entries, lang, emptyLabel, showDate }: HistoryListProps) {
  const fr = lang === "fr";
  const [expanded, setExpanded] = useState(false);
  const [selectedTag, setSelectedTag] = useState<AlmanacTag | "">("");

  // Reset on entries change
  useEffect(() => {
    setExpanded(false);
    setSelectedTag("");
  }, [entries]);

  const sorted = sortEntries(entries);
  const filtered = useMemo(
    () => (selectedTag ? sorted.filter((e) => e.tags?.includes(selectedTag)) : sorted),
    [sorted, selectedTag],
  );
  const visible = expanded ? filtered : filtered.slice(0, INITIAL_SHOW);
  const remaining = filtered.length - INITIAL_SHOW;

  // Determine which tags are actually present in entries
  const availableTags = useMemo(() => {
    const tagSet = new Set<AlmanacTag>();
    for (const e of entries) e.tags?.forEach((t) => tagSet.add(t));
    return FILTER_TAGS.filter((t) => tagSet.has(t));
  }, [entries]);

  if (sorted.length === 0) {
    return null; // Hero already shown; no "also" section needed
  }

  return (
    <section className="space-y-4">
      {/* Section heading + filter pills */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-bold text-stone-700 dark:text-stone-300">
          {fr ? "Aussi ce jour-là" : "Menm jou sa a tou"}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {availableTags.length > 0 && (
            <>
              <button
                onClick={() => setSelectedTag("")}
                className={
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition " +
                  (selectedTag === ""
                    ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                    : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200")
                }
              >
                {fr ? "Tous" : "Tout"}
              </button>
              {availableTags.map((t) => {
                const tl = TAG_LABELS[t];
                const isActive = selectedTag === t;
                return (
                  <button
                    key={t}
                    onClick={() => setSelectedTag(isActive ? "" : t)}
                    className={
                      "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition " +
                      (isActive
                        ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                        : `text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200`)
                    }
                  >
                    <Tag className="h-2.5 w-2.5" />
                    {fr ? tl.fr : tl.ht}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <EmptyState lang={lang} dateLabel={emptyLabel} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((entry) => (
              <HistoryCard key={entry.id} entry={entry} lang={lang} showDate={showDate} />
            ))}
          </div>

          {remaining > 0 && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-5 py-2 text-xs font-medium text-stone-600 shadow-sm transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              >
                {expanded
                  ? (fr ? "Voir moins" : "Wè mwens")
                  : (fr ? `Voir tous (${filtered.length})` : `Wè tout (${filtered.length})`)}
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
