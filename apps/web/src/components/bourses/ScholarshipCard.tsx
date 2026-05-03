"use client";

/**
 * ScholarshipCard — Mobile-first, premium scholarship card.
 *
 * Key improvements:
 *   - Larger touch targets on mobile (min 44px for save button)
 *   - Smooth shimmer effect on hover (desktop)
 *   - Tap feedback on mobile via scale transforms
 *   - Premium gradient overlays with country flag emoji
 *   - Deadline countdown with urgency pulse animation
 *   - Improved visual hierarchy with generous spacing on mobile
 *   - Card press micro-interaction via card-press CSS class
 */

import type { ContentLanguage, AcademicLevel, DatasetCountry } from "@edlight-news/types";
import Link from "next/link";
import { Bookmark, Clock, ArrowRight, Globe, MapPin, GraduationCap } from "lucide-react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import {
  getDeadlineStatus,
  formatDeadlineDate as formatDeadlineDateShared,
  badgeStyle,
} from "@/lib/ui/deadlines";

// ── Label maps ──────────────────────────────────────────────────────────────

const FUNDING_LABELS: Record<string, { fr: string; ht: string; color: string }> = {
  full:           { fr: "Complet",    ht: "Konplè",          color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800" },
  partial:        { fr: "Partiel",    ht: "Pasyèl",          color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800" },
  stipend:        { fr: "Allocation", ht: "Alokasyon",       color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800" },
  "tuition-only": { fr: "Scolarité",  ht: "Frè etid",        color: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800" },
  unknown:        { fr: "À vérifier", ht: "Pou verifye",     color: "bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-800/50 dark:text-stone-400 dark:border-stone-700" },
};

const LEVEL_LABELS: Record<AcademicLevel, { fr: string; ht: string }> = {
  bachelor:       { fr: "Bachelor",          ht: "Lisans" },
  master:         { fr: "Master",            ht: "Metriz" },
  phd:            { fr: "PhD",               ht: "Doktora" },
  short_programs: { fr: "Courts programmes", ht: "Pwogram kout" },
};

const COUNTRY_BG: Record<DatasetCountry, { emoji: string }> = {
  US: { emoji: "🇺🇸" },
  CA: { emoji: "🇨🇦" },
  FR: { emoji: "🇫🇷" },
  UK: { emoji: "🇬🇧" },
  DO: { emoji: "🇩🇴" },
  MX: { emoji: "🇲🇽" },
  CN: { emoji: "🇨🇳" },
  RU: { emoji: "🇷🇺" },
  HT: { emoji: "🇭🇹" },
  Global: { emoji: "🌍" },
};

const MONTH_NAMES_FR = [
  "", "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function deadlineText(s: SerializedScholarship, lang: ContentLanguage): string | null {
  const fr = lang === "fr";
  const accuracy = s.deadlineAccuracy ?? (s.deadline?.dateISO ? "exact" : "unknown");

  switch (accuracy) {
    case "exact":
      if (s.deadline?.dateISO) return formatDeadlineDateShared(s.deadline.dateISO, lang);
      return fr ? "À vérifier" : "Pou verifye";
    case "month-only": {
      const m = s.deadline?.month;
      if (m && m >= 1 && m <= 12) {
        return fr ? `Fin ${MONTH_NAMES_FR[m]}` : `Fen ${MONTH_NAMES_FR[m]}`;
      }
      return s.deadline?.notes ?? (fr ? "À vérifier" : "Pou verifye");
    }
    case "varies":
      return fr ? "Délais variables" : "Dat limit varyab";
    default:
      return fr ? "À vérifier" : "Pou verifye";
  }
}

// ── Component ───────────────────────────────────────────────────────────────

interface ScholarshipCardProps {
  scholarship: SerializedScholarship;
  lang: ContentLanguage;
  saved: boolean;
  onToggleSave: (id: string) => void;
}

export function ScholarshipCard({ scholarship: s, lang, saved, onToggleSave }: ScholarshipCardProps) {
  const fr = lang === "fr";
  const funding = FUNDING_LABELS[s.fundingType];
  const isDirectory = s.kind === "directory";
  const elig = s.haitianEligibility ?? "unknown";
  const dlText = deadlineText(s, lang);

  const dlStatus =
    s.deadline?.dateISO && (s.deadlineAccuracy ?? "exact") === "exact"
      ? getDeadlineStatus(s.deadline.dateISO, lang)
      : null;

  const bg = COUNTRY_BG[s.country] ?? COUNTRY_BG.Global;
  const detailHref = `/bourses/${s.id}${lang !== "fr" ? `?lang=${lang}` : ""}`;
  const deadlineUrgent = dlStatus && (dlStatus.badgeVariant === "today" || dlStatus.badgeVariant === "urgent");
  const deadlineSoon = dlStatus && dlStatus.badgeVariant === "soon";

  return (
    <Link
      href={detailHref}
      id={`scholarship-${s.id}`}
      className={`
        group relative flex h-full flex-col overflow-hidden
        rounded-2xl border bg-white
        shadow-[0_1px_2px_rgba(29,27,26,0.06),0_4px_12px_rgba(29,27,26,0.02)]
        dark:bg-stone-900/95 dark:border-stone-700/40 dark:shadow-none

        px-4 py-4 sm:px-5 sm:py-4

        transition-all duration-300 ease-out
        active:scale-[0.985]

        ${isDirectory
          ? "border-l-[4px] sm:border-l-[3px] border-l-[#316bf3] border-[#c7c4d8]/10 dark:border-l-indigo-500 dark:border-stone-700"
          : "border-[#c7c4d8]/10"
        }

        /* Desktop hover lift via media query */
        sm:hover:shadow-[0_20px_40px_-8px_rgba(29,27,26,0.08)]
        sm:hover:border-[#3525cd]/20 sm:hover:-translate-y-0.5
        dark:sm:hover:border-[#c3c0ff]/20
        dark:sm:hover:shadow-[0_20px_40px_-8px_rgba(0,0,0,0.5)]
      `}
    >
      {/* ── Urgency stripe indicator ── */}
      {deadlineUrgent && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-[#93000a] dark:bg-red-600 rounded-t-2xl" />
      )}
      {deadlineSoon && !deadlineUrgent && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 rounded-t-2xl" />
      )}

      {/* ── Premium gradient overlay (desktop hover only) ── */}
      <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden opacity-0 sm:group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-[#3525cd]/[0.03] blur-3xl dark:bg-[#c3c0ff]/[0.04]" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-[#4f46e5]/[0.03] blur-3xl dark:bg-[#a5a0ff]/[0.03]" />
      </div>

      {/* ── Top row: Country emoji + Status badge + Save ── */}
      <div className="flex items-start justify-between gap-2 mb-3 sm:mb-3.5">
        <div className="
          relative h-11 w-11 sm:h-10 sm:w-10
          bg-[#f5f0ee] dark:bg-stone-800
          rounded-xl flex items-center justify-center
          flex-shrink-0 text-lg sm:text-lg
          shadow-sm ring-1 ring-[#c7c4d8]/10 dark:ring-stone-700/30
        ">
          <span className="select-none" aria-hidden="true">{bg.emoji}</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Status badge */}
          {deadlineUrgent ? (
            <span className="bg-[#ffdad6] text-[#93000a] dark:bg-red-950/30 dark:text-red-400 text-[10px] sm:text-[10px] font-extrabold px-2.5 sm:px-2 py-1.5 sm:py-1 rounded-full uppercase tracking-wide whitespace-nowrap deadline-urgent border border-red-200 dark:border-red-800/50">
              {dlStatus?.badgeLabel}
            </span>
          ) : deadlineSoon ? (
            <span className="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 text-[10px] sm:text-[10px] font-extrabold px-2.5 sm:px-2 py-1.5 sm:py-1 rounded-full uppercase tracking-wide whitespace-nowrap border border-amber-200 dark:border-amber-800/50">
              {dlStatus?.badgeLabel}
            </span>
          ) : (
            <span className="bg-[#f5f0ee] text-[#464555] dark:bg-stone-800 dark:text-stone-300 text-[10px] sm:text-[10px] font-bold px-2.5 sm:px-2 py-1.5 sm:py-1 rounded-full whitespace-nowrap border border-[#c7c4d8]/10 dark:border-stone-700/30">
              {elig === "yes"
                ? (fr ? "🇭🇹 Haïti" : "🇭🇹 HT")
                : isDirectory
                  ? (fr ? "📋 Répertoire" : "📋 Repètwa")
                  : (fr ? "Ouvert" : "Ouvè")}
            </span>
          )}

          {/* Save button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSave(s.id);
            }}
            className={`
              save-btn-mobile rounded-xl sm:rounded-lg
              transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd] focus-visible:ring-offset-2
              ${saved
                ? "text-[#3525cd] dark:text-[#c3c0ff] bg-[#3525cd]/10 dark:bg-[#c3c0ff]/12"
                : "text-[#c7c4d8] hover:text-[#464555] hover:bg-[#f5f0ee] dark:text-stone-500 dark:hover:text-stone-300 dark:hover:bg-stone-800"
              }
            `}
            title={saved ? (fr ? "Retirer des favoris" : "Retire nan favori") : (fr ? "Sauvegarder" : "Anrejistre")}
            aria-label={saved ? "Remove from saved" : "Save scholarship"}
          >
            <Bookmark
              className={`
                h-4 w-4 sm:h-3.5 sm:w-3.5
                transition-transform duration-200
                ${saved ? "fill-current scale-110" : "group-hover:scale-110"}
              `}
            />
          </button>
        </div>
      </div>

      {/* ── Title ── */}
      <h3 className="
        text-[15px] sm:text-[15px] font-bold leading-snug
        text-[#1d1b1a] dark:text-white
        sm:group-hover:text-[#3525cd] dark:sm:group-hover:text-[#c3c0ff]
        transition-colors duration-200
        font-display line-clamp-2
        mb-2 sm:mb-2 tracking-[-0.01em]
      ">
        {s.name}
      </h3>

      {/* ── Metadata: Funding chip + Level ── */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2 mb-2.5 sm:mb-2.5">
        <span className={`
          inline-flex items-center rounded-lg sm:rounded-md
          px-2.5 sm:px-2 py-1 sm:py-0.5
          text-[11px] sm:text-[11px] font-bold border
          ${funding?.color ?? "bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-800/50 dark:text-stone-400 dark:border-stone-700"}
        `}>
          {funding ? (fr ? funding.fr : funding.ht) : s.fundingType}
        </span>

        {s.level.length > 0 && (
          <span className="text-[11px] sm:text-[11px] font-medium text-[#6b6563] dark:text-stone-400 flex items-center gap-1.5">
            <GraduationCap className="h-3 w-3 sm:h-3 sm:w-3" />
            {s.level.map((l) => {
              const lbl = LEVEL_LABELS[l];
              return lbl ? (fr ? lbl.fr : lbl.ht) : l;
            }).join(" · ")}
          </span>
        )}
      </div>

      {/* ── Summary ── */}
      {s.eligibilitySummary && (
        <p className="
          line-clamp-2 text-xs sm:text-xs
          text-[#6b6563] dark:text-stone-400
          mb-3 sm:mb-2.5 leading-relaxed
        ">
          {s.eligibilitySummary}
        </p>
      )}

      {/* ── Tags ── */}
      {s.tags && s.tags.length > 0 && (
        <div className="mb-3 sm:mb-3 flex flex-wrap gap-1.5 sm:gap-1.5">
          {s.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="
                rounded-lg sm:rounded-md
                bg-[#f5f0ee] dark:bg-stone-800
                px-2.5 sm:px-2 py-1 sm:py-0.5
                text-[10px] sm:text-[10px] font-semibold
                text-[#464555] dark:text-stone-400
                border border-[#c7c4d8]/10 dark:border-stone-700/30
              "
            >
              {tag}
            </span>
          ))}
          {s.tags.length > 3 && (
            <span className="
              rounded-lg sm:rounded-md
              bg-[#f5f0ee] dark:bg-stone-800
              px-2.5 sm:px-2 py-1 sm:py-0.5
              text-[10px] sm:text-[10px] font-semibold
              text-[#464555] dark:text-stone-400
              border border-[#c7c4d8]/10 dark:border-stone-700/30
            ">
              +{s.tags.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* ── Footer: Deadline + CTA ── */}
      <div className="
        mt-3 sm:mt-3 pt-3 sm:pt-3
        border-t border-[#f3ecea]/60 dark:border-stone-800/60
        flex items-center justify-between gap-2
      ">
        <div className={`
          flex items-center gap-1.5 sm:gap-1
          text-[11px] sm:text-[11px] font-semibold
          ${deadlineUrgent ? 'text-[#93000a] dark:text-red-400 deadline-urgent' : 'text-[#6b6563] dark:text-stone-500'}
        `}>
          <Clock className="h-3 w-3 sm:h-3 sm:w-3 flex-shrink-0" />
          <span>{dlText}</span>
        </div>

        <span className="
          inline-flex items-center gap-1 sm:gap-1
          text-[#3525cd] dark:text-[#c3c0ff]
          font-bold text-[12px] sm:text-[12px]
          sm:group-hover:gap-1.5
          transition-all duration-300
          whitespace-nowrap
        ">
          {fr ? "Voir détails" : "Wè detay"}
          <ArrowRight className="h-3 w-3 sm:h-3 sm:w-3 sm:group-hover:translate-x-0.5 transition-transform duration-300" />
        </span>
      </div>
    </Link>
  );
}