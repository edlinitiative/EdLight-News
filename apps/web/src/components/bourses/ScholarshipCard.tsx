"use client";

/**
 * ScholarshipCard — clean, scannable scholarship card.
 *
 * Deliberately minimal: flag + eligibility, title, one meta line
 * (funding · level), a short summary, and a footer with an actionable
 * deadline (only when there is one) and the detail affordance. No tag
 * clutter, no redundant/placeholder labels.
 */

import type { ContentLanguage, AcademicLevel, DatasetCountry } from "@edlight-news/types";
import Link from "next/link";
import { Bookmark, Clock, ArrowRight } from "lucide-react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import {
  getDeadlineStatus,
  formatDeadlineDate as formatDeadlineDateShared,
} from "@/lib/ui/deadlines";

// ── Label maps ──────────────────────────────────────────────────────────────

const FUNDING_LABELS: Record<string, { fr: string; ht: string; dot: string }> = {
  full:           { fr: "Complet",    ht: "Konplè",    dot: "bg-emerald-500" },
  partial:        { fr: "Partiel",    ht: "Pasyèl",    dot: "bg-amber-500" },
  stipend:        { fr: "Allocation", ht: "Alokasyon", dot: "bg-amber-500" },
  "tuition-only": { fr: "Scolarité",  ht: "Frè etid",  dot: "bg-violet-500" },
  unknown:        { fr: "À vérifier", ht: "Pou verifye", dot: "bg-stone-400" },
};

const LEVEL_LABELS: Record<AcademicLevel, { fr: string; ht: string }> = {
  bachelor:       { fr: "Bachelor",          ht: "Lisans" },
  master:         { fr: "Master",            ht: "Metriz" },
  phd:            { fr: "PhD",               ht: "Doktora" },
  short_programs: { fr: "Courts programmes", ht: "Pwogram kout" },
};

const COUNTRY_EMOJI: Record<DatasetCountry, string> = {
  US: "🇺🇸", CA: "🇨🇦", FR: "🇫🇷", UK: "🇬🇧", DO: "🇩🇴",
  MX: "🇲🇽", CN: "🇨🇳", RU: "🇷🇺", HT: "🇭🇹", Global: "🌍",
};

