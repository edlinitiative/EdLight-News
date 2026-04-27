/**
 * PageHeroCompact — Warm editorial hero for data-rich section pages.
 *
 * Redesigned to match the Lumina warm-surface M3 system:
 * warm canvas gradients (#fff8f5), Manrope display headlines,
 * pill eyebrow badges, and shadow-ambient stat boxes.
 *
 * Mobile-first: stats use a 2×2 grid on mobile (instead of 4-column)
 * for better readability at small viewports.
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

const TINT_STYLES: Record<HeroTint, { bg: string; pill: string; accent: string; statBorder: string }> = {
  indigo: {
    bg: "from-[#f0edff]/60 via-[#fff8f5] to-[#fff8f5] dark:from-indigo-950/20 dark:via-stone-950 dark:to-stone-950",
    pill: "bg-[#4f46e5] text-white",
    accent: "text-[#3525cd] dark:text-[#c3c0ff]",
    statBorder: "border-[#c7c4d8]/20",
  },
  rose: {
    bg: "from-rose-50/40 via-[#fff8f5] to-[#fff8f5] dark:from-rose-950/20 dark:via-stone-950 dark:to-stone-950",
    pill: "bg-rose-600 text-white",
    accent: "text-rose-700 dark:text-rose-400",
    statBorder: "border-rose-200/30",
  },
  emerald: {
    bg: "from-emerald-50/40 via-[#fff8f5] to-[#fff8f5] dark:from-emerald-950/20 dark:via-stone-950 dark:to-stone-950",
    pill: "bg-emerald-600 text-white",
    accent: "text-emerald-700 dark:text-emerald-400",
    statBorder: "border-emerald-200/30",
  },
  sky: {
    bg: "from-sky-50/40 via-[#fff8f5] to-[#fff8f5] dark:from-sky-950/20 dark:via-stone-950 dark:to-stone-950",
    pill: "bg-sky-600 text-white",
    accent: "text-sky-700 dark:text-sky-400",
    statBorder: "border-sky-200/30",
  },
  violet: {
    bg: "from-violet-50/40 via-[#fff8f5] to-[#fff8f5] dark:from-violet-950/20 dark:via-stone-950 dark:to-stone-950",
    pill: "bg-violet-600 text-white",
    accent: "text-violet-700 dark:text-violet-400",
    statBorder: "border-violet-200/30",
  },
  orange: {
    bg: "from-orange-50/40 via-[#fff8f5] to-[#fff8f5] dark:from-orange-950/20 dark:via-stone-950 dark:to-stone-950",
    pill: "bg-orange-600 text-white",
    accent: "text-orange-600 dark:text-orange-400",
    statBorder: "border-orange-200/30",
  },
  amber: {
    bg: "from-amber-50/40 via-[#fff8f5] to-[#fff8f5] dark:from-amber-950/20 dark:via-stone-950 dark:to-stone-950",
    pill: "bg-amber-600 text-white",
    accent: "text-amber-700 dark:text-amber-400",
    statBorder: "border-amber-200/30",
  },
  neutral: {
    bg: "from-[#f9f2f0]/60 via-[#fff8f5] to-[#fff8f5] dark:from-stone-900/40 dark:via-stone-950 dark:to-stone-950",
    pill: "bg-[#5f6060] text-white",
    accent: "text-[#474948] dark:text-stone-400",
    statBorder: "border-[#c7c4d8]/15",
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
      className={`-mx-4 sm:-mx-6 lg:-mx-8 border-b border-[#c7c4d8]/15 bg-gradient-to-br ${styles.bg}`}
    >
      <div className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-12 pt-5 sm:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-start lg:items-end">
          {/* ── Left: Headline + Description ── */}
          <div className="lg:col-span-8 space-y-2.5 sm:space-y-4">
            <span
              className={`inline-block px-2.5 sm:px-3 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] rounded-full ${styles.pill}`}
            >
              {eyebrow}
            </span>

            <h1 className="text-xl sm:text-3xl md:text-4xl leading-[1.15] sm:leading-[1.1] font-extrabold tracking-tighter font-display text-[#1d1b1a] dark:text-white">
              {title}
              {titleAccent && (
                <>
                  {" "}
                  <span className={`italic ${styles.accent}`}>{titleAccent}</span>
                </>
              )}
            </h1>

            <p className="text-xs sm:text-base text-[#464555] dark:text-stone-400 leading-relaxed max-w-2xl font-light">
              {description}
            </p>
          </div>

          {/* ── Right: Stats ── */}
          {stats && stats.length > 0 && (
            <div className="lg:col-span-4 lg:text-right">
              {/* Mobile: 2×2 grid, Tablet+: 4-col, Desktop: 2-col */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2 lg:max-w-[280px] lg:ml-auto">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className={`rounded-xl border ${styles.statBorder} bg-white/80 dark:bg-stone-900/60 p-2.5 sm:p-3 shadow-[0_4px_12px_rgba(29,27,26,0.04)] sm:shadow-[0_20px_40px_rgba(29,27,26,0.03)] transition-all hover:shadow-[0_8px_24px_rgba(29,27,26,0.06)] sm:hover:shadow-[0_24px_48px_rgba(29,27,26,0.05)]`}
                  >
                    <p className={`text-lg sm:text-xl font-extrabold tabular-nums ${styles.accent} leading-none`}>
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#474948] dark:text-stone-500 leading-tight">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Optional children (e.g. filter chips, search bar) */}
        {children && <div className="mt-4 sm:mt-6">{children}</div>}
      </div>
    </section>
  );
}