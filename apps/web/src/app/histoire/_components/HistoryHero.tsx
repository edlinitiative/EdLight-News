/**
 * HistoryHero — "Fait du Jour" hero section.
 *
 * Shows 1–3 top facts for the selected date prominently.
 * If fewer than 3 facts are available, a subtle hint is shown.
 */

import type { ContentLanguage } from "@edlight-news/types";
import { Star } from "lucide-react";
import { HistoryCard } from "./HistoryCard";
import { formatMonthDay } from "./shared";
import type { SerializableAlmanacEntry, SerializableHoliday } from "./shared";

/** Sort: high confidence first, then by year descending (newest first). */
function sortForHero(entries: SerializableAlmanacEntry[]): SerializableAlmanacEntry[] {
  return [...entries].sort((a, b) => {
    if (a.confidence === "high" && b.confidence !== "high") return -1;
    if (a.confidence !== "high" && b.confidence === "high") return 1;
    return (b.year ?? 0) - (a.year ?? 0);
  });
}

interface HistoryHeroProps {
  entries: SerializableAlmanacEntry[];
  holidays: SerializableHoliday[];
  selectedDate: string; // MM-DD
  lang: ContentLanguage;
}

export function HistoryHero({ entries, holidays, selectedDate, lang }: HistoryHeroProps) {
  const fr = lang === "fr";
  const sorted = sortForHero(entries);
  const heroEntries = sorted.slice(0, 3);

  return (
    <section className="space-y-5">
      {/* Date label */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight text-stone-900 dark:text-white sm:text-xl">
          📅{" "}
          <span className="text-blue-700 dark:text-blue-300">
            {formatMonthDay(selectedDate, lang)}
          </span>
        </h2>
        <span className="text-xs text-stone-400 dark:text-stone-500">
          {entries.length} {fr ? "événement" : "evènman"}{entries.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Holiday banners (if any for this date) */}
      {holidays.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {holidays.map((h) => (
            <div
              key={h.id}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100/60 px-3.5 py-2 text-sm font-medium text-blue-700 dark:from-blue-900/30 dark:to-blue-900/20 dark:text-blue-300"
            >
              <Star className="h-3.5 w-3.5 text-amber-500" />
              {fr ? h.name_fr : h.name_ht}
              {h.isNationalHoliday && (
                <span className="ml-1 rounded-full bg-blue-200/60 px-2 py-0.5 text-[10px] font-semibold uppercase dark:bg-blue-800/40">
                  {fr ? "National" : "Nasyonal"}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Hero cards */}
      {heroEntries.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* First card spans full width on lg if only 1, or left column */}
          <div className={heroEntries.length === 1 ? "lg:col-span-2" : ""}>
            <HistoryCard entry={heroEntries[0]!} lang={lang} variant="hero" />
          </div>
          {heroEntries.slice(1).map((entry) => (
            <HistoryCard key={entry.id} entry={entry} lang={lang} variant="hero" />
          ))}
        </div>
      ) : null}

      {/* Fewer than 3 hint */}
      {heroEntries.length > 0 && heroEntries.length < 3 && (
        <p className="text-center text-xs italic text-stone-400/80 dark:text-stone-500/80">
          {fr ? "On enrichit l'almanach 📚" : "N ap anrichi almanak la 📚"}
        </p>
      )}
    </section>
  );
}
