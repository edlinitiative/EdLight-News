"use client";

import { X } from "lucide-react";

export interface ActiveFilter {
  /** URL param key — used to clear this filter */
  key: string;
  /** Human-readable chip text, e.g. "Pays: Canada" */
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
          className="inline-flex items-center gap-1 rounded-full border border-[#c7c4d8]/20 bg-[#f9f2f0] px-2.5 py-1 text-xs font-medium text-[#464555] dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
        >
          {f.label}
          <button
            type="button"
            onClick={() => onRemove(f.key)}
            className="ml-0.5 rounded-full p-0.5 text-[#474948] hover:bg-[#e8e1df] hover:text-[#1d1b1a] dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-stone-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd]"
            aria-label={`Remove ${f.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="rounded-full px-2.5 py-1 text-xs font-semibold text-[#3525cd] hover:bg-[#f9f2f0] dark:text-[#c3c0ff] dark:hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd]"
      >
        {fr ? "Tout effacer" : "Efase tout"}
      </button>
    </div>
  );
}