const MONTH_NAMES_FR = [
  "", "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Human deadline text, or null when there's nothing actionable to show. */
function deadlineText(s: SerializedScholarship, lang: ContentLanguage): string | null {
  const fr = lang === "fr";
  const accuracy = s.deadlineAccuracy ?? (s.deadline?.dateISO ? "exact" : "unknown");
  switch (accuracy) {
    case "exact":
      return s.deadline?.dateISO ? formatDeadlineDateShared(s.deadline.dateISO, lang) : null;
    case "month-only": {
      const m = s.deadline?.month;
      if (m && m >= 1 && m <= 12) return fr ? `Fin ${MONTH_NAMES_FR[m]}` : `Fen ${MONTH_NAMES_FR[m]}`;
      return null;
    }
    default:
      return null; // "varies" / "unknown" → don't clutter the card
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
  const showFunding = !!funding && s.fundingType !== "unknown";
  const isDirectory = s.kind === "directory";
  const elig = s.haitianEligibility ?? "unknown";

  const dlStatus =
    s.deadline?.dateISO && (s.deadlineAccuracy ?? "exact") === "exact"
      ? getDeadlineStatus(s.deadline.dateISO, lang)
      : null;
  const deadlineUrgent = dlStatus?.badgeVariant === "today" || dlStatus?.badgeVariant === "urgent";
  const deadlineSoon = dlStatus?.badgeVariant === "soon";
  const dlText = deadlineText(s, lang);
  const deadlineLabel = deadlineUrgent || deadlineSoon ? dlStatus?.badgeLabel : dlText;

  const levelText = s.level
    .map((l) => (LEVEL_LABELS[l] ? (fr ? LEVEL_LABELS[l].fr : LEVEL_LABELS[l].ht) : l))
    .join(" · ");

  const emoji = COUNTRY_EMOJI[s.country] ?? COUNTRY_EMOJI.Global;
  const detailHref = `/bourses/${s.id}${lang !== "fr" ? `?lang=${lang}` : ""}`;

  return (
    <Link
      href={detailHref}
      id={`scholarship-${s.id}`}
      className="group relative flex h-full flex-col rounded-2xl border border-[#c7c4d8]/15 bg-white p-5 transition-all duration-200 active:scale-[0.99] sm:hover:-translate-y-0.5 sm:hover:border-[#3525cd]/25 sm:hover:shadow-[0_14px_30px_-14px_rgba(29,27,26,0.15)] dark:border-stone-800 dark:bg-stone-900/90 dark:sm:hover:border-[#c3c0ff]/20"
    >
      {deadlineUrgent && (
        <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl bg-[#93000a] dark:bg-red-500" />
      )}

      {/* Top: flag + eligibility · save */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-lg leading-none" aria-hidden="true">{emoji}</span>
          {elig === "yes" ? (
            <span className="inline-flex items-center rounded-full bg-[#3525cd]/8 px-2 py-0.5 text-[11px] font-semibold text-[#3525cd] dark:bg-[#c3c0ff]/12 dark:text-[#c3c0ff]">
              {fr ? "Éligible Haïti" : "Elijib Ayiti"}
            </span>
          ) : isDirectory ? (
            <span className="inline-flex items-center rounded-full bg-[#f5f0ee] px-2 py-0.5 text-[11px] font-semibold text-[#6b6563] dark:bg-stone-800 dark:text-stone-400">
              {fr ? "Répertoire" : "Repètwa"}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(s.id); }}
          className={`-mr-1 rounded-lg p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd] ${
            saved
              ? "text-[#3525cd] dark:text-[#c3c0ff]"
              : "text-[#c7c4d8] hover:text-[#6b6563] dark:text-stone-600 dark:hover:text-stone-300"
          }`}
          aria-label={saved ? (fr ? "Retirer des favoris" : "Retire nan favori") : (fr ? "Sauvegarder" : "Anrejistre")}
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Title */}
      <h3 className="font-display text-[15px] font-bold leading-snug tracking-[-0.01em] text-[#1d1b1a] line-clamp-2 transition-colors group-hover:text-[#3525cd] dark:text-white dark:group-hover:text-[#c3c0ff]">
        {s.name}
      </h3>

      {/* Meta: funding (if known) · level */}
      {(showFunding || levelText) && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-[#6b6563] dark:text-stone-400">
          {showFunding && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#1d1b1a] dark:text-stone-200">
              <span className={`h-1.5 w-1.5 rounded-full ${funding.dot}`} />
              {fr ? funding.fr : funding.ht}
            </span>
          )}
          {showFunding && levelText && <span className="text-[#c7c4d8] dark:text-stone-600">·</span>}
          {levelText && <span>{levelText}</span>}
        </p>
      )}

      {/* Summary */}
      {s.eligibilitySummary && (
        <p className="mt-2.5 line-clamp-2 text-[13px] leading-relaxed text-[#6b6563] dark:text-stone-400">
          {s.eligibilitySummary}
        </p>
      )}

      <div className="flex-1" />

      {/* Footer: deadline (only when actionable) + detail affordance */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#f3ecea] pt-3 dark:border-stone-800">
        {deadlineLabel ? (
          <span
            className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${
              deadlineUrgent
                ? "text-[#93000a] dark:text-red-400"
                : deadlineSoon
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-[#6b6563] dark:text-stone-400"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {deadlineLabel}
          </span>
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-bold text-[#3525cd] transition-all group-hover:gap-1.5 dark:text-[#c3c0ff]">
          {fr ? "Voir détails" : "Wè detay"}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
