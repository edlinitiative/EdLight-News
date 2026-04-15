import type { ContentLanguage } from "@edlight-news/types";

interface DeadlinePillProps {
  deadline?: string | null;
  lang: ContentLanguage;
}

/**
 * Compact deadline indicator for opportunity cards.
 * Returns null if no valid future deadline is provided.
 */
export function DeadlinePill({ deadline, lang }: DeadlinePillProps) {
  if (!deadline) return null;
  let label = "";
  try {
    const d = new Date(deadline);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
    if (daysLeft < 0) return null;
    const locale = lang === "ht" ? "fr-HT" : "fr-FR";
    const dateStr = d.toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    label = lang === "fr" ? `Limite : ${dateStr}` : `Limit : ${dateStr}`;
  } catch {
    return null;
  }
  return (
    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      {label}
    </span>
  );
}
