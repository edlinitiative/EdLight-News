/**
 * EmptyState — shown when a selected date has no history entries.
 */

import { BookOpen } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";

interface EmptyStateProps {
  lang: ContentLanguage;
  dateLabel?: string;
}

export function EmptyState({ lang, dateLabel }: EmptyStateProps) {
  const fr = lang === "fr";
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-white/60 py-14 text-center dark:border-stone-700 dark:bg-stone-800/40">
      <BookOpen className="mb-3 h-10 w-10 text-stone-300 dark:text-stone-600" />
      {dateLabel && (
        <p className="mb-1 text-sm font-medium text-stone-500 dark:text-stone-400">
          {dateLabel}
        </p>
      )}
      <p className="text-sm text-stone-400 dark:text-stone-500">
        {fr
          ? "Aucun événement historique pour cette date."
          : "Pa gen evènman istorik pou dat sa a."}
      </p>
      <p className="mt-2 text-xs italic text-stone-400/70 dark:text-stone-500/70">
        {fr ? "On enrichit l'almanach 📚" : "N ap anrichi almanak la 📚"}
      </p>
    </div>
  );
}
