"use client";

import { Clock, AlertTriangle } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { daysUntil, parseISODateSafe } from "@/lib/deadlines";

interface DeadlinePillProps {
  deadline?: string | null;
  lang: ContentLanguage;
  className?: string;
}

export function DeadlinePill({ deadline, lang, className = "" }: DeadlinePillProps) {
  if (!deadline) return null;

  const date = parseISODateSafe(deadline);
  if (!date) return null;

  const days = daysUntil(date);
  if (days < 0) return null;

  const fr = lang === "fr";

  // Urgency styling
  let colorClasses: string;
  let Icon = Clock;
  let label: string;

  if (days <= 7) {
    colorClasses = "bg-red-50 text-red-700 ring-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/30";
    Icon = AlertTriangle;
    label = days === 0
      ? (fr ? "Aujourd'hui !" : "Jodi a !")
      : days === 1
        ? (fr ? "Demain" : "Demen")
        : `${days}j`;
  } else if (days <= 21) {
    colorClasses = "bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/30";
    label = `${days}j`;
  } else {
    colorClasses = "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/30";
    label = `${days}j`;
  }

  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset tabular-nums transition-colors",
        colorClasses,
        className,
      ].join(" ")}
      title={date.toLocaleDateString(fr ? "fr-FR" : "fr-HT", { dateStyle: "long" })}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
