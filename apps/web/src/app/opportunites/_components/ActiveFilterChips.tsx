"use client";

import { X } from "lucide-react";

export interface ActiveFilter {
  /** URL param key — used to clear this filter */
  key: string;
  /** Human-readable chip text, e.g. "Type: Bourses" */
  label: string;
}

interface ActiveFilterChipsProps {
  filters: ActiveFilter[];
  onRemove: (paramKey: string) => void;
  onClearAll: () => void;
  fr: boolean;
}

export function ActiveFilterChips({
  filters,
  onRemove,
  onClearAll,
  fr,
}: ActiveFilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.map((f) => (
        <span
          key={f.key}
          className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
        >
          {f.label}
          <button
            type="button"
            onClick={() => onRemove(f.key)}
            className="ml-0.5 rounded-full p-0.5 text-stone-400 hover:bg-stone-200 hover:text-stone-600 dark:hover:bg-stone-700 dark:hover:text-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            aria-label={`Remove ${f.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="rounded-full px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        {fr ? "Tout effacer" : "Efase tout"}
      </button>
    </div>
  );
}
