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
  accent: string;
  primaryAction: string;
}

const HERO_THEMES: Record<HeroVariant, PageHeroTheme> = {
  home: {
    accent: "bg-blue-600 dark:bg-blue-500",
    primaryAction: "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400",
  },
  news: {
    accent: "bg-stone-900 dark:bg-stone-100",
    primaryAction: "bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white",
  },
  haiti: {
    accent: "bg-red-600 dark:bg-red-500",
    primaryAction: "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400",
  },
  resources: {
    accent: "bg-emerald-600 dark:bg-emerald-500",
    primaryAction: "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400",
  },
  success: {
    accent: "bg-amber-500 dark:bg-amber-400",
    primaryAction: "bg-amber-500 text-stone-950 hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300",
  },
  bourses: {
    accent: "bg-indigo-600 dark:bg-indigo-500",
    primaryAction: "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400",
  },
  opportunities: {
    accent: "bg-orange-500 dark:bg-orange-400",
    primaryAction: "bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-400 dark:text-stone-950 dark:hover:bg-orange-300",
  },
  calendar: {
    accent: "bg-cyan-600 dark:bg-cyan-500",
    primaryAction: "bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-400",
  },
  pathways: {
    accent: "bg-violet-600 dark:bg-violet-500",
    primaryAction: "bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400",
  },
  universities: {
    accent: "bg-teal-600 dark:bg-teal-500",
    primaryAction: "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400",
  },
  history: {
    accent: "bg-amber-600 dark:bg-amber-500",
    primaryAction: "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400",
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
    <section className="border-b border-stone-200 bg-white pb-8 pt-6 dark:border-stone-800 dark:bg-stone-900 sm:pb-10 sm:pt-8">
      <div
        className={`grid gap-8 ${hasSide ? "lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end" : ""}`}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-white ${theme.accent}`}
            >
              {icon}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400 dark:text-stone-500">
              {eyebrow}
            </span>
          </div>

          <div className="max-w-3xl space-y-2">
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-stone-900 dark:text-white sm:text-3xl lg:text-4xl">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-stone-500 dark:text-stone-400 sm:text-base">
              {description}
            </p>
          </div>

          {children}

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-3 pt-1">
              {actions.map((action, index) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`inline-flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    index === 0
                      ? theme.primaryAction
                      : "border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                  }`}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {hasSide && (
          <div className="space-y-3">
            {stats.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-2">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-stone-200 bg-stone-50 p-3.5 dark:border-stone-700 dark:bg-stone-800"
                  >
                    <p className="text-2xl font-extrabold tabular-nums text-stone-900 dark:text-white">
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
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
