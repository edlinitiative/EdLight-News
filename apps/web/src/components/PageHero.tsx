import Link from "next/link";
import type { ReactNode } from "react";

type HeroVariant =
  | "home"
  | "news"
  | "haiti"
  | "resources"
  | "success"
  | "bourses"
  | "opportunities"
  | "calendar"
  | "pathways"
  | "universities"
  | "history";

interface PageHeroStat {
  label: string;
  value: string;
}

interface PageHeroAction {
  href: string;
  label: string;
}

interface PageHeroTheme {
  shell: string;
  iconWrap: string;
  eyebrow: string;
  primaryAction: string;
  secondaryAction: string;
  statCard: string;
}

const HERO_THEMES: Record<HeroVariant, PageHeroTheme> = {
  home: {
    shell:
      "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-stone-900",
    iconWrap:
      "bg-blue-600 text-white shadow-[0_18px_40px_-24px_rgba(37,99,235,0.85)] dark:bg-blue-500",
    eyebrow: "text-blue-700 dark:text-blue-300",
    primaryAction:
      "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400",
    secondaryAction:
      "border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:bg-stone-800 dark:text-blue-200 dark:hover:bg-stone-700",
    statCard:
      "border border-blue-100 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800",
  },
  news: {
    shell:
      "border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900",
    iconWrap:
      "bg-stone-900 text-white shadow-[0_18px_40px_-24px_rgba(28,25,23,0.8)] dark:bg-stone-100 dark:text-stone-900",
    eyebrow: "text-stone-600 dark:text-stone-300",
    primaryAction:
      "bg-stone-900 text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white",
    secondaryAction:
      "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700",
    statCard:
      "border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800",
  },
  haiti: {
    shell:
      "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-stone-900",
    iconWrap: "bg-red-600 text-white dark:bg-red-500",
    eyebrow: "text-sky-700 dark:text-sky-300",
    primaryAction:
      "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400",
    secondaryAction:
      "border border-sky-200 bg-white text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:bg-stone-800 dark:text-sky-200 dark:hover:bg-stone-700",
    statCard:
      "border border-sky-100 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800",
  },
  resources: {
    shell:
      "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-stone-900",
    iconWrap: "bg-emerald-600 text-white dark:bg-emerald-500",
    eyebrow: "text-emerald-700 dark:text-emerald-300",
    primaryAction:
      "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400",
    secondaryAction:
      "border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-stone-800 dark:text-emerald-200 dark:hover:bg-stone-700",
    statCard:
      "border border-emerald-100 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800",
  },
  success: {
    shell:
      "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-stone-900",
    iconWrap: "bg-amber-500 text-stone-950 dark:bg-amber-400",
    eyebrow: "text-amber-700 dark:text-amber-300",
    primaryAction:
      "bg-amber-500 text-stone-950 hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300",
    secondaryAction:
      "border border-amber-200 bg-white text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:bg-stone-800 dark:text-amber-200 dark:hover:bg-stone-700",
    statCard:
      "border border-amber-100 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800",
  },
  bourses: {
    shell:
      "border-indigo-200 bg-indigo-50 dark:border-indigo-900 dark:bg-stone-900",
    iconWrap: "bg-indigo-600 text-white dark:bg-indigo-500",
    eyebrow: "text-indigo-700 dark:text-indigo-300",
    primaryAction:
      "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400",
    secondaryAction:
      "border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-stone-800 dark:text-indigo-200 dark:hover:bg-stone-700",
    statCard:
      "border border-indigo-100 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800",
  },
  opportunities: {
    shell:
      "border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-stone-900",
    iconWrap: "bg-orange-500 text-white dark:bg-orange-400",
    eyebrow: "text-orange-700 dark:text-orange-300",
    primaryAction:
      "bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-400 dark:text-stone-950 dark:hover:bg-orange-300",
    secondaryAction:
      "border border-orange-200 bg-white text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:bg-stone-800 dark:text-orange-200 dark:hover:bg-stone-700",
    statCard:
      "border border-orange-100 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800",
  },
  calendar: {
    shell:
      "border-cyan-200 bg-cyan-50 dark:border-cyan-900 dark:bg-stone-900",
    iconWrap: "bg-cyan-600 text-white dark:bg-cyan-500",
    eyebrow: "text-cyan-700 dark:text-cyan-300",
    primaryAction:
      "bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-400",
    secondaryAction:
      "border border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:bg-stone-800 dark:text-cyan-200 dark:hover:bg-stone-700",
    statCard:
      "border border-cyan-100 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800",
  },
  pathways: {
    shell:
      "border-violet-200 bg-violet-50 dark:border-violet-900 dark:bg-stone-900",
    iconWrap: "bg-violet-600 text-white dark:bg-violet-500",
    eyebrow: "text-violet-700 dark:text-violet-300",
    primaryAction:
      "bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400",
    secondaryAction:
      "border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 dark:border-violet-800 dark:bg-stone-800 dark:text-violet-200 dark:hover:bg-stone-700",
    statCard:
      "border border-violet-100 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800",
  },
  universities: {
    shell:
      "border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-stone-900",
    iconWrap: "bg-teal-600 text-white dark:bg-teal-500",
    eyebrow: "text-teal-700 dark:text-teal-300",
    primaryAction:
      "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400",
    secondaryAction:
      "border border-teal-200 bg-white text-teal-700 hover:bg-teal-50 dark:border-teal-800 dark:bg-stone-800 dark:text-teal-200 dark:hover:bg-stone-700",
    statCard:
      "border border-teal-100 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800",
  },
  history: {
    shell:
      "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-stone-900",
    iconWrap: "bg-amber-600 text-white dark:bg-amber-500",
    eyebrow: "text-amber-800 dark:text-amber-300",
    primaryAction:
      "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400",
    secondaryAction:
      "border border-amber-200 bg-white text-amber-800 hover:bg-amber-50 dark:border-amber-800 dark:bg-stone-800 dark:text-amber-200 dark:hover:bg-stone-700",
    statCard:
      "border border-amber-100 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-800",
  },
};

