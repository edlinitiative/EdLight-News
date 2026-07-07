"use client";

/**
 * ScholarshipRow — compact editorial/tabular row for the /bourses catalogue.
 *
 * One scholarship per line so many fit on screen: flag + name (+ eligibility),
 * a one-line funding · level meta, and — on wider screens — a deadline column
 * and chevron. Rows sit in a divided list, not individual cards.
 */

import type { ContentLanguage, AcademicLevel, DatasetCountry } from "@edlight-news/types";
import Link from "next/link";
import { Bookmark, ChevronRight } from "lucide-react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { getDeadlineStatus, formatDeadlineDate as formatDeadlineDateShared } from "@/lib/ui/deadlines";

const FUNDING = {
  full:           { fr: "Complet",    ht: "Konplè",    dot: "bg-emerald-500" },
  partial:        { fr: "Partiel",    ht: "Pasyèl",    dot: "bg-amber-500" },
  stipend:        { fr: "Allocation", ht: "Alokasyon", dot: "bg-amber-500" },
  "tuition-only": { fr: "Scolarité",  ht: "Frè etid",  dot: "bg-violet-500" },
  unknown:        { fr: "À vérifier", ht: "Pou verifye", dot: "bg-stone-400" },
} as Record<string, { fr: string; ht: string; dot: string }>;

const LEVELS: Record<AcademicLevel, { fr: string; ht: string }> = {
  bachelor: { fr: "Bachelor", ht: "Lisans" },
  master: { fr: "Master", ht: "Metriz" },
  phd: { fr: "PhD", ht: "Doktora" },
  short_programs: { fr: "Courts programmes", ht: "Pwogram kout" },
};

const COUNTRY_EMOJI: Record<DatasetCountry, string> = {
  US: "🇺🇸", CA: "🇨🇦", FR: "🇫🇷", UK: "🇬🇧", DO: "🇩🇴",
  MX: "🇲🇽", CN: "🇨🇳", RU: "🇷🇺", HT: "🇭🇹", Global: "🌍",
};

const MONTHS_FR = ["", "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function deadlineShort(s: SerializedScholarship, lang: ContentLanguage): string | null {
  const accuracy = s.deadlineAccuracy ?? (s.deadline?.dateISO ? "exact" : "unknown");
  if (accuracy === "exact" && s.deadline?.dateISO) return formatDeadlineDateShared(s.deadline.dateISO, lang);
  if (accuracy === "month-only" && s.deadline?.month) return MONTHS_FR[s.deadline.month] ?? null;
  return null;
}

interface ScholarshipRowProps {
  scholarship: SerializedScholarship;
  lang: ContentLanguage;
  saved: boolean;
  onToggleSave: (id: string) => void;
}

export function ScholarshipRow({ scholarship: s, lang, saved, onToggleSave }: ScholarshipRowProps) {
  const fr = lang === "fr";
  const funding = FUNDING[s.fundingType];
  const showFunding = !!funding && s.fundingType !== "unknown";
  const elig = s.haitianEligibility ?? "unknown";
  const levelText = s.level.map((l) => (LEVELS[l] ? (fr ? LEVELS[l].fr : LEVELS[l].ht) : l)).join(" · ");
  const emoji = COUNTRY_EMOJI[s.country] ?? COUNTRY_EMOJI.Global;
  const dlStatus =
    s.deadline?.dateISO && (s.deadlineAccuracy ?? "exact") === "exact"
      ? getDeadlineStatus(s.deadline.dateISO, lang)
      : null;
  const urgent = dlStatus?.badgeVariant === "today" || dlStatus?.badgeVariant === "urgent";
  const soon = dlStatus?.badgeVariant === "soon";
  const dl = urgent || soon ? dlStatus?.badgeLabel : deadlineShort(s, lang);
  const detailHref = `/bourses/${s.id}${lang !== "fr" ? `?lang=${lang}` : ""}`;

  return (
    <Link
      href={detailHref}
      className="group grid grid-cols-[1.5rem_1fr_auto] items-center gap-x-3 px-3 py-3 transition-colors hover:bg-[#f5f0ee]/60 sm:grid-cols-[1.5rem_minmax(0,1fr)_7rem_9rem_6rem_3.5rem] sm:gap-x-4 sm:px-4 dark:hover:bg-stone-800/40"
    >
      <span className="shrink-0 text-lg leading-none" aria-hidden="true">{emoji}</span>

      {/* Bourse (name + eligibility; funding·level shown inline only on mobile) */}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-display text-[14px] font-bold leading-snug text-[#1d1b1a] transition-colors group-hover:text-[#3525cd] dark:text-white dark:group-hover:text-[#c3c0ff]">
            {s.name}
          </h3>
          {elig === "yes" && (
            <span className="hidden shrink-0 rounded-full bg-[#3525cd]/8 px-2 py-0.5 text-[10px] font-semibold text-[#3525cd] sm:inline dark:bg-[#c3c0ff]/12 dark:text-[#c3c0ff]">
              {fr ? "Éligible Haïti" : "Elijib Ayiti"}
            </span>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-[#6b6563] sm:hidden dark:text-stone-400">
          {showFunding && (
            <span className="inline-flex items-center gap-1 font-semibold text-[#464555] dark:text-stone-300">
              <span className={`h-1.5 w-1.5 rounded-full ${funding.dot}`} />
              {fr ? funding.fr : funding.ht}
            </span>
          )}
          {showFunding && levelText && <span className="text-[#c7c4d8] dark:text-stone-600">·</span>}
          {levelText && <span className="truncate">{levelText}</span>}
        </p>
      </div>

      {/* Financement (desktop column) */}
      <span className="hidden items-center gap-1.5 text-[12px] text-[#6b6563] sm:inline-flex dark:text-stone-400">
        {showFunding ? (
          <>
            <span className={`h-1.5 w-1.5 rounded-full ${funding.dot}`} />
            {fr ? funding.fr : funding.ht}
          </>
        ) : (
          <span className="text-[#c7c4d8] dark:text-stone-600">—</span>
        )}
      </span>

      {/* Niveau (desktop column) */}
      <span className="hidden truncate text-[12px] text-[#6b6563] sm:block dark:text-stone-400">
        {levelText || <span className="text-[#c7c4d8] dark:text-stone-600">—</span>}
      </span>

      {/* Date limite (desktop column) */}
      <span
        className={`hidden text-right text-[12px] font-semibold sm:block ${
          urgent ? "text-[#93000a] dark:text-red-400" : soon ? "text-amber-700 dark:text-amber-400" : "text-[#6b6563] dark:text-stone-400"
        }`}
      >
        {dl || <span className="font-normal text-[#c7c4d8] dark:text-stone-600">—</span>}
      </span>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(s.id); }}
          className={`shrink-0 rounded-lg p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd] ${
            saved ? "text-[#3525cd] dark:text-[#c3c0ff]" : "text-[#c7c4d8] hover:text-[#6b6563] dark:text-stone-600 dark:hover:text-stone-300"
          }`}
          aria-label={saved ? (fr ? "Retirer des favoris" : "Retire nan favori") : (fr ? "Sauvegarder" : "Anrejistre")}
        >
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
        </button>
        <ChevronRight className="hidden h-4 w-4 shrink-0 text-[#c7c4d8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#3525cd] sm:block dark:text-stone-600 dark:group-hover:text-[#c3c0ff]" />
      </div>
    </Link>
  );
}
