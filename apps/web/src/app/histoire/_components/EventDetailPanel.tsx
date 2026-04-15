"use client";

/**
 * EventDetailPanel — slide-in detail panel for a historical event.
 *
 * Opens from the right when a user clicks any event card. Displays the full
 * event content: image, year, tags, title, summary, student takeaway,
 * confidence badge, and source links.
 *
 * Features: keyboard dismiss (Escape), click-outside dismiss, scroll lock,
 * slide-in animation, responsive (full-width on mobile).
 */

import { useEffect, useRef, useCallback } from "react";
import {
  X,
  Globe,
  Lightbulb,
  ExternalLink,
  ShieldCheck,
  Calendar,
  Tag,
} from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import { TAG_LABELS, formatMonthDay, toISODate } from "./shared";
import type { SerializableAlmanacEntry } from "./shared";
import { useWikiImage } from "./useWikiImage";

interface EventDetailPanelProps {
  event: SerializableAlmanacEntry | null;
  lang: ContentLanguage;
  onClose: () => void;
}

export function EventDetailPanel({
  event,
  lang,
  onClose,
}: EventDetailPanelProps) {
  // Scroll lock
  useEffect(() => {
    if (event) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [event]);

  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={event.title_fr}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <EventDetailContent event={event} lang={lang} onClose={onClose} />
    </div>
  );
}

/* ── Inner content (hooks safe — event guaranteed non-null) ── */

function EventDetailContent({
  event,
  lang,
  onClose,
}: {
  event: SerializableAlmanacEntry;
  lang: ContentLanguage;
  onClose: () => void;
}) {
  const fr = lang === "fr";
  const panelRef = useRef<HTMLDivElement>(null);

  const hasOwnIllustration =
    !!event.illustration?.imageUrl &&
    (event.illustration.confidence ?? 0) >= 0.55;

  const { url: wikiUrl } = useWikiImage(
    hasOwnIllustration ? null : event.title_fr,
    hasOwnIllustration ? null : (event.year ?? null),
  );

  const imageUrl = hasOwnIllustration
    ? event.illustration!.imageUrl
    : wikiUrl;
  const isWikiImage = !hasOwnIllustration && !!wikiUrl;

  const title = fr ? event.title_fr : (event.title_ht ?? event.title_fr);
  const summary = fr
    ? event.summary_fr
    : (event.summary_ht ?? event.summary_fr);
  const takeaway = event.student_takeaway_fr
    ? fr
      ? event.student_takeaway_fr
      : (event.student_takeaway_ht ?? event.student_takeaway_fr)
    : null;

  // Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Focus trap — focus panel on mount
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="relative z-10 h-full w-full max-w-2xl animate-slide-in-right overflow-y-auto bg-white shadow-2xl outline-none dark:bg-stone-900"
    >
      {/* ── Close button ──────────────────────────────── */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-full bg-black/30 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/50"
        aria-label={fr ? "Fermer" : "Fèmen"}
      >
        <X className="h-5 w-5" />
      </button>

      {/* ── Image ─────────────────────────────────────── */}
      {imageUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          {isWikiImage && (
            <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/80 backdrop-blur-sm">
              <Globe className="h-3 w-3" /> Wikipedia
            </span>
          )}
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-[#6f2438]/15 to-[#9a7a2f]/15 dark:from-[#6f2438]/25 dark:to-[#9a7a2f]/25">
          <span className="text-6xl opacity-30">📜</span>
        </div>
      )}

      {/* ── Body ──────────────────────────────────────── */}
      <div className="p-8 md:p-10">
        {/* Meta row: year + date */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {event.year != null && (
            <span className="rounded-xl bg-[#6f2438] px-4 py-2 font-display text-xl font-extrabold text-white">
              {event.year}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
            <Calendar className="h-4 w-4" />
            <time dateTime={toISODate(event.monthDay, event.year)}>
              {formatMonthDay(event.monthDay, lang)}
            </time>
          </div>
        </div>

        {/* Tags */}
        {event.tags && event.tags.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {event.tags.map((tag) => {
              const meta = TAG_LABELS[tag];
              if (!meta) return null;
              return (
                <span
                  key={tag}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${meta.color}`}
                >
                  <Tag className="h-3 w-3" />
                  {fr ? meta.fr : meta.ht}
                </span>
              );
            })}
          </div>
        )}

        {/* Title */}
        <h2 className="mb-5 font-serif text-3xl font-bold leading-tight text-[#1d1b1a] dark:text-white md:text-4xl">
          {title}
        </h2>

        {/* Summary */}
        <div className="mb-8 text-base leading-8 text-stone-600 dark:text-stone-300">
          {summary}
        </div>

        {/* Student takeaway */}
        {takeaway && (
          <div className="mb-8 rounded-2xl border border-[#9a7a2f]/15 bg-[#9a7a2f]/5 p-6 dark:border-amber-400/15 dark:bg-amber-400/5">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-[#9a7a2f] dark:text-amber-400" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9a7a2f] dark:text-amber-400">
                {fr ? "Pourquoi c\u2019est important" : "Poukisa sa enpòtan"}
              </span>
            </div>
            <p className="text-sm leading-7 text-stone-600 dark:text-stone-300">
              {takeaway}
            </p>
          </div>
        )}

        {/* Confidence badge */}
        {event.confidence === "high" && (
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            {fr ? "Source vérifiée" : "Sous verifye"}
          </div>
        )}

        {/* Sources */}
        {event.sources.length > 0 && (
          <div>
            <h4 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500 dark:text-stone-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              {fr ? "Sources" : "Sous"}
            </h4>
            <div className="flex flex-wrap gap-2">
              {event.sources.map((s) => (
                <a
                  key={s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
