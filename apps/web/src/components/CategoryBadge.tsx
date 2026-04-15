import type { ContentLanguage } from "@edlight-news/types";
import { categoryLabel, CATEGORY_COLORS } from "@/lib/utils";

interface CategoryBadgeProps {
  category?: string;
  lang: ContentLanguage;
  /** Use rounded-full pill shape instead of default rounded */
  pill?: boolean;
}

/**
 * Premium category badge — small coloured pill.
 * Upgraded styling: rounded-full, tighter tracking, stronger visual presence.
 */
export function CategoryBadge({ category, lang, pill = false }: CategoryBadgeProps) {
  if (!category) return null;
  const color =
    CATEGORY_COLORS[category] ??
    "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300";
  const label = categoryLabel(category, lang);
  if (!label) return null;
  return (
    <span
      className={[
        "inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        pill ? "rounded-full" : "rounded",
        color,
      ].join(" ")}
    >
      {label}
    </span>
  );
}
