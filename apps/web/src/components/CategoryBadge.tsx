import type { ContentLanguage } from "@edlight-news/types";
import { categoryLabel, CATEGORY_COLORS } from "@/lib/utils";

interface CategoryBadgeProps {
  category: string;
  lang: ContentLanguage;
  pill?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const PREMIUM_COLORS: Record<string, string> = {
  news: "bg-blue-50 text-blue-700 ring-blue-200/50 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800/30",
  local_news: "bg-red-50 text-red-700 ring-red-200/50 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/30",
  scholarship: "bg-amber-50 text-amber-700 ring-amber-200/50 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/30",
  opportunity: "bg-amber-50 text-amber-700 ring-amber-200/50 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/30",
  bourses: "bg-amber-50 text-amber-700 ring-amber-200/50 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/30",
  concours: "bg-orange-50 text-orange-700 ring-orange-200/50 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-800/30",
  stages: "bg-teal-50 text-teal-700 ring-teal-200/50 dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-800/30",
  programmes: "bg-indigo-50 text-indigo-700 ring-indigo-200/50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800/30",
  resource: "bg-violet-50 text-violet-700 ring-violet-200/50 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/30",
  education: "bg-sky-50 text-sky-700 ring-sky-200/50 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/30",
  business: "bg-emerald-50 text-emerald-700 ring-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/30",
  technology: "bg-cyan-50 text-cyan-700 ring-cyan-200/50 dark:bg-cyan-950/40 dark:text-cyan-300 dark:ring-cyan-800/30",
  opinion: "bg-purple-50 text-purple-700 ring-purple-200/50 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-800/30",
  world: "bg-emerald-50 text-emerald-700 ring-emerald-200/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/30",
};

const FALLBACK = "bg-stone-100 text-stone-600 ring-stone-200/50 dark:bg-stone-700 dark:text-stone-300 dark:ring-stone-600/30";

export function CategoryBadge({
  category,
  lang,
  pill = false,
  size = "sm",
  className = "",
}: CategoryBadgeProps) {
  const label = categoryLabel(category, lang);
  if (!label) return null;

  const colors = PREMIUM_COLORS[category] ?? FALLBACK;
  const sizeClasses = size === "md"
    ? "px-3 py-1 text-xs"
    : "px-2.5 py-0.5 text-[11px]";

  return (
    <span
      className={[
        "inline-flex items-center gap-1 font-semibold uppercase tracking-wide ring-1 ring-inset transition-colors",
        pill ? "rounded-full" : "rounded-lg",
        sizeClasses,
        colors,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label}
    </span>
  );
}