export interface PageHeroProps {
  variant: HeroVariant;
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  stats?: PageHeroStat[];
  actions?: PageHeroAction[];
  children?: ReactNode;
  aside?: ReactNode;
}

export function PageHero({
  variant,
  eyebrow,
  title,
  description,
  icon,
  stats = [],
  actions = [],
  children,
  aside,
}: PageHeroProps) {
  const theme = HERO_THEMES[variant];
  const hasSide = stats.length > 0 || !!aside;

  return (
    <section
      className={`rounded-[2rem] border px-5 py-6 shadow-sm sm:px-7 sm:py-8 ${theme.shell}`}
    >
      <div
        className={`grid gap-7 ${hasSide ? "lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end" : ""}`}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${theme.iconWrap}`}
            >
              {icon}
            </span>
            <span
              className={`text-[11px] font-bold uppercase tracking-[0.24em] ${theme.eyebrow}`}
            >
              {eyebrow}
            </span>
          </div>

          <div className="max-w-3xl space-y-3">
            <h1 className="font-serif text-3xl font-black leading-[1.02] tracking-tight text-stone-950 dark:text-white sm:text-4xl lg:text-[3.2rem]">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-300 sm:text-base">
              {description}
            </p>
          </div>

          {children}

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {actions.map((action, index) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 ${
                    index === 0 ? theme.primaryAction : theme.secondaryAction
                  }`}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {hasSide && (
          <div className="space-y-4">
            {stats.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-2">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-2xl p-4 ${theme.statCard}`}
                  >
                    <p className="text-2xl font-black tracking-tight text-stone-950 dark:text-white">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {aside}
          </div>
        )}
      </div>
    </section>
  );
}
