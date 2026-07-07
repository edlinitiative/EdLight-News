"use client";

/**
 * ScholarshipGridCard — concise dashboard-style card for the /bourses grid.
 *
 * Title + quick actions (preview, save), a row of metadata badges
 * (country · level · funding · Haiti-eligibility · deadline), and a footer
 * with a compare checkbox and the detail affordance. The whole card links to
 * the scholarship; the action controls stop propagation.
 */

import type { ContentLanguage } from "@edlight-news/types";
import Link from "next/link";
import { Bookmark, Eye, ArrowRight, CheckCircle2 } from "lucide-react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import {
  countryEmoji,
  countryCode,
  fundingLabel,
  levelBadges,
} from "@/lib/bourses/labels";
import { getDeadlineStatus } from "@/lib/ui/deadlines";

interface ScholarshipGridCardProps {
  scholarship: SerializedScholarship;
  lang: ContentLanguage;
  saved: boolean;
  onToggleSave: (id: string) => void;
  onPreview: (s: SerializedScholarship) => void;
  compared: boolean;
  onToggleCompare: (id: string) => void;
}

const BADGE =
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide";
const BADGE_NEUTRAL =
  "border-[#e7e1de] bg-[#f7f4f2] text-[#6b6563] dark:border-stone-700/60 dark:bg-stone-800 dark:text-stone-300";

export function ScholarshipGridCard({
  scholarship: s,
  lang,
  saved,
  onToggleSave,
  onPreview,
  compared,
  onToggleCompare,
}: ScholarshipGridCardProps) {
  const fr = lang === "fr";
  const funding = fundingLabel(s.fundingType, lang);
  const elig = s.haitianEligibility ?? "unknown";
  const levels = levelBadges(s.level, lang);
  const detailHref = `/bourses/${s.id}${lang !== "fr" ? `?lang=${lang}` : ""}`;

  const dlStatus =
    s.deadline?.dateISO && (s.deadlineAccuracy ?? "exact") === "exact"
      ? getDeadlineStatus(s.deadline.dateISO, lang)
      : null;
  const urgent = dlStatus?.badgeVariant === "today" || dlStatus?.badgeVariant === "urgent";
  const soon = dlStatus?.badgeVariant === "soon";

  return (
    <Link
      href={detailHref}
      className={`group relative flex h-full flex-col rounded-2xl border bg-white p-4 transition-all duration-200 active:scale-[0.99] sm:hover:-translate-y-0.5 sm:hover:shadow-[0_14px_30px_-14px_rgba(29,27,26,0.18)] dark:bg-stone-900/90 ${
        compared
          ? "border-[#3525cd]/40 ring-1 ring-[#3525cd]/20 dark:border-[#c3c0ff]/40 dark:ring-[#c3c0ff]/20"
          : "border-[#c7c4d8]/20 sm:hover:border-[#3525cd]/25 dark:border-stone-800 dark:sm:hover:border-[#c3c0ff]/20"
      }`}
    >
      {urgent && (
        <span className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-[#93000a] dark:bg-red-500" />
      )}

      {/* Header: title + actions */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 flex-grow font-display text-[14.5px] font-bold leading-snug tracking-[-0.01em] text-[#1d1b1a] transition-colors group-hover:text-[#3525cd] dark:text-white dark:group-hover:text-[#c3c0ff]">
          {s.name}
        </h3>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPreview(s);
            }}
            className="rounded-lg p-1.5 text-[#c7c4d8] transition-colors hover:text-[#3525cd] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd] dark:text-stone-600 dark:hover:text-[#c3c0ff]"
            aria-label={fr ? "Aperçu rapide" : "Apèsi rapid"}
            title={fr ? "Aperçu rapide" : "Apèsi rapid"}
          >
            <Eye className="h-[18px] w-[18px]" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSave(s.id);
            }}
            className={`rounded-lg p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd] ${
              saved
                ? "text-[#3525cd] dark:text-[#c3c0ff]"
                : "text-[#c7c4d8] hover:text-[#6b6563] dark:text-stone-600 dark:hover:text-stone-300"
            }`}
            aria-label={saved ? (fr ? "Retirer des favoris" : "Retire nan favori") : (fr ? "Sauvegarder" : "Anrejistre")}
            title={saved ? (fr ? "Retirer des favoris" : "Retire nan favori") : (fr ? "Sauvegarder" : "Anrejistre")}
          >
            <Bookmark className={`h-[18px] w-[18px] ${saved ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metadata badges */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {elig === "yes" && (
          <span className={`${BADGE} border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400`}>
            <CheckCircle2 className="h-3 w-3" />
            {fr ? "🇭🇹 Éligible" : "🇭🇹 Elijib"}
          </span>
        )}
        <span className={`${BADGE} ${BADGE_NEUTRAL}`}>
          {countryEmoji(s.country)} {countryCode(s.country)}
        </span>
        {levels.map((l) => (
          <span key={l} className={`${BADGE} ${BADGE_NEUTRAL}`}>
            {l}
          </span>
        ))}
        {funding && (
          <span className={`${BADGE} border-[#3525cd]/20 bg-[#3525cd]/8 text-[#3525cd] dark:border-[#c3c0ff]/25 dark:bg-[#c3c0ff]/10 dark:text-[#c3c0ff]`}>
            {funding.text}
          </span>
        )}
        {(urgent || soon) && dlStatus && (
          <span
            className={`${BADGE} ${
              urgent
                ? "border-[#93000a]/25 bg-[#93000a]/8 text-[#93000a] dark:text-red-400"
                : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            }`}
          >
            {dlStatus.badgeLabel}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Footer: compare + detail */}
      <div className="mt-3.5 flex items-center justify-between border-t border-[#f3ecea] pt-3 dark:border-stone-800">
        <label
          onClick={(e) => e.stopPropagation()}
          className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[#6b6563] transition-colors hover:text-[#3525cd] dark:text-stone-400 dark:hover:text-[#c3c0ff]"
        >
          <input
            type="checkbox"
            checked={compared}
            onChange={(e) => {
              e.stopPropagation();
              onToggleCompare(s.id);
            }}
            className="h-3.5 w-3.5 rounded border-[#c7c4d8] text-[#3525cd] focus:ring-[#3525cd] dark:border-stone-600"
          />
          {fr ? "Comparer" : "Konpare"}
        </label>
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-bold text-[#3525cd] transition-all group-hover:gap-1.5 dark:text-[#c3c0ff]">
          {fr ? "Détails" : "Detay"}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
