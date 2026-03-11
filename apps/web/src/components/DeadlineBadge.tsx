import type { ContentLanguage } from "@edlight-news/types";
import { Clock } from "lucide-react";
import {
  getDeadlineStatus,
  formatDeadlineDateShort,
  badgeStyle,
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

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      {/* Badge */}
      <span className={`badge ${badgeStyle(st.badgeVariant)}`}>
        <Clock className="h-3 w-3" />
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
