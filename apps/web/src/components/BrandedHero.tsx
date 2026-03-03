"use client";

/**
 * BrandedHero – CSS-native branded hero card for article pages.
 *
 * Mirrors the IG carousel premium design system: category-specific gradients,
 * accent colours, type label, and EdLight branding. Fully responsive and
 * dark-mode aware — replaces the static branded card PNG for a crisper result.
 */

interface BrandedHeroProps {
  title: string;
  category?: string;
  sourceName?: string;
  /** aspect-video | aspect-[2/1] | aspect-[2.4/1] — inherits from parent */
  className?: string;
}

/* ── Category → gradient (matches renderer/src/index.ts) ────────────────── */
const GRADIENTS: Record<string, string> = {
  scholarship:
    "from-blue-900 via-indigo-800 to-violet-700 dark:from-blue-950 dark:via-indigo-900 dark:to-violet-800",
  opportunity:
    "from-violet-800 via-purple-700 to-pink-600 dark:from-violet-950 dark:via-purple-900 dark:to-pink-800",
  news:
    "from-teal-800 via-cyan-700 to-blue-700 dark:from-teal-950 dark:via-cyan-900 dark:to-blue-900",
  event:
    "from-orange-700 via-red-600 to-rose-700 dark:from-orange-950 dark:via-red-900 dark:to-rose-900",
  resource:
    "from-emerald-700 via-green-600 to-teal-700 dark:from-emerald-950 dark:via-green-900 dark:to-teal-900",
  local_news:
    "from-red-800 via-rose-700 to-blue-800 dark:from-red-950 dark:via-rose-900 dark:to-blue-950",
  bourses:
    "from-blue-900 via-indigo-800 to-violet-700 dark:from-blue-950 dark:via-indigo-900 dark:to-violet-800",
  concours:
    "from-indigo-800 via-blue-700 to-sky-600 dark:from-indigo-950 dark:via-blue-900 dark:to-sky-800",
  stages:
    "from-cyan-800 via-teal-700 to-emerald-600 dark:from-cyan-950 dark:via-teal-900 dark:to-emerald-800",
  programmes:
    "from-indigo-800 via-violet-700 to-purple-600 dark:from-indigo-950 dark:via-violet-900 dark:to-purple-800",
  synthesis:
    "from-emerald-800 via-teal-700 to-cyan-600 dark:from-emerald-950 dark:via-teal-900 dark:to-cyan-800",
};
const DEFAULT_GRADIENT =
  "from-stone-800 via-slate-700 to-stone-600 dark:from-stone-900 dark:via-slate-800 dark:to-stone-700";

/* ── Category → accent colour (matches IG accent dots / bars) ─────────── */
const ACCENTS: Record<string, string> = {
  scholarship: "bg-blue-400",
  opportunity: "bg-purple-400",
  news:        "bg-teal-400",
  event:       "bg-orange-400",
  resource:    "bg-emerald-400",
  local_news:  "bg-red-400",
  bourses:     "bg-blue-400",
  concours:    "bg-indigo-400",
  stages:      "bg-cyan-400",
  programmes:  "bg-indigo-400",
  synthesis:   "bg-emerald-400",
};

/* ── Category → readable label ─────────────────────────────────────────── */
const LABELS: Record<string, string> = {
  scholarship: "BOURSE",
  opportunity: "OPPORTUNITÉ",
  news:        "ACTUALITÉ",
  event:       "ÉVÉNEMENT",
  resource:    "RESSOURCE",
  local_news:  "HAÏTI",
  bourses:     "BOURSE",
  concours:    "CONCOURS",
  stages:      "STAGE",
  programmes:  "PROGRAMME",
  synthesis:   "SYNTHÈSE",
};

export function BrandedHero({
  title,
  category,
  sourceName,
  className = "",
}: BrandedHeroProps) {
  const gradient = GRADIENTS[category ?? ""] ?? DEFAULT_GRADIENT;
  const accent = ACCENTS[category ?? ""] ?? "bg-blue-400";
  const label = LABELS[category ?? ""] ?? "";

  return (
    <div
      className={`relative flex flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br ${gradient} p-6 sm:p-8 text-white ${className}`}
    >
      {/* Subtle noise / grain overlay */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjc1IiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsdGVyPSJ1cmwoI2EpIi8+PC9zdmc+')]" />

      {/* Top row — type label + accent dot */}
      <div className="relative z-10 flex items-center gap-2">
        {label && (
          <>
            <span className={`h-2 w-2 rounded-full ${accent}`} />
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/70 sm:text-xs">
              {label}
            </span>
          </>
        )}
      </div>

      {/* Centre — title */}
      <div className="relative z-10 my-auto py-3 sm:py-4">
        <h2 className="line-clamp-4 text-lg font-bold leading-snug tracking-tight text-white drop-shadow-md sm:text-xl md:text-2xl">
          {title}
        </h2>
      </div>

      {/* Bottom row — source + EdLight branding */}
      <div className="relative z-10 flex items-end justify-between gap-4">
        {sourceName ? (
          <span className="truncate text-xs text-white/50 sm:text-sm">
            {sourceName}
          </span>
        ) : (
          <span />
        )}
        <span className="flex-shrink-0 text-xs font-bold tracking-wide text-white/30 sm:text-sm">
          ED<span className="text-yellow-300/60">LIGHT</span>
        </span>
      </div>
    </div>
  );
}
