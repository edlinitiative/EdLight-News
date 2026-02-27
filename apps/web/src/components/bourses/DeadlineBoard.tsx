"use client";

/**
 * DeadlineBoard — Compact horizontal strip of upcoming scholarship deadlines.
 * Shows top items sorted by soonest deadline with countdown chips.
 * Clicking "Voir" scrolls to the matching card in the catalogue.
 */

import type { ContentLanguage } from "@edlight-news/types";
import { Clock, ArrowRight } from "lucide-react";
import { daysUntilISO, countdownChip } from "@/lib/bourses-ui";
import type { SerializedScholarship } from "@/components/BoursesFilters";

interface DeadlineBoardProps {
  scholarships: SerializedScholarship[];
  lang: ContentLanguage;
  max?: number;
}

const COUNTRY_CODES: Record<string, string> = {
  US: "🇺🇸",
  CA: "🇨🇦",
  FR: "🇫🇷",
  UK: "🇬🇧",
  DO: "🇩🇴",
  MX: "🇲🇽",
  CN: "🇨🇳",
  RU: "🇷🇺",
  HT: "🇭🇹",
  Global: "🌍",
};

function formatDeadlineShort(dateISO: string, lang: ContentLanguage): string {
  try {
    return new Date(dateISO + (dateISO.length === 10 ? "T00:00:00" : "")).toLocaleDateString(
      lang === "fr" ? "fr-FR" : "fr-HT",
      { day: "numeric", month: "short" },
    );
  } catch {
    return dateISO;
  }
}

export function DeadlineBoard({ scholarships, lang, max = 8 }: DeadlineBoardProps) {
  const fr = lang === "fr";

  const upcoming = scholarships
    .filter((s) => {
      if (!s.deadline?.dateISO) return false;
      const days = daysUntilISO(s.deadline.dateISO);
      return days !== null && days >= 0;
    })
    .sort((a, b) => {
      const aD = daysUntilISO(a.deadline!.dateISO!) ?? 9999;
      const bD = daysUntilISO(b.deadline!.dateISO!) ?? 9999;
      return aD - bD;
    })
    .slice(0, max);

  if (upcoming.length === 0) return null;

  function scrollToCard(id: string) {
    const el = document.getElementById(`scholarship-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-blue-400", "ring-offset-2");
      setTimeout(() => el.classList.remove("ring-2", "ring-blue-400", "ring-offset-2"), 2000);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-stone-800 dark:text-stone-200">
          <Clock className="h-4 w-4 text-amber-500" />
          {fr ? "Deadline bientôt" : "Dat limit byento"}
        </h2>
        <span className="text-xs text-stone-400 dark:text-stone-500">
          {upcoming.length} {fr ? "à venir" : "k ap vini"}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-200 dark:scrollbar-thumb-stone-700 snap-x snap-mandatory">
        {upcoming.map((s) => {
          const days = daysUntilISO(s.deadline!.dateISO!);
          const chip = countdownChip(s.deadline!.dateISO!, lang);
          const flag = COUNTRY_CODES[s.country] ?? "";
          const isUrgent = days !== null && days <= 7;
          const isCritical = days !== null && days <= 2;

          return (
            <div
              key={s.id}
              className={`group flex min-w-[220px] max-w-[260px] snap-start flex-col justify-between rounded-xl border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${
                isCritical
                  ? "border-red-200 bg-red-50/60 dark:border-red-800/40 dark:bg-red-950/20"
                  : isUrgent
                    ? "border-amber-200 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/15"
                    : "border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900/60"
              }`}
            >
              <div>
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900 dark:text-white">
                  {s.name}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {flag && (
                    <span className="text-xs" title={s.country}>
                      {flag}
                    </span>
                  )}
                  <span className="text-xs text-stone-500 dark:text-stone-400">
                    {formatDeadlineShort(s.deadline!.dateISO!, lang)}
                  </span>
                  {chip && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        isCritical
                          ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                          : isUrgent
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}
                    >
                      {chip}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => scrollToCard(s.id)}
                className="mt-3 inline-flex items-center gap-1 self-start text-xs font-semibold text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {fr ? "Voir" : "Wè"}
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
