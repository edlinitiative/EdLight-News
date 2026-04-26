"use client";

/**
 * ScholarshipCard — Compact, polished scholarship card.
 *
 * Layout:
 *   Icon + Funding chip + Save button (top row)
 *   Title (h3)
 *   Deadline metadata (compact row)
 *   Summary (clamped)
 *   Tags (if present)
 *   CTA footer
 */

import type { ContentLanguage, AcademicLevel, DatasetCountry } from "@edlight-news/types";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import {
  getDeadlineStatus,
  formatDeadlineDate as formatDeadlineDateShared,
  badgeStyle,
} from "@/lib/ui/deadlines";

// ── Label maps (shared with filters — duplicated here for self-containment) ─

const FUNDING_LABELS: Record<string, { fr: string; ht: string; color: string }> = {
  full:           { fr: "Complet",    ht: "Konplè",          color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  partial:        { fr: "Partiel",    ht: "Pasyèl",          color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  stipend:        { fr: "Partiel",    ht: "Pasyèl",          color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  "tuition-only": { fr: "Scolarité",  ht: "Frè etid sèlman", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  unknown:        { fr: "Inconnu",    ht: "Enkonni",         color: "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300" },
};

const LEVEL_LABELS: Record<AcademicLevel, { fr: string; ht: string }> = {
  bachelor:       { fr: "Bachelor",          ht: "Lisans" },
  master:         { fr: "Master",            ht: "Metriz" },
  phd:            { fr: "PhD",               ht: "Doktora" },
  short_programs: { fr: "Courts programmes", ht: "Pwogram kout" },
};

const COUNTRY_LABELS: Record<DatasetCountry, { fr: string; ht: string; code: string }> = {
  US: { fr: "États-Unis",        ht: "Etazini",        code: "US" },
  CA: { fr: "Canada",            ht: "Kanada",         code: "CA" },
  FR: { fr: "France",            ht: "Frans",          code: "FR" },
  UK: { fr: "Royaume-Uni",       ht: "Wayòm Ini",     code: "UK" },
  DO: { fr: "Rép. Dominicaine",  ht: "Rep. Dominikèn", code: "DO" },
  MX: { fr: "Mexique",           ht: "Meksik",         code: "MX" },
  CN: { fr: "Chine",             ht: "Lachin",         code: "CN" },
  RU: { fr: "Russie",            ht: "Larisi",         code: "RU" },
  HT: { fr: "Haïti",             ht: "Ayiti",          code: "HT" },
  Global: { fr: "International", ht: "Entènasyonal",   code: "GL" },
};

const MONTH_NAMES_FR = [
  "", "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * Country-themed card backgrounds.
 * Each entry provides a subtle gradient for the card corner
 * and a flag emoji rendered as a faded watermark.
 */
const COUNTRY_BG: Record<DatasetCountry, { gradient: string; darkGradient: string; emoji: string }> = {
  US: {
    gradient: "from-blue-50 via-transparent to-transparent",
    darkGradient: "dark:from-blue-950/30 dark:via-transparent dark:to-transparent",
    emoji: "🇺🇸",
  },
  CA: {
    gradient: "from-red-50 via-transparent to-transparent",
    darkGradient: "dark:from-red-950/30 dark:via-transparent dark:to-transparent",
    emoji: "🇨🇦",
  },
  FR: {
    gradient: "from-blue-50 via-transparent to-transparent",
    darkGradient: "dark:from-blue-950/30 dark:via-transparent dark:to-transparent",
    emoji: "🇫🇷",
  },
  UK: {
    gradient: "from-indigo-50 via-transparent to-transparent",
    darkGradient: "dark:from-indigo-950/30 dark:via-transparent dark:to-transparent",
    emoji: "🇬🇧",
  },
  DO: {
    gradient: "from-red-50 via-transparent to-transparent",
    darkGradient: "dark:from-red-950/30 dark:via-transparent dark:to-transparent",
    emoji: "🇩🇴",
  },
  MX: {
    gradient: "from-green-50 via-transparent to-transparent",
    darkGradient: "dark:from-green-950/30 dark:via-transparent dark:to-transparent",
    emoji: "🇲🇽",
  },
  CN: {
    gradient: "from-red-50 via-transparent to-transparent",
    darkGradient: "dark:from-red-950/30 dark:via-transparent dark:to-transparent",
    emoji: "🇨🇳",
  },
  RU: {
    gradient: "from-sky-50 via-transparent to-transparent",
    darkGradient: "dark:from-sky-950/30 dark:via-transparent dark:to-transparent",
    emoji: "🇷🇺",
  },
  HT: {
    gradient: "from-blue-50 via-transparent to-transparent",
    darkGradient: "dark:from-blue-950/30 dark:via-transparent dark:to-transparent",
    emoji: "🇭🇹",
  },
  Global: {
    gradient: "from-amber-50 via-transparent to-transparent",
    darkGradient: "dark:from-amber-950/30 dark:via-transparent dark:to-transparent",
    emoji: "🌍",
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string, lang: ContentLanguage): string {
  return formatDeadlineDateShared(iso, lang) ?? iso;
}

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

  // Shared deadline status for exact deadlines
  const dlStatus =
    s.deadline?.dateISO && (s.deadlineAccuracy ?? "exact") === "exact"
      ? getDeadlineStatus(s.deadline.dateISO, lang)
      : null;

  const bg = COUNTRY_BG[s.country] ?? COUNTRY_BG.Global;
  const detailHref = `/bourses/${s.id}${lang !== "fr" ? `?lang=${lang}` : ""}`;

  return (
    <Link
      href={detailHref}
      id={`scholarship-${s.id}`}
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl border bg-white p-3.5 sm:p-4 shadow-sm hover:shadow-md hover:border-[#3525cd]/30 transition-all dark:bg-stone-900 dark:border-stone-700/60 dark:hover:border-[#c3c0ff]/40 ${
        isDirectory
          ? "border-l-4 border-l-[#316bf3] border-[#c7c4d8]/15 dark:border-l-indigo-500 dark:border-stone-700"
          : "border-[#c7c4d8]/15"
      }`}
    >
      {/* ── Top row: Country icon + Status badge + Save button ── */}
      <div className="flex items-start justify-between gap-2 mb-2.5 sm:mb-3">
        <div className="h-9 w-9 sm:h-10 sm:w-10 bg-[#f9f2f0] dark:bg-stone-800 rounded-lg flex items-center justify-center flex-shrink-0 text-xl sm:text-2xl">
          <span className="select-none" aria-hidden="true">
            {bg.emoji}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {dlStatus && (dlStatus.badgeVariant === "today" || dlStatus.badgeVariant === "urgent") ? (
            <span className="bg-[#ffdad6] text-[#93000a] text-[9px] font-bold px-2 py-0.5 rounded-full uppercase whitespace-nowrap">
              {dlStatus.badgeLabel}
            </span>
          ) : dlStatus && dlStatus.badgeVariant === "soon" ? (
            <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase whitespace-nowrap dark:bg-amber-900/30 dark:text-amber-300">
              {dlStatus.badgeLabel}
            </span>
          ) : (
            <span className="bg-[#e8e1df] text-[#464555] text-[9px] font-bold px-2 py-0.5 rounded-full italic whitespace-nowrap dark:bg-stone-700 dark:text-stone-300">
              {elig === "yes"
                ? (fr ? "Haïti" : "HT")
                : isDirectory
                  ? (fr ? "Répertoire" : "Repètwa")
                  : (fr ? "Ouvert" : "Ouvè")}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSave(s.id);
            }}
            className={`p-1 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd] ${
              saved
                ? "text-[#3525cd] dark:text-[#c3c0ff]"
                : "text-[#c7c4d8] hover:text-[#464555] dark:text-stone-600 dark:hover:text-stone-400"
            }`}
            title={saved ? (fr ? "Retirer" : "Retire") : (fr ? "Sauvegarder" : "Anrejistre")}
            aria-label={saved ? "Remove from saved" : "Save scholarship"}
          >
            <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Title ── */}
      <h3 className="text-sm sm:text-base font-bold leading-tight text-[#1d1b1a] dark:text-white group-hover:text-[#3525cd] dark:group-hover:text-[#c3c0ff] transition-colors font-display line-clamp-2 mb-1.5">
        {s.name}
      </h3>

      {/* ── Metadata row: Funding + Level ── */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2 sm:mb-2.5 text-[10px] sm:text-[11px]">
        <span className={`rounded-md px-1.5 sm:px-2 py-0.5 font-semibold ${funding?.color ?? "bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300"}`}>
          {funding ? (fr ? funding.fr : funding.ht) : s.fundingType}
        </span>
        {s.level.length > 0 && (
          <span className="text-[#474948] dark:text-stone-400 font-medium">
            {s.level.map((l) => {
              const lbl = LEVEL_LABELS[l];
              return lbl ? (fr ? lbl.fr : lbl.ht) : l;
            }).join(" · ")}
          </span>
        )}
      </div>

      {/* ── Summary ── */}
      {s.eligibilitySummary && (
        <p className="line-clamp-2 text-xs text-[#474948] dark:text-stone-400 mb-2 sm:mb-2.5 leading-relaxed">
          {s.eligibilitySummary}
        </p>
      )}

      {/* ── Tags (compact, max 3) ── */}
      {s.tags && s.tags.length > 0 && (
        <div className="mb-2.5 sm:mb-3 flex flex-wrap gap-1">
          {s.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-md bg-[#e8e1df] px-1.5 py-0.5 text-[10px] font-medium text-[#464555] dark:bg-stone-800 dark:text-stone-400">
              {tag}
            </span>
          ))}
          {s.tags.length > 3 && (
            <span className="rounded-md bg-[#e8e1df] px-1.5 py-0.5 text-[10px] font-medium text-[#464555] dark:bg-stone-800 dark:text-stone-400">
              +{s.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Footer: Deadline + visual CTA (whole card is clickable) ── */}
      <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-[#f3ecea]/60 dark:border-stone-800 flex items-center justify-between gap-2">
        <div className="text-[10px] text-[#474948] dark:text-stone-500 font-medium">
          {dlText && dlText}
        </div>
        <span className="text-[#3525cd] dark:text-[#c3c0ff] font-bold text-[11px] sm:text-xs flex items-center gap-0.5 group-hover:underline whitespace-nowrap">
          {fr ? "Voir détails" : "Wè detay"}
          <span className="material-symbols-outlined text-xs group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
        </span>
      </div>
    </Link>
  );
}
