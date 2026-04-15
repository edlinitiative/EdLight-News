/**
 * ThemeCollectionCard — immersive card for thematic archive collections.
 *
 * Full-bleed background image with gradient overlay.
 * Text content floats at the bottom with a call-to-action button.
 * Hover effect scales the background image.
 */

import type { ThemeCollection } from "./data";

interface ThemeCollectionCardProps {
  theme: ThemeCollection;
}

export function ThemeCollectionCard({ theme }: ThemeCollectionCardProps) {
  return (
    <article className="group relative min-h-[380px] overflow-hidden rounded-[1.75rem] border border-black/5 dark:border-stone-700/40">
      {/* Background image */}
      <img
        src={theme.imageUrl}
        alt={theme.imageAlt}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110"
        loading="lazy"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/25" />

      {/* Content */}
      <div className="relative flex h-full min-h-[380px] flex-col justify-end p-8 text-white">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/70">
          Thème
        </p>
        <h3 className="mb-3 font-display text-3xl font-bold">
          {theme.title}
        </h3>
        <p className="mb-6 leading-7 text-white/75">
          {theme.description}
        </p>
        <button className="w-fit rounded-full border border-white/25 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] transition-colors hover:bg-white hover:text-[#1d1b1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black/50">
          Accéder aux archives
        </button>
      </div>
    </article>
  );
}
