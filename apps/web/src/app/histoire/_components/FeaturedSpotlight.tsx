/**
 * FeaturedSpotlight — editorial card for the day's featured historical event.
 *
 * Layout (desktop): image left (7 cols) + text right (5 cols)
 * Mobile: stacks vertically
 *
 * Features: year badge, category tags, serif headline, summary,
 * blockquote, significance callout, action buttons.
 */

import type { FeaturedEvent } from "./data";

interface FeaturedSpotlightProps {
  event: FeaturedEvent;
}

export function FeaturedSpotlight({ event }: FeaturedSpotlightProps) {
  return (
    <section id="spotlight">
      <article className="grid grid-cols-1 overflow-hidden rounded-[1.75rem] border border-black/5 bg-white shadow-[0_20px_50px_rgba(29,27,26,0.08)] dark:border-stone-700/40 dark:bg-stone-800 xl:grid-cols-12 xl:gap-0">
        {/* ── Image column ────────────────────────────────── */}
        <figure className="relative min-h-[360px] overflow-hidden xl:col-span-7 lg:min-h-[520px]">
          <img
            src={event.imageUrl}
            alt={event.imageAlt}
            className="absolute inset-0 h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        </figure>

        {/* ── Text column ─────────────────────────────────── */}
        <div className="flex flex-col justify-center p-8 xl:col-span-5 md:p-10 xl:p-12">
          {/* Year + tags */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="rounded-[1.25rem] bg-[#3525cd] px-4 py-2 font-display text-2xl font-extrabold text-white">
              {event.year}
            </span>
            {event.tags.map((tag) => (
              <TagBadge key={tag} label={tag} />
            ))}
          </div>

          {/* Headline */}
          <h3 className="mb-5 font-serif text-4xl leading-[1.02] text-[#1d1b1a] dark:text-white md:text-5xl">
            {event.title}
          </h3>

          {/* Summary */}
          <p className="mb-6 leading-8 text-[#464555] dark:text-stone-400">
            {event.summary}
          </p>

          {/* Quote */}
          <blockquote className="mb-8 rounded-r-xl border-l-4 border-[#9a7a2f] bg-[#fcf7ee] py-2 pl-5 text-lg italic text-[#1d1b1a] dark:border-amber-600 dark:bg-amber-950/20 dark:text-white">
            {event.quote}
          </blockquote>

          {/* Significance callout */}
          <div className="mb-8 rounded-[1.25rem] border border-black/5 bg-[#f3ecea] p-6 dark:border-stone-700 dark:bg-stone-700/40">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#3525cd] dark:text-indigo-400">
              Pourquoi c&apos;est important
            </p>
            <p className="text-sm leading-7 text-[#464555] dark:text-stone-400">
              {event.significance}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl bg-[#3525cd] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#4f46e5]">
              Explorer le document d&apos;archive
            </button>
            <button className="rounded-xl border border-black/[0.08] bg-white px-6 py-3 font-semibold text-[#1d1b1a] transition-colors hover:bg-[#f3ecea] dark:border-stone-700 dark:bg-stone-800 dark:text-white dark:hover:bg-stone-700">
              Voir les sources
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}

/* ── Tag badge sub-component ──────────────────────────────── */

const TAG_STYLES: Record<string, string> = {
  "Jour de l'Indépendance":
    "bg-[#f4ede7] text-[#6f2438] dark:bg-rose-950/30 dark:text-rose-300",
  "Document vérifié":
    "bg-[#f3f0ff] text-[#3525cd] dark:bg-indigo-950/30 dark:text-indigo-300",
};

const DEFAULT_TAG_STYLE =
  "bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300";

function TagBadge({ label }: { label: string }) {
  const style = TAG_STYLES[label] ?? DEFAULT_TAG_STYLE;

  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${style}`}
    >
      {label}
    </span>
  );
}
