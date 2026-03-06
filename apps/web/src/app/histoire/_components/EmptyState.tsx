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
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-white/60 py-14 text-center dark:border-stone-700 dark:bg-stone-800/40">
      <BookOpen className="mb-3 h-10 w-10 text-stone-300 dark:text-stone-600" />
      {dateLabel && (
        <p className="mb-1 text-sm font-medium text-stone-500 dark:text-stone-400">
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
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600/10 px-4 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-600/20 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25"
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          {fr ? "Retour à aujourd\u2019hui" : "Retounen jodi a"}
        </button>
      )}
    </div>
  );
}
