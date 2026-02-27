"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUpDown } from "lucide-react";

const SORT_OPTIONS = [
  { value: "deadline",  fr: "Deadline proche", ht: "Dat limit pi pre" },
  { value: "relevance", fr: "Pertinence",      ht: "Pètinans" },
  { value: "latest",    fr: "Dernières",       ht: "Dènye yo" },
] as const;

interface SortMenuPillProps {
  sortMode: string;
  onSort: (mode: string) => void;
  fr: boolean;
}

export function SortMenuPill({ sortMode, onSort, fr }: SortMenuPillProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const active = SORT_OPTIONS.find((o) => o.value === sortMode) ?? SORT_OPTIONS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <ArrowUpDown className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{fr ? "Trier" : "Triye"}</span>
        <span className="text-stone-300 dark:text-stone-600">·</span>
        <span>{fr ? active.fr : active.ht}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 min-w-[170px] rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-700 dark:bg-stone-800">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSort(opt.value);
                setOpen(false);
              }}
              className={`w-full rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                sortMode === opt.value
                  ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                  : "text-stone-600 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-700"
              }`}
            >
              {fr ? opt.fr : opt.ht}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
