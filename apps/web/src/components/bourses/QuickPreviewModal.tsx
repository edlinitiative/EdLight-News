"use client";

/**
 * QuickPreviewModal — a lightweight "peek" at a scholarship without leaving
 * the catalogue. Shows the badges, deadline, eligibility summary and the two
 * primary actions (open full page, apply on the official site).
 */

import type { ContentLanguage } from "@edlight-news/types";
import { useEffect } from "react";
import Link from "next/link";
import { X, Bookmark, ArrowRight, ExternalLink, CheckCircle2, CalendarClock } from "lucide-react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import {
  countryEmoji,
  countryCode,
  fundingLabel,
  levelBadges,
} from "@/lib/bourses/labels";
import { getDeadlineStatus } from "@/lib/ui/deadlines";

interface QuickPreviewModalProps {
  scholarship: SerializedScholarship | null;
  lang: ContentLanguage;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onClose: () => void;
}

const BADGE =
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide";
const BADGE_NEUTRAL =
  "border-[#e7e1de] bg-[#f7f4f2] text-[#6b6563] dark:border-stone-700/60 dark:bg-stone-800 dark:text-stone-300";

export function QuickPreviewModal({
  scholarship: s,
  lang,
  saved,
  onToggleSave,
  onClose,
}: QuickPreviewModalProps) {
  const fr = lang === "fr";

  useEffect(() => {
    if (!s) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [s, onClose]);

  if (!s) return null;

  const funding = fundingLabel(s.fundingType, lang);
  const levels = levelBadges(s.level, lang);
  const elig = s.haitianEligibility ?? "unknown";
  const dl = getDeadlineStatus(s.deadline?.dateISO, lang);
  const detailHref = `/bourses/${s.id}${lang !== "fr" ? `?lang=${lang}` : ""}`;
  const applyUrl = s.howToApplyUrl || s.officialUrl;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={s.name}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[#f3ecea] bg-white p-6 shadow-2xl sm:rounded-3xl dark:border-stone-800 dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-2xl leading-none" aria-hidden="true">{countryEmoji(s.country)}</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#a8a29e] dark:text-stone-500">
              {countryCode(s.country)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggleSave(s.id)}
              className={`rounded-lg p-1.5 transition-colors ${
                saved ? "text-[#3525cd] dark:text-[#c3c0ff]" : "text-[#c7c4d8] hover:text-[#6b6563] dark:text-stone-600 dark:hover:text-stone-300"
              }`}
              aria-label={fr ? "Sauvegarder" : "Anrejistre"}
            >
              <Bookmark className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#6b6563] transition-colors hover:bg-[#f5f0ee] dark:text-stone-400 dark:hover:bg-stone-800"
              aria-label={fr ? "Fermer" : "Fèmen"}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <h2 className="mt-2 font-display text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-[#1d1b1a] dark:text-white">
          {s.name}
        </h2>

        {/* Badges */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {elig === "yes" && (
            <span className={`${BADGE} border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              {fr ? "Éligible Haïti" : "Elijib Ayiti"}
            </span>
          )}
          {levels.map((l) => (
            <span key={l} className={`${BADGE} ${BADGE_NEUTRAL}`}>{l}</span>
          ))}
          {funding && (
            <span className={`${BADGE} border-[#3525cd]/20 bg-[#3525cd]/8 text-[#3525cd] dark:border-[#c3c0ff]/25 dark:bg-[#c3c0ff]/10 dark:text-[#c3c0ff]`}>
              {funding.text}
            </span>
          )}
        </div>

        {/* Deadline */}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#f7f4f2] px-3 py-2.5 text-[13px] dark:bg-stone-800/60">
          <CalendarClock
            className={`h-4 w-4 ${
              dl.badgeVariant === "today" || dl.badgeVariant === "urgent"
                ? "text-[#93000a] dark:text-red-400"
                : dl.badgeVariant === "soon"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-[#6b6563] dark:text-stone-400"
            }`}
          />
          <span className="font-semibold text-[#1d1b1a] dark:text-stone-200">{dl.humanLine}</span>
        </div>

        {/* Summary */}
        {s.eligibilitySummary && (
          <p className="mt-4 text-[14px] leading-relaxed text-[#464555] dark:text-stone-300">
            {s.eligibilitySummary}
          </p>
        )}

        {/* Requirements */}
        {(s.requirements?.length ?? 0) > 0 && (
          <ul className="mt-4 space-y-1.5">
            {s.requirements!.slice(0, 4).map((r, i) => (
              <li key={i} className="flex gap-2 text-[13px] text-[#464555] dark:text-stone-300">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#3525cd] dark:bg-[#c3c0ff]" />
                {r}
              </li>
            ))}
          </ul>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href={detailHref}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#3525cd] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#2a1ea7] dark:bg-[#c3c0ff] dark:text-[#1d1b1a] dark:hover:bg-[#a8a3ff]"
          >
            {fr ? "Voir la page complète" : "Wè paj konplè a"}
            <ArrowRight className="h-4 w-4" />
          </Link>
          {applyUrl && (
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#c7c4d8]/40 px-4 py-3 text-sm font-bold text-[#3525cd] transition-colors hover:bg-[#f5f0ee] dark:border-stone-700 dark:text-[#c3c0ff] dark:hover:bg-stone-800"
            >
              {fr ? "Site officiel" : "Sit ofisyèl"}
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
