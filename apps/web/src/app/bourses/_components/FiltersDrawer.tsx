"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/* ── Types ────────────────────────────────────────────────────────────── */

interface ChipOption {
  key: string;
  label: string;
}

export interface FilterGroup {
  paramKey: string;
  title: string;
  options: ChipOption[];
  activeValue: string;
}

interface FiltersDrawerProps {
  open: boolean;
  onClose: () => void;
  groups: FilterGroup[];
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
  fr: boolean;
}

/* ── Component ────────────────────────────────────────────────────────── */

export function FiltersDrawer({
  open,
  onClose,
  groups,
  onFilterChange,
  onReset,
  fr,
}: FiltersDrawerProps) {
  /* Lock body scroll while open */
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  /* Close on Escape */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* ── Panel ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={fr ? "Filtres avancés" : "Filtè avanse"}
        className={[
          "fixed z-50 flex flex-col bg-white shadow-xl transition-transform duration-300 ease-out dark:bg-stone-900",
          // Mobile: bottom sheet
          "inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl",
          // Desktop: right-side panel
          "md:inset-y-0 md:right-0 md:left-auto md:w-96 md:max-h-none md:rounded-t-none md:rounded-l-2xl",
          // Slide animation
          open
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3.5 dark:border-stone-700">
          <h2 className="text-sm font-bold text-stone-800 dark:text-stone-200">
            {fr ? "Filtres avancés" : "Filtè avanse"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter groups */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {groups.map((group) => (
            <div key={group.paramKey}>
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                {group.title}
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {group.options.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => onFilterChange(group.paramKey, opt.key)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      group.activeValue === opt.key
                        ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900"
                        : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 px-5 py-3.5 dark:border-stone-700">
          <button
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
            className="w-full rounded-xl border border-stone-200 bg-white py-2 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {fr ? "Réinitialiser" : "Reyinisyalize"}
          </button>
        </div>
      </div>
    </>
  );
}
