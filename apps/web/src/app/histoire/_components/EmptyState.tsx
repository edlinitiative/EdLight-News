/**
 * EmptyState — shown when a selected date/tab has no data.
 *
 * Now includes actionable navigation: "back to today" button.
 */

import { BookOpen, CalendarCheck } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";

interface EmptyStateProps {
  lang: ContentLanguage;
  dateLabel?: string;
  /** Extra line of context, e.g. "Les personnalités arrivent bientôt" */
  hint?: string;
  /** Callback to navigate back to today */
  onGoToday?: () => void;
}

export function EmptyState({ lang, dateLabel, hint, onGoToday }: EmptyStateProps) {
  const fr = lang === "fr";
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-stone-50/50 py-14 text-center dark:border-stone-700 dark:bg-stone-800/50">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-700/50">
        <BookOpen className="h-6 w-6 text-stone-400 dark:text-stone-500" />
      </div>
      {dateLabel && (
        <p className="mb-1 font-serif text-sm font-medium italic text-stone-500 dark:text-stone-400">
          {dateLabel}
        </p>
      )}
      <p className="text-sm text-stone-400 dark:text-stone-500">
        {hint
          ? hint
          : fr
            ? "Aucun contenu pour cette date."
            : "Pa gen kontni pou dat sa a."}
      </p>
      <p className="mt-2 text-xs italic text-stone-400/70 dark:text-stone-500/70">
        {fr ? "On enrichit l'almanach 📚" : "N ap anrichi almanak la 📚"}
      </p>
      {onGoToday && (
        <button
          onClick={onGoToday}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          {fr ? "Retour à aujourd\u2019hui" : "Retounen jodi a"}
        </button>
      )}
    </div>
  );
}
