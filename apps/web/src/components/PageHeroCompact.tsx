/**
 * PageHeroCompact — Premium but compact hero for data-rich section pages.
 *
 * Inspired by BoursesHero: clean gradient background, editorial headline,
 * a short description, and a stats callout — but reusable across
 * universités, histoire, succès, parcours, ressources, calendrier, opportunités.
 *
 * Design: corporate, premium, no CTAs/actions — content speaks for itself.
 */

import type { ReactNode } from "react";

type HeroTint = "indigo" | "rose" | "emerald" | "sky" | "violet" | "orange" | "amber" | "neutral";

interface PageHeroCompactProps {
  eyebrow: string;
  title: string;
  /** Highlighted/italic portion of the title for editorial flair */
  titleAccent?: string;
  description: string;
  tint?: HeroTint;
  stats?: { value: string; label: string }[];
  children?: ReactNode;
}

const TINT_STYLES: Record<HeroTint, { bg: string; accent: string }> = {
  indigo: {
    bg: "from-indigo-50/60 via-white to-white dark:from-indigo-950/20 dark:via-stone-950 dark:to-stone-950",
    accent: "border-indigo-600 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400",
  },
  rose: {
    bg: "from-rose-50/60 via-white to-white dark:from-rose-950/20 dark:via-stone-950 dark:to-stone-950",
    accent: "border-rose-700 dark:border-rose-400 text-rose-700 dark:text-rose-400",
  },
  emerald: {
    bg: "from-emerald-50/60 via-white to-white dark:from-emerald-950/20 dark:via-stone-950 dark:to-stone-950",
    accent: "border-emerald-600 dark:border-emerald-400 text-emerald-600 dark:text-emerald-400",
  },
  sky: {
    bg: "from-sky-50/60 via-white to-white dark:from-sky-950/20 dark:via-stone-950 dark:to-stone-950",
    accent: "border-sky-600 dark:border-sky-400 text-sky-600 dark:text-sky-400",
  },
  violet: {
    bg: "from-violet-50/60 via-white to-white dark:from-violet-950/20 dark:via-stone-950 dark:to-stone-950",
    accent: "border-violet-600 dark:border-violet-400 text-violet-600 dark:text-violet-400",
  },
  orange: {
    bg: "from-orange-50/60 via-white to-white dark:from-orange-950/20 dark:via-stone-950 dark:to-stone-950",
    accent: "border-orange-500 dark:border-orange-400 text-orange-600 dark:text-orange-400",
  },
  amber: {
    bg: "from-amber-50/60 via-white to-white dark:from-amber-950/20 dark:via-stone-950 dark:to-stone-950",
    accent: "border-amber-600 dark:border-amber-400 text-amber-600 dark:text-amber-400",
  },
  neutral: {
    bg: "from-stone-50/60 via-white to-white dark:from-stone-900/40 dark:via-stone-950 dark:to-stone-950",
    accent: "border-stone-600 dark:border-stone-400 text-stone-600 dark:text-stone-400",
  },
};

export function PageHeroCompact({
  eyebrow,
  title,
  titleAccent,
  description,
  tint = "neutral",
  stats,
  children,
}: PageHeroCompactProps) {
  const styles = TINT_STYLES[tint];

  return (
    <section
      className={`-mx-4 sm:-mx-6 lg:-mx-8 border-b border-stone-200/60 bg-gradient-to-br ${styles.bg} dark:border-stone-800/60`}
    >
      <div className="px-4 sm:px-6 lg:px-8 pb-10 pt-8 sm:pb-12 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          {/* ── Left: Headline + Description ── */}
          <div className="lg:col-span-8 space-y-4">
            <span className="inline-block px-3 py-1 bg-stone-200/60 dark:bg-stone-800/60 text-stone-500 dark:text-stone-400 text-[10px] uppercase tracking-[0.2em] font-bold rounded-md">
              {eyebrow}
            </span>

            <h1
              className="text-3xl sm:text-4xl leading-[1.1] font-extrabold tracking-tight text-stone-900 dark:text-white"
            >
              {title}
              {titleAccent && (
                <>
                  {" "}
                  <span className={`italic ${styles.accent.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                    {titleAccent}
                  </span>
                </>
              )}
            </h1>

            <p className="text-base text-stone-500 dark:text-stone-400 leading-relaxed max-w-2xl font-light">
              {description}
            </p>
          </div>

          {/* ── Right: Stats ── */}
          {stats && stats.length > 0 && (
            <div className="lg:col-span-4 lg:text-right">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2 lg:max-w-[280px] lg:ml-auto">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-stone-200/80 dark:border-stone-700/60 bg-white/70 dark:bg-stone-900/60 p-3"
                  >
                    <p className={`text-xl font-extrabold tabular-nums ${styles.accent.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                      {stat.value}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Optional children (e.g. filter chips, search bar) */}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </section>
  );
}
