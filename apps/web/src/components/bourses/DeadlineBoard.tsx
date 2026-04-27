"use client";

/**
 * DeadlineBoard — Compact horizontal strip of upcoming scholarship deadlines.
 * Shows top items sorted by soonest deadline with countdown chips.
 * Clicking "Voir" scrolls to the matching card in the catalogue.
 */

import type { ContentLanguage } from "@edlight-news/types";
import { Clock, ArrowRight } from "lucide-react";
import {
  getDeadlineStatus,
  formatDeadlineDateShort,
  badgeStyle,
} from "@/lib/ui/deadlines";
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

export function DeadlineBoard({ scholarships, lang, max = 8 }: DeadlineBoardProps) {
  const fr = lang === "fr";

  const upcoming = scholarships
    .filter((s) => {
      if (!s.deadline?.dateISO) return false;
      const st = getDeadlineStatus(s.deadline.dateISO, lang);
      return st.daysLeft !== null && st.daysLeft >= 0;
    })
    .sort((a, b) => {
      const aS = getDeadlineStatus(a.deadline!.dateISO!, lang);
      const bS = getDeadlineStatus(b.deadline!.dateISO!, lang);
      return (aS.daysLeft ?? 9999) - (bS.daysLeft ?? 9999);
    })
    .slice(0, max);

  if (upcoming.length === 0) return null;

  function scrollToCard(id: string) {
    const el = document.getElementById(`scholarship-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-[#3525cd]", "ring-offset-2");
      setTimeout(() => el.classList.remove("ring-2", "ring-[#3525cd]", "ring-offset-2"), 2000);
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2.5 text-[13px] sm:text-sm font-bold uppercase tracking-[0.15em] text-[#1d1b1a] dark:text-stone-200">
          <span className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-[#ffdad6]/70 dark:bg-red-950/40">
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#93000a]" />
          </span>
          {fr ? "Deadline bientôt" : "Dat limit byento"}
        </h2>
        <span className="text-[10px] sm:text-xs font-semibold text-[#474948] dark:text-stone-500 tabular-nums bg-[#f5f0ee] dark:bg-stone-800 rounded-full px-2.5 py-1">
          {upcoming.length} {fr ? "à venir" : "k ap vini"}
        </span>
      </div>

      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-3 scrollbar-none snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth">
        {upcoming.map((s) => {
          const st = getDeadlineStatus(s.deadline!.dateISO!, lang);
          const shortDate = formatDeadlineDateShort(s.deadline!.dateISO!, lang);
          const flag = COUNTRY_CODES[s.country] ?? "";
          const isCritical = st.badgeVariant === "today" || (st.daysLeft !== null && st.daysLeft <= 2);
          const isUrgent = st.badgeVariant === "urgent";

          return (
            <button
              type="button"
              key={s.id}
              onClick={() => scrollToCard(s.id)}
              className={`group flex min-w-[165px] sm:min-w-[220px] max-w-[165px] sm:max-w-[260px] snap-start flex-col justify-between rounded-2xl border p-3 sm:p-3.5 text-left transition-all duration-300 active:scale-[0.97] active:opacity-85 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(29,27,26,0.06)] sm:hover:shadow-[0_20px_48px_rgba(29,27,26,0.1)] ${
                isCritical
                  ? "border-[#ffdad6] bg-[#ffdad6]/40 dark:border-red-800/40 dark:bg-red-950/25"
                  : isUrgent
                    ? "border-amber-200 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-950/20"
                    : "border-[#c7c4d8]/8 bg-white dark:border-stone-700/60 dark:bg-stone-900/80"
              }`}
            >
              <div>
                <p className="line-clamp-2 text-[12px] sm:text-sm font-bold font-display leading-snug text-[#1d1b1a] dark:text-white group-hover:text-[#3525cd] dark:group-hover:text-[#c3c0ff] transition-colors">
                  {s.name}
                </p>
                <div className="mt-2 sm:mt-2.5 flex flex-wrap items-center gap-1 sm:gap-1.5">
                  {flag && (
                    <span className="text-sm sm:text-sm leading-none" title={s.country}>
                      {flag}
                    </span>
                  )}
                  {shortDate && (
                    <span className="text-[10px] sm:text-xs text-[#474948] dark:text-stone-400 font-medium">
                      {shortDate}
                    </span>
                  )}
                  <span className={`rounded-full px-2 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold ${badgeStyle(st.badgeVariant)}`}>
                    {st.badgeLabel}
                  </span>
                </div>
                <p className="mt-1.5 text-[10px] sm:text-[11px] text-[#474948] dark:text-stone-500 leading-tight">
                  {st.humanLine}
                </p>
              </div>
              <span className="mt-2.5 sm:mt-3 inline-flex items-center gap-1.5 self-start text-[11px] sm:text-xs font-bold text-[#3525cd] dark:text-[#c3c0ff] group-hover:gap-2 transition-all">
                {fr ? "Voir" : "Wè"}
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
