import type { ContentLanguage } from "@edlight-news/types";
import { Clock, AlertTriangle } from "lucide-react";
import {
  getDeadlineStatus,
  formatDeadlineDateShort,
} from "@/lib/ui/deadlines";

/* Supports three call patterns:
   1. <DeadlineBadge item={article} lang="fr" />            — item.deadline is string | object
   2. <DeadlineBadge dateISO="2025-09-01" lang="fr" />      — direct ISO string
   3. <DeadlineBadge item={{ deadline: { dateISO: "..." } }} lang="fr" />  */
interface DeadlineBadgeBaseProps {
  lang: ContentLanguage;
  windowDays?: number;
  variant?: string;
  prefix?: { fr: string; ht: string };
}

interface ItemProps extends DeadlineBadgeBaseProps {
  item: { deadline?: string | { dateISO?: string } | null };
  dateISO?: never;
}

interface DirectProps extends DeadlineBadgeBaseProps {
  dateISO: string;
  item?: never;
}

export type DeadlineBadgeProps = ItemProps | DirectProps;

/** Urgency-based color scheme matching DeadlinePill. */
function urgencyColors(daysLeft: number): string {
  if (daysLeft <= 7) {
    return "bg-red-50 text-red-700 ring-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/30";
  }
  if (daysLeft <= 21) {
    return "bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/30";
  }
  return "bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/30";
}

export function DeadlineBadge(props: DeadlineBadgeProps) {
  const { lang, windowDays = 30 } = props;

  let iso: string | undefined;
  if ("dateISO" in props && props.dateISO) {
    iso = props.dateISO;
  } else if (props.item?.deadline) {
    const dl = props.item.deadline;
    iso = typeof dl === "string" ? dl : dl?.dateISO;
  }

  if (!iso) return null;

  const st = getDeadlineStatus(iso, lang);

  // Bail if no known date or outside window
  if (st.daysLeft === null) return null;
  if (st.daysLeft < 0 || st.daysLeft > windowDays) return null;

  const shortDate = formatDeadlineDateShort(iso, lang);
  const prefixText = props.prefix
    ? (lang === "fr" ? props.prefix.fr : props.prefix.ht) + " · "
    : "";

  const colors = urgencyColors(st.daysLeft);
  const Icon = st.daysLeft <= 7 ? AlertTriangle : Clock;

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      {/* Badge */}
      <span
        className={[
          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset tabular-nums transition-colors",
          colors,
        ].join(" ")}
      >
        <Icon className="h-3 w-3" />
        {prefixText}{st.badgeLabel}
      </span>
      {/* Date + human countdown */}
      {shortDate && (
        <span className="text-[11px] text-stone-400 dark:text-stone-500">
          {shortDate} · {st.humanLine}
        </span>
      )}
    </span>
  );
}
