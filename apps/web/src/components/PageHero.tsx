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
  orbA: string;
  orbB: string;
}

const HERO_THEMES: Record<HeroVariant, PageHeroTheme> = {
  home: {
    shell:
      "border-blue-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,246,255,0.96),rgba(255,247,237,0.94))] dark:border-blue-900/40 dark:bg-[linear-gradient(135deg,rgba(10,15,27,0.94),rgba(10,24,43,0.94),rgba(35,20,12,0.92))]",
    iconWrap:
      "bg-blue-600 text-white shadow-[0_18px_40px_-24px_rgba(37,99,235,0.85)] dark:bg-blue-500",
    eyebrow: "text-blue-700 dark:text-blue-300",
    primaryAction:
      "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400",
    secondaryAction:
      "border border-blue-200/80 bg-white/80 text-blue-700 hover:bg-blue-50 dark:border-blue-800/60 dark:bg-white/5 dark:text-blue-200 dark:hover:bg-white/10",
    statCard:
      "border border-blue-100/80 bg-white/78 shadow-sm dark:border-white/10 dark:bg-white/5",
    orbA: "bg-blue-300/30 dark:bg-blue-500/20",
    orbB: "bg-orange-300/25 dark:bg-orange-500/20",
  },
  news: {
    shell:
      "border-stone-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96),rgba(241,245,249,0.92))] dark:border-stone-800 dark:bg-[linear-gradient(135deg,rgba(17,24,39,0.96),rgba(12,14,20,0.95),rgba(20,26,38,0.94))]",
    iconWrap:
      "bg-stone-900 text-white shadow-[0_18px_40px_-24px_rgba(28,25,23,0.8)] dark:bg-stone-100 dark:text-stone-900",
    eyebrow: "text-stone-600 dark:text-stone-300",
    primaryAction:
      "bg-stone-900 text-white hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white",
    secondaryAction:
      "border border-stone-200/90 bg-white/80 text-stone-700 hover:bg-stone-50 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10",
    statCard:
      "border border-stone-200/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
    orbA: "bg-blue-200/25 dark:bg-blue-500/15",
    orbB: "bg-stone-300/20 dark:bg-stone-500/10",
  },
  haiti: {
    shell:
      "border-sky-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(239,246,255,0.95),rgba(254,242,242,0.93))] dark:border-sky-900/40 dark:bg-[linear-gradient(135deg,rgba(8,18,30,0.96),rgba(10,25,44,0.94),rgba(37,14,20,0.92))]",
    iconWrap: "bg-red-600 text-white dark:bg-red-500",
    eyebrow: "text-sky-700 dark:text-sky-300",
    primaryAction:
      "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400",
    secondaryAction:
      "border border-sky-200/80 bg-white/80 text-sky-700 hover:bg-sky-50 dark:border-sky-800/60 dark:bg-white/5 dark:text-sky-200 dark:hover:bg-white/10",
    statCard:
      "border border-sky-100/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
    orbA: "bg-sky-300/30 dark:bg-sky-500/20",
    orbB: "bg-red-300/25 dark:bg-red-500/15",
  },
  resources: {
    shell:
      "border-emerald-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(236,253,245,0.95),rgba(240,249,255,0.92))] dark:border-emerald-900/40 dark:bg-[linear-gradient(135deg,rgba(8,24,20,0.96),rgba(9,29,35,0.94),rgba(10,20,30,0.92))]",
    iconWrap: "bg-emerald-600 text-white dark:bg-emerald-500",
    eyebrow: "text-emerald-700 dark:text-emerald-300",
    primaryAction:
      "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400",
    secondaryAction:
      "border border-emerald-200/80 bg-white/80 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/60 dark:bg-white/5 dark:text-emerald-200 dark:hover:bg-white/10",
    statCard:
      "border border-emerald-100/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
    orbA: "bg-emerald-300/25 dark:bg-emerald-500/20",
    orbB: "bg-cyan-300/20 dark:bg-cyan-500/15",
  },
  success: {
    shell:
      "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(255,251,235,0.95),rgba(255,241,242,0.92))] dark:border-amber-900/40 dark:bg-[linear-gradient(135deg,rgba(29,18,8,0.96),rgba(44,21,10,0.94),rgba(38,11,19,0.92))]",
    iconWrap: "bg-amber-500 text-stone-950 dark:bg-amber-400",
    eyebrow: "text-amber-700 dark:text-amber-300",
    primaryAction:
      "bg-amber-500 text-stone-950 hover:bg-amber-400 dark:bg-amber-400 dark:hover:bg-amber-300",
    secondaryAction:
      "border border-amber-200/80 bg-white/80 text-amber-700 hover:bg-amber-50 dark:border-amber-800/60 dark:bg-white/5 dark:text-amber-200 dark:hover:bg-white/10",
    statCard:
      "border border-amber-100/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
    orbA: "bg-amber-300/25 dark:bg-amber-500/20",
    orbB: "bg-rose-300/20 dark:bg-rose-500/15",
  },
  bourses: {
    shell:
      "border-indigo-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(238,242,255,0.95),rgba(236,253,245,0.92))] dark:border-indigo-900/40 dark:bg-[linear-gradient(135deg,rgba(16,18,40,0.96),rgba(20,23,55,0.94),rgba(10,24,20,0.9))]",
    iconWrap: "bg-indigo-600 text-white dark:bg-indigo-500",
    eyebrow: "text-indigo-700 dark:text-indigo-300",
    primaryAction:
      "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400",
    secondaryAction:
      "border border-indigo-200/80 bg-white/80 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800/60 dark:bg-white/5 dark:text-indigo-200 dark:hover:bg-white/10",
    statCard:
      "border border-indigo-100/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
    orbA: "bg-indigo-300/25 dark:bg-indigo-500/20",
    orbB: "bg-emerald-300/20 dark:bg-emerald-500/15",
  },
  opportunities: {
    shell:
      "border-orange-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,247,237,0.95),rgba(239,246,255,0.92))] dark:border-orange-900/40 dark:bg-[linear-gradient(135deg,rgba(35,18,8,0.96),rgba(41,22,10,0.94),rgba(9,24,36,0.92))]",
    iconWrap: "bg-orange-500 text-white dark:bg-orange-400",
    eyebrow: "text-orange-700 dark:text-orange-300",
    primaryAction:
      "bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-400 dark:text-stone-950 dark:hover:bg-orange-300",
    secondaryAction:
      "border border-orange-200/80 bg-white/80 text-orange-700 hover:bg-orange-50 dark:border-orange-800/60 dark:bg-white/5 dark:text-orange-200 dark:hover:bg-white/10",
    statCard:
      "border border-orange-100/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
    orbA: "bg-orange-300/25 dark:bg-orange-500/20",
    orbB: "bg-sky-300/20 dark:bg-sky-500/15",
  },
  calendar: {
    shell:
      "border-cyan-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(236,254,255,0.95),rgba(255,251,235,0.92))] dark:border-cyan-900/40 dark:bg-[linear-gradient(135deg,rgba(8,22,30,0.96),rgba(10,27,41,0.94),rgba(41,28,10,0.92))]",
    iconWrap: "bg-cyan-600 text-white dark:bg-cyan-500",
    eyebrow: "text-cyan-700 dark:text-cyan-300",
    primaryAction:
      "bg-cyan-600 text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:hover:bg-cyan-400",
    secondaryAction:
      "border border-cyan-200/80 bg-white/80 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800/60 dark:bg-white/5 dark:text-cyan-200 dark:hover:bg-white/10",
    statCard:
      "border border-cyan-100/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
    orbA: "bg-cyan-300/25 dark:bg-cyan-500/20",
    orbB: "bg-amber-300/20 dark:bg-amber-500/15",
  },
  pathways: {
    shell:
      "border-violet-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(245,243,255,0.95),rgba(239,246,255,0.92))] dark:border-violet-900/40 dark:bg-[linear-gradient(135deg,rgba(20,15,44,0.96),rgba(28,18,52,0.94),rgba(10,22,36,0.92))]",
    iconWrap: "bg-violet-600 text-white dark:bg-violet-500",
    eyebrow: "text-violet-700 dark:text-violet-300",
    primaryAction:
      "bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-400",
    secondaryAction:
      "border border-violet-200/80 bg-white/80 text-violet-700 hover:bg-violet-50 dark:border-violet-800/60 dark:bg-white/5 dark:text-violet-200 dark:hover:bg-white/10",
    statCard:
      "border border-violet-100/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
    orbA: "bg-violet-300/25 dark:bg-violet-500/20",
    orbB: "bg-blue-300/20 dark:bg-blue-500/15",
  },
  universities: {
    shell:
      "border-teal-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.97),rgba(240,253,250,0.95),rgba(239,246,255,0.92))] dark:border-teal-900/40 dark:bg-[linear-gradient(135deg,rgba(8,24,22,0.96),rgba(8,31,34,0.94),rgba(10,22,35,0.92))]",
    iconWrap: "bg-teal-600 text-white dark:bg-teal-500",
    eyebrow: "text-teal-700 dark:text-teal-300",
    primaryAction:
      "bg-teal-600 text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400",
    secondaryAction:
      "border border-teal-200/80 bg-white/80 text-teal-700 hover:bg-teal-50 dark:border-teal-800/60 dark:bg-white/5 dark:text-teal-200 dark:hover:bg-white/10",
    statCard:
      "border border-teal-100/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
    orbA: "bg-teal-300/25 dark:bg-teal-500/20",
    orbB: "bg-sky-300/20 dark:bg-sky-500/15",
  },
  history: {
    shell:
      "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,251,235,0.98),rgba(255,255,255,0.95),rgba(245,245,244,0.92))] dark:border-amber-900/40 dark:bg-[linear-gradient(135deg,rgba(38,26,12,0.96),rgba(24,22,18,0.95),rgba(18,18,18,0.92))]",
    iconWrap: "bg-amber-600 text-white dark:bg-amber-500",
    eyebrow: "text-amber-800 dark:text-amber-300",
    primaryAction:
      "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400",
    secondaryAction:
      "border border-amber-200/80 bg-white/80 text-amber-800 hover:bg-amber-50 dark:border-amber-800/60 dark:bg-white/5 dark:text-amber-200 dark:hover:bg-white/10",
    statCard:
      "border border-amber-100/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/5",
    orbA: "bg-amber-300/25 dark:bg-amber-500/20",
    orbB: "bg-stone-300/20 dark:bg-stone-500/15",
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
      className={`relative overflow-hidden rounded-[2rem] border px-5 py-6 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.45)] sm:px-7 sm:py-8 ${theme.shell}`}
    >
      <div
        className={`pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full blur-3xl ${theme.orbA}`}
      />
      <div
        className={`pointer-events-none absolute -bottom-8 left-8 h-28 w-28 rounded-full blur-3xl ${theme.orbB}`}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30 dark:opacity-10" />

      <div
        className={`relative grid gap-7 ${hasSide ? "lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end" : ""}`}
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
                    className={`rounded-2xl p-4 backdrop-blur ${theme.statCard}`}
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
