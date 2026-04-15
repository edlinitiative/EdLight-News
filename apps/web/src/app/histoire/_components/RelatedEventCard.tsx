/**
 * RelatedEventCard — card for secondary historical events.
 *
 * Used in the "Aussi ce jour-là" grid section. Features:
 * - 4:3 aspect ratio image with hover scale
 * - Year + divider + category badge
 * - Headline with hover color shift
 * - Summary text
 */

import type { RelatedEvent } from "./data";

interface RelatedEventCardProps {
  event: RelatedEvent;
}

export function RelatedEventCard({ event }: RelatedEventCardProps) {
  return (
    <article className="group overflow-hidden rounded-[1.25rem] border border-black/5 bg-white shadow-[0_10px_30px_rgba(29,27,26,0.05)] transition-all hover:shadow-[0_20px_50px_rgba(29,27,26,0.08)] dark:border-stone-700/40 dark:bg-stone-800 dark:hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden bg-[#f3ecea] dark:bg-stone-700">
        <img
          src={event.imageUrl}
          alt={event.imageAlt}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Year + divider + category */}
        <div className="mb-4 flex items-center gap-3">
          <span className="font-display text-2xl font-extrabold text-[#0051d5] dark:text-blue-400">
            {event.year}
          </span>
          <div className="h-px flex-1 bg-black/10 dark:bg-stone-600" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#464555]/65 dark:text-stone-500">
            {event.category}
          </span>
        </div>

        {/* Headline */}
        <h3 className="mb-3 font-display text-xl font-bold leading-tight transition-colors group-hover:text-[#3525cd] dark:text-white dark:group-hover:text-indigo-400">
          {event.title}
        </h3>

        {/* Summary */}
        <p className="text-sm leading-7 text-[#464555] dark:text-stone-400">
          {event.summary}
        </p>
      </div>
    </article>
  );
}
