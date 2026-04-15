import Link from "next/link";
import type { ReactNode } from "react";

type HeroVariant =
  | "news"
  | "calendar"
  | "resources"
  | "universities"
  | "success"
  | "pathways"
  | "history"
  | "default";

interface PageHeroProps {
  variant?: HeroVariant;
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: { href: string; label: string }[];
  stats?: { value: string; label: string }[];
  children?: ReactNode;
}

const VARIANT_STYLES: Record<
  HeroVariant,
  { bg: string; accent: string; eyebrowColor: string; iconBg: string }
> = {
  news: {
    bg: "bg-gradient-to-br from-blue-50/80 via-white to-slate-50 dark:from-blue-950/20 dark:via-stone-900 dark:to-stone-900",
    accent: "from-blue-600 to-blue-400",
    eyebrowColor: "text-blue-600 dark:text-blue-400",
    iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
  },
  calendar: {
    bg: "bg-gradient-to-br from-orange-50/80 via-white to-amber-50/50 dark:from-orange-950/20 dark:via-stone-900 dark:to-stone-900",
    accent: "from-orange-500 to-amber-400",
    eyebrowColor: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400",
  },
  resources: {
    bg: "bg-gradient-to-br from-violet-50/80 via-white to-purple-50/50 dark:from-violet-950/20 dark:via-stone-900 dark:to-stone-900",
    accent: "from-violet-600 to-purple-400",
    eyebrowColor: "text-violet-600 dark:text-violet-400",
    iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
  },
  universities: {
    bg: "bg-gradient-to-br from-indigo-50/80 via-white to-teal-50/50 dark:from-indigo-950/20 dark:via-stone-900 dark:to-stone-900",
    accent: "from-indigo-600 to-teal-400",
    eyebrowColor: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400",
  },
  success: {
    bg: "bg-gradient-to-br from-emerald-50/80 via-white to-green-50/50 dark:from-emerald-950/20 dark:via-stone-900 dark:to-stone-900",
    accent: "from-emerald-600 to-green-400",
    eyebrowColor: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
  },
  pathways: {
    bg: "bg-gradient-to-br from-sky-50/80 via-white to-blue-50/50 dark:from-sky-950/20 dark:via-stone-900 dark:to-stone-900",
    accent: "from-sky-600 to-blue-400",
    eyebrowColor: "text-sky-600 dark:text-sky-400",
    iconBg: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400",
  },
  history: {
    bg: "bg-gradient-to-br from-rose-50/80 via-white to-amber-50/50 dark:from-rose-950/20 dark:via-stone-900 dark:to-stone-900",
    accent: "from-rose-800 to-amber-600",
    eyebrowColor: "text-rose-800 dark:text-rose-400",
    iconBg: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400",
  },
  default: {
    bg: "bg-gradient-to-br from-stone-50 via-white to-stone-50 dark:from-stone-900 dark:via-stone-900 dark:to-stone-900",
    accent: "from-stone-600 to-stone-400",
    eyebrowColor: "text-stone-500 dark:text-stone-400",
    iconBg: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
  },
};

export function PageHero({
  variant = "default",
  eyebrow,
  title,
  description,
  icon,
  actions,
  stats,
  children,
}: PageHeroProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <section
      className={[
        "relative -mx-4 overflow-hidden rounded-none px-4 py-12 sm:-mx-6 sm:rounded-3xl sm:px-8 md:py-16 lg:-mx-8 lg:px-12",
        styles.bg,
      ].join(" ")}
    >
      {/* Decorative dot pattern */}
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-40" />

      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="grid gap-8 lg:grid-cols-[1fr,auto] lg:items-center lg:gap-12">
          {/* Left: Content */}
          <div className="space-y-5">
            {/* Eyebrow + icon */}
            <div className="flex items-center gap-3">
              {icon && (
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    styles.iconBg,
                  ].join(" ")}
                >
                  {icon}
                </div>
              )}
              {eyebrow && (
                <p
                  className={[
                    "text-[11px] font-bold uppercase tracking-[0.15em]",
                    styles.eyebrowColor,
                  ].join(" ")}
                >
                  {eyebrow}
                </p>
              )}
            </div>

            {/* Title */}
            <h1
              className="text-3xl font-extrabold leading-[1.15] tracking-tight text-stone-900 dark:text-white sm:text-4xl lg:text-[2.75rem]"
              style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}
            >
              {title}
            </h1>

            {/* Description */}
            {description && (
              <p className="max-w-xl text-base leading-relaxed text-stone-600 dark:text-stone-300 sm:text-lg">
                {description}
              </p>
            )}

            {/* Actions */}
            {actions && actions.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {actions.map((action, i) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={
                      i === 0
                        ? "inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-stone-800 hover:shadow-lg active:scale-[0.98] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
                        : "inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/80 px-5 py-2.5 text-sm font-semibold text-stone-700 transition-all hover:border-stone-400 hover:bg-white hover:shadow-sm dark:border-stone-600 dark:bg-stone-800/80 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:bg-stone-800"
                    }
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            )}

            {/* Children */}
            {children && <div className="pt-2">{children}</div>}
          </div>

          {/* Right: Stats */}
          {stats && stats.length > 0 && (
            <div className="flex gap-3 lg:flex-col lg:gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex min-w-[6rem] flex-1 flex-col items-center gap-1 rounded-2xl border border-stone-200/80 bg-white/90 px-4 py-4 shadow-sm backdrop-blur-sm dark:border-stone-700 dark:bg-stone-800/90 lg:min-w-[8rem]"
                >
                  <span className="text-2xl font-extrabold tabular-nums tracking-tight text-stone-900 dark:text-white">
                    {stat.value}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom gradient accent line */}
      <div
        className={[
          "absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r",
          styles.accent,
        ].join(" ")}
      />
    </section>
  );
}
