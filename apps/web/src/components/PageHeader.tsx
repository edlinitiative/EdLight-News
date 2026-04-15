/**
 * PageHeader — Slim, corporate page-level header for feed & category pages.
 *
 * Replaces the heavy PageHero on content-feed pages where the user
 * should dive straight into articles. Shows only a small eyebrow,
 * a title, and optional inline stats — nothing more.
 *
 * Inspired by the clean BoursesHero feel but much more compact:
 * no description, no CTAs, no background gradients.
 */

import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  icon?: ReactNode;
  /** Compact inline stats shown to the right on desktop */
  stats?: { value: string; label: string }[];
}

export function PageHeader({
  eyebrow,
  title,
  icon,
  stats,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-stone-200/60 pb-5 dark:border-stone-800/60 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
      {/* Left: eyebrow + title */}
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
            {icon && (
              <span className="flex h-5 w-5 items-center justify-center text-stone-400 dark:text-stone-500">
                {icon}
              </span>
            )}
            {eyebrow}
          </p>
        )}
        <h1
          className="text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white sm:text-3xl"
          style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
        >
          {title}
        </h1>
      </div>

      {/* Right: compact stats */}
      {stats && stats.length > 0 && (
        <div className="flex shrink-0 items-center gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-right">
              <span className="text-lg font-extrabold tabular-nums text-stone-900 dark:text-white">
                {stat.value}
              </span>
              <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
