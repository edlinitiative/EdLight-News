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
  | "history"
  | "opinion";

interface PageHeroStat {
  label: string;
  value: string;
}

interface PageHeroAction {
  href: string;
  label: string;
}

interface PageHeroTheme {
  /** Tailwind classes for the eyebrow icon box */
  iconBg: string;
  /** Tailwind classes for the icon itself */
  iconColor: string;
  /** Gradient classes for the background strip */
  heroBg: string;
  /** Primary CTA button classes */
  primaryAction: string;
  /** Accent colour for stat values */
  statColor: string;
}

const HERO_THEMES: Record<HeroVariant, PageHeroTheme> = {
  home: {
    iconBg: "bg-blue-600/10 ring-1 ring-blue-600/20",
    iconColor: "text-blue-600 dark:text-blue-400",
    heroBg: "from-blue-50/80 via-white to-white dark:from-blue-950/20 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20",
    statColor: "text-blue-600 dark:text-blue-400",
  },
  news: {
    iconBg: "bg-stone-900/10 ring-1 ring-stone-900/10 dark:bg-stone-100/10 dark:ring-white/10",
    iconColor: "text-stone-900 dark:text-stone-100",
    heroBg: "from-stone-100/60 via-white to-white dark:from-stone-900/50 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-stone-900 text-white hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white",
    statColor: "text-stone-800 dark:text-stone-100",
  },
  haiti: {
    iconBg: "bg-red-600/10 ring-1 ring-red-600/20",
    iconColor: "text-red-600 dark:text-red-400",
    heroBg: "from-red-50/70 via-white to-white dark:from-red-950/20 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-500/20",
    statColor: "text-red-600 dark:text-red-400",
  },
  resources: {
    iconBg: "bg-emerald-600/10 ring-1 ring-emerald-600/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    heroBg: "from-emerald-50/70 via-white to-white dark:from-emerald-950/20 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm shadow-emerald-500/20",
    statColor: "text-emerald-600 dark:text-emerald-400",
  },
  success: {
    iconBg: "bg-amber-500/10 ring-1 ring-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    heroBg: "from-amber-50/70 via-white to-white dark:from-amber-950/20 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-amber-500 text-stone-950 hover:bg-amber-400 shadow-sm shadow-amber-500/20",
    statColor: "text-amber-600 dark:text-amber-400",
  },
  bourses: {
    iconBg: "bg-indigo-600/10 ring-1 ring-indigo-600/20",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    heroBg: "from-indigo-50/70 via-white to-white dark:from-indigo-950/20 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-500/20",
    statColor: "text-indigo-600 dark:text-indigo-400",
  },
  opportunities: {
    iconBg: "bg-orange-500/10 ring-1 ring-orange-500/20",
    iconColor: "text-orange-600 dark:text-orange-400",
    heroBg: "from-orange-50/70 via-white to-white dark:from-orange-950/20 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-orange-500 text-white hover:bg-orange-600 shadow-sm shadow-orange-500/20",
    statColor: "text-orange-600 dark:text-orange-400",
  },
  calendar: {
    iconBg: "bg-cyan-600/10 ring-1 ring-cyan-600/20",
    iconColor: "text-cyan-600 dark:text-cyan-400",
    heroBg: "from-cyan-50/70 via-white to-white dark:from-cyan-950/20 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-cyan-600 text-white hover:bg-cyan-700 shadow-sm shadow-cyan-500/20",
    statColor: "text-cyan-600 dark:text-cyan-400",
  },
  pathways: {
    iconBg: "bg-violet-600/10 ring-1 ring-violet-600/20",
    iconColor: "text-violet-600 dark:text-violet-400",
    heroBg: "from-violet-50/70 via-white to-white dark:from-violet-950/20 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-violet-600 text-white hover:bg-violet-700 shadow-sm shadow-violet-500/20",
    statColor: "text-violet-600 dark:text-violet-400",
  },
  universities: {
    iconBg: "bg-teal-600/10 ring-1 ring-teal-600/20",
    iconColor: "text-teal-600 dark:text-teal-400",
    heroBg: "from-teal-50/70 via-white to-white dark:from-teal-950/20 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-teal-600 text-white hover:bg-teal-700 shadow-sm shadow-teal-500/20",
    statColor: "text-teal-600 dark:text-teal-400",
  },
  history: {
    iconBg: "bg-amber-600/10 ring-1 ring-amber-600/20",
    iconColor: "text-amber-700 dark:text-amber-400",
    heroBg: "from-amber-50/70 via-white to-white dark:from-amber-950/20 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-amber-600 text-white hover:bg-amber-700 shadow-sm shadow-amber-500/20",
    statColor: "text-amber-700 dark:text-amber-400",
  },
  opinion: {
    iconBg: "bg-rose-600/10 ring-1 ring-rose-600/20",
    iconColor: "text-rose-600 dark:text-rose-400",
    heroBg: "from-rose-50/70 via-white to-white dark:from-rose-950/20 dark:via-stone-950 dark:to-stone-950",
    primaryAction: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-500/20",
    statColor: "text-rose-600 dark:text-rose-400",
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
      className={`-mx-4 sm:-mx-6 lg:-mx-8 border-b border-stone-200/80 bg-gradient-to-br ${theme.heroBg} dark:border-stone-800/60`}
    >
      <div className="px-4 pb-8 pt-7 sm:px-6 sm:pb-10 sm:pt-9 lg:px-8">
        <div
          className={`grid gap-8 ${hasSide ? "lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end" : ""}`}
        >
          <div className="space-y-4">
            {/* Eyebrow */}
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${theme.iconBg} ${theme.iconColor}`}
              >
                {icon}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-stone-400 dark:text-stone-500">
                {eyebrow}
              </span>
            </div>

            {/* Title + description */}
            <div className="max-w-3xl space-y-2">
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-stone-900 dark:text-white sm:text-3xl lg:text-4xl">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-stone-500 dark:text-stone-400 sm:text-base">
                {description}
              </p>
            </div>

            {children}

            {/* Actions */}
            {actions.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-1">
                {actions.map((action, index) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      index === 0
                        ? theme.primaryAction
                        : "border border-stone-200 bg-white/70 text-stone-700 hover:bg-white dark:border-stone-700 dark:bg-stone-800/60 dark:text-stone-200 dark:hover:bg-stone-800"
                    }`}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Stats sidebar */}
          {hasSide && (
            <div className="space-y-3">
              {stats.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-2">
                  {stats.map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-stone-200/80 bg-white/70 p-3.5 dark:border-stone-700/60 dark:bg-stone-900/60"
                    >
                      <p className={`text-2xl font-extrabold tabular-nums ${theme.statColor}`}>
                        {stat.value}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
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
      </div>
    </section>
  );
}
