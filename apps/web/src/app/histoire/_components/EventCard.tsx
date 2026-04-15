"use client";

/**
 * EventCard — clickable historical event card for /histoire.
 *
 * Renders as a premium editorial card with image, year badge, category tag,
 * title, and summary preview. Clicking opens the EventDetailPanel.
 *
 * Features: Wikipedia image fallback, staggered fade-in animation,
 * hover lift + shadow, keyboard-accessible, ARIA button role.
 */

import { Globe } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { TAG_LABELS } from "./shared";
import type { SerializableAlmanacEntry } from "./shared";
import { useWikiImage } from "./useWikiImage";

interface EventCardProps {
  entry: SerializableAlmanacEntry;
  lang: ContentLanguage;
  onClick: () => void;
  index: number;
}

export function EventCard({ entry, lang, onClick, index }: EventCardProps) {
  const fr = lang === "fr";

  const hasOwnIllustration =
    !!entry.illustration?.imageUrl &&
    (entry.illustration.confidence ?? 0) >= 0.55;

  const { url: wikiUrl } = useWikiImage(
    hasOwnIllustration ? null : entry.title_fr,
    hasOwnIllustration ? null : (entry.year ?? null),
  );

  const imageUrl = hasOwnIllustration ? entry.illustration!.imageUrl : wikiUrl;
  const isWikiImage = !hasOwnIllustration && !!wikiUrl;

  const title = fr ? entry.title_fr : (entry.title_ht ?? entry.title_fr);
  const summary = fr
    ? entry.summary_fr
    : (entry.summary_ht ?? entry.summary_fr);

  const firstTag = entry.tags?.[0];
  const tagMeta = firstTag ? TAG_LABELS[firstTag] : null;

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-stone-200/50 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-stone-700/30 dark:bg-stone-800/80 dark:hover:shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* ── Image ───────────────────────────────────────── */}
      <div className="relative aspect-[16/10] overflow-hidden bg-stone-100 dark:bg-stone-700">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#6f2438]/10 to-[#9a7a2f]/10 dark:from-[#6f2438]/20 dark:to-[#9a7a2f]/20">
            <span className="text-4xl opacity-40">📜</span>
          </div>
        )}

        {isWikiImage && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
            <Globe className="h-2.5 w-2.5" /> Wiki
          </span>
        )}

        {entry.year != null && (
          <span className="absolute left-3 top-3 rounded-lg bg-[#6f2438] px-2.5 py-1 text-sm font-bold text-white shadow-lg">
            {entry.year}
          </span>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────── */}
      <div className="p-5">
        {tagMeta && (
          <span
            className={`mb-3 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${tagMeta.color}`}
          >
            {fr ? tagMeta.fr : tagMeta.ht}
          </span>
        )}

        <h3 className="mb-2 font-serif text-lg font-bold leading-tight text-[#1d1b1a] transition-colors group-hover:text-[#6f2438] dark:text-white dark:group-hover:text-rose-400">
          {title}
        </h3>

        <p className="line-clamp-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          {summary}
        </p>

        {/* Hover indicator */}
        <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6f2438] opacity-0 transition-opacity duration-200 group-hover:opacity-100 dark:text-rose-400">
          {fr ? "Lire la suite" : "Li plis"} →
        </div>
      </div>
    </article>
  );
}
