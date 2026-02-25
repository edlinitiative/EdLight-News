/**
 * UrgentDeadlines — compact countdown cards for the next 14 days.
 *
 * Receives the pre-bucketed urgent slice (max 6 items, sorted ascending).
 * Color coded: 🔴 ≤5 days · 🟠 6–10 days · 🟢 11–14 days
 */

import type { ContentLanguage } from "@edlight-news/types";
import { ExternalLink } from "lucide-react";
import type { CalendarItem } from "./types";
import { getItemTitle, getItemDateISO } from "./types";
import { parseISODateSafe, daysUntil } from "@/lib/deadlines";

interface Props {
  items: CalendarItem[];
  lang: ContentLanguage;
}

interface UrgencyStyle {
  emoji: string;
  textColor: string;
  borderColor: string;
  bgColor: string;
}

function urgencyStyle(days: number): UrgencyStyle {
  if (days <= 5)
    return {
      emoji: "🔴",
      textColor: "text-red-600",
      borderColor: "border-red-200",
      bgColor: "bg-red-50",
    };
  if (days <= 10)
    return {
      emoji: "🟠",
      textColor: "text-brand-600",
      borderColor: "border-brand-200",
      bgColor: "bg-brand-50",
    };
  return {
      emoji: "🟢",
      textColor: "text-green-600",
      borderColor: "border-green-200",
      bgColor: "bg-green-50",
    };
}

export function UrgentDeadlines({ items, lang }: Props) {
  const fr = lang === "fr";
  const now = new Date();

  if (items.length === 0) return null;

  return (
    <section
      aria-label={fr ? "Délais urgents" : "Dat limit ijan"}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span aria-hidden>🚨</span>
        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
          {fr
            ? "Délais urgents — 14 prochains jours"
            : "Dat limit ijan — 14 jou k ap vini yo"}
        </h2>
        <span className="rounded-full bg-red-100 px-2 py-px text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {items.length}
        </span>
      </div>

      {/* Cards — horizontal scroll on mobile, grid on sm+ */}
      <div className="flex gap-3 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3">
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
          const style = days !== null ? urgencyStyle(days) : null;

          return (
            <div
              key={item.id}
              className={[
                "flex min-w-[220px] flex-col gap-2 rounded-xl border p-3 shadow-sm sm:min-w-0",
                style
                  ? `${style.borderColor} ${style.bgColor} dark:border-slate-700 dark:bg-slate-900/60`
                  : "border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-900/60",
              ].join(" ")}
            >
              {/* Countdown + geo row */}
              <div className="flex items-start justify-between gap-1">
                <span
                  className={[
                    "text-xl font-extrabold tabular-nums leading-none",
                    style ? style.textColor : "text-gray-500",
                  ].join(" ")}
                >
                  {style?.emoji}{" "}
                  {days === null
                    ? "—"
                    : days === 0
                      ? fr
                        ? "Aujourd'hui"
                        : "Jodi a"
                      : days === 1
                        ? fr
                          ? "Demain"
                          : "Demen"
                        : `${days} ${fr ? "j" : "jou"}`}
                </span>

                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className={[
                      "rounded-full px-1.5 py-px text-[10px] font-semibold",
                      isHaiti
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                    ].join(" ")}
                  >
                    {isHaiti ? (fr ? "Haïti" : "Ayiti") : "Intl"}
                  </span>
                  {isHaitianAudience && !isHaiti && (
                    <span className="rounded-full bg-violet-100 px-1.5 py-px text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                      {fr ? "Pour Haïti" : "Pou Ayiti"}
                    </span>
                  )}
                </div>
              </div>

              {/* Title */}
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 dark:text-slate-100">
                {title}
              </p>

              {/* Date + link */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {date
                    ? date.toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"}
                </span>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold text-brand-700 hover:bg-white/60 dark:text-brand-300 dark:hover:bg-slate-800/60"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {fr ? "Voir" : "Wè"}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
