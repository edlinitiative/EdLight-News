import type { ContentLanguage } from "@edlight-news/types";
import { Clock } from "lucide-react";
import { parseISODateSafe, daysUntil } from "@/lib/deadlines";

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

  const date = parseISODateSafe(iso);
  if (!date) return null;

  const days = daysUntil(date);
  if (days < 0 || days > windowDays) return null;

  const fr = lang === "fr";
  let text: string;
  let style: string;

  if (days === 0) {
    text = fr ? "Aujourd'hui" : "Jodi a";
    style = "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400";
  } else if (days <= 7) {
    text = fr ? `${days}j restants` : `${days}j rete`;
    style = "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  } else {
    text = fr ? `${days}j` : `${days}j`;
    style = "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400";
  }

  const prefixText = props.prefix ? (fr ? props.prefix.fr : props.prefix.ht) + " · " : "";

  return (
    <span className={`badge ${style}`}>
      <Clock className="h-3 w-3" />
      {prefixText}{text}
    </span>
  );
}
