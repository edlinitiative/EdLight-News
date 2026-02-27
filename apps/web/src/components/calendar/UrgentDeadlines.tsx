/**
 * UrgentDeadlines — clean countdown list for the next 14 days.
 *
 * Receives the pre-bucketed urgent slice (max 6 items, sorted ascending).
 * Color coded: red ≤5 days · amber 6–10 days · green 11–14 days
 */

import type { ContentLanguage } from "@edlight-news/types";
import { ExternalLink, Clock } from "lucide-react";
import type { CalendarItem } from "./types";
import { getItemTitle, getItemDateISO } from "./types";
import { parseISODateSafe, daysUntil } from "@/lib/deadlines";
import { getDeadlineStatus, formatDeadlineDateShort } from "@/lib/ui/deadlines";

interface Props {
  items: CalendarItem[];
  lang: ContentLanguage;
}

function urgencyClasses(days: number) {
  if (days <= 5)
    return {
      dot: "bg-red-500",
      countdown: "text-red-600 dark:text-red-400",
      bar: "border-l-red-500",
    };
  if (days <= 10)
    return {
      dot: "bg-amber-500",
      countdown: "text-amber-600 dark:text-amber-400",
      bar: "border-l-amber-500",
    };
  return {
    dot: "bg-emerald-500",
    countdown: "text-emerald-600 dark:text-emerald-400",
    bar: "border-l-emerald-500",
  };
}

export function UrgentDeadlines({ items, lang }: Props) {
  const fr = lang === "fr";
  const now = new Date();

  if (items.length === 0) return null;

  return (
    <section
      aria-label={fr ? "Prochaines échéances" : "Pwochen dat limit"}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-red-500" />
        <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
          {fr ? "Prochaines échéances" : "Pwochen dat limit"}
        </h2>
        <span className="rounded-full bg-red-50 px-1.5 py-px text-[11px] font-semibold tabular-nums text-red-600 dark:bg-red-900/25 dark:text-red-300">
          {items.length}
        </span>
      </div>

      {/* Clean list rows */}
      <div className="divide-y divide-stone-100 rounded-xl border border-stone-200/70 bg-white/80 dark:divide-stone-800 dark:border-stone-700/60 dark:bg-stone-900/50">
        {items.map((item) => {
          const dateISO = getItemDateISO(item);
          const date = dateISO ? parseISODateSafe(dateISO) : null;
          const days = date ? daysUntil(date, now) : null;
          const title = getItemTitle(item);
          const isHaiti = item.geo === "Haiti";
          const isHaitianAudience = item.audience === "HaitianStudents";
          const url =
            item.kind === "haiti"
              ? (item.officialUrl ?? null)
              : (item.howToApplyUrl ?? null);
          const uc = days !== null ? urgencyClasses(days) : null;

          const dlStatus = getDeadlineStatus(dateISO, lang);
          const shortDate = formatDeadlineDateShort(dateISO, lang);

          return (
            <div
              key={item.id}
              className={[
                "flex items-center gap-3 px-3.5 py-2.5 border-l-[3px] transition-colors hover:bg-stone-50/80 dark:hover:bg-stone-800/40",
                uc ? uc.bar : "border-l-stone-200 dark:border-l-stone-700",
              ].join(" ")}
            >
              {/* Countdown */}
              <span
                className={[
                  "w-16 shrink-0 text-right text-sm font-bold tabular-nums",
                  uc ? uc.countdown : "text-stone-400",
                ].join(" ")}
              >
                {dlStatus.badgeLabel}
              </span>

              {/* Title + meta */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-stone-800 dark:text-stone-100">
                  {title}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="text-[11px] text-stone-400 dark:text-stone-500">
                    {shortDate ?? "—"}
                  </span>
                  <span className="text-[10px] text-stone-400 dark:text-stone-500">
                    {dlStatus.humanLine}
                  </span>
                  <span
                    className={[
                      "rounded-full px-1.5 py-px text-[10px] font-medium",
                      isHaiti
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300"
                        : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
                    ].join(" ")}
                  >
                    {isHaiti ? "HT" : "Intl"}
                  </span>
                  {isHaitianAudience && !isHaiti && (
                    <span className="rounded-full bg-violet-50 px-1.5 py-px text-[10px] font-medium text-violet-600 dark:bg-violet-900/20 dark:text-violet-300">
                      {fr ? "Haïti" : "Ayiti"}
                    </span>
                  )}
                </div>
              </div>

              {/* Action */}
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-300 transition"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
