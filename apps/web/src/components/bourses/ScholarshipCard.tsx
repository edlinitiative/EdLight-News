"use client";

/**
 * ScholarshipCard — Redesigned scholarship card with clear visual hierarchy.
 *
 * Layout:
 *   Top: Title + funding chip
 *   Second row: Deadline + countdown + eligibility
 *   Body: Clamped summary + expandable tags
 *   Footer: CTAs + collapsible sources
 */

import { useState } from "react";
import type { ContentLanguage, AcademicLevel, DatasetCountry } from "@edlight-news/types";
import {
  CalendarDays,
  BookOpen,
  CheckCircle,
  HelpCircle,
  FolderOpen,
  ExternalLink,
  Paperclip,
  Bookmark,
  ChevronDown,
} from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const funding = FUNDING_LABELS[s.fundingType];
  const cl = COUNTRY_LABELS[s.country];
  const isDirectory = s.kind === "directory";
  const elig = s.haitianEligibility ?? "unknown";
  const dlText = deadlineText(s, lang);

  // Shared deadline status for exact deadlines
  const dlStatus =
    s.deadline?.dateISO && (s.deadlineAccuracy ?? "exact") === "exact"
      ? getDeadlineStatus(s.deadline.dateISO, lang)
      : null;

  const visibleTags = tagsExpanded ? (s.tags ?? []) : (s.tags ?? []).slice(0, 3);
  const hiddenTagCount = (s.tags?.length ?? 0) - 3;

  const bg = COUNTRY_BG[s.country] ?? COUNTRY_BG.Global;

  return (
    <article
      id={`scholarship-${s.id}`}
      className={`group relative flex h-full flex-col overflow-hidden rounded-xl bg-white p-6 shadow-[0_20px_40px_rgba(29,27,26,0.05)] transition-transform hover:-translate-y-1 dark:bg-stone-900 ${
        isDirectory
          ? "border-l-4 border-l-[#316bf3] border border-[#c7c4d8]/15 dark:border-l-indigo-500 dark:border-stone-700"
          : "border border-[#c7c4d8]/15 dark:border-stone-700"
      }`}
    >
      {/* ── Top row: Country icon + Urgency badge ── */}
      <div className="flex justify-between items-start mb-6">
        <div className="h-14 w-14 bg-[#f9f2f0] dark:bg-stone-800 rounded-lg flex items-center justify-center p-2">
          <span className="text-3xl select-none" aria-hidden="true">
            {bg.emoji}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {dlStatus && (dlStatus.badgeVariant === "today" || dlStatus.badgeVariant === "urgent") ? (
            <span className="bg-[#ffdad6] text-[#93000a] text-[10px] font-bold px-3 py-1 rounded-full uppercase">
              {dlStatus.badgeLabel}
            </span>
          ) : dlStatus && dlStatus.badgeVariant === "soon" ? (
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-3 py-1 rounded-full uppercase dark:bg-amber-900/30 dark:text-amber-300">
              {dlStatus.badgeLabel}
            </span>
          ) : (
            <span className="bg-[#e8e1df] text-[#464555] text-[10px] font-bold px-3 py-1 rounded-full uppercase italic dark:bg-stone-700 dark:text-stone-300">
              {elig === "yes"
                ? (fr ? "Éligible Haïti" : "Elijib Ayiti")
                : isDirectory
                  ? (fr ? "Répertoire" : "Repètwa")
                  : (fr ? "Candidature ouverte" : "Kandidati ouvèt")}
            </span>
          )}
          <button
            type="button"
            onClick={() => onToggleSave(s.id)}
            className={`rounded-lg p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd] ${
              saved
                ? "text-[#3525cd] dark:text-[#c3c0ff]"
                : "text-[#c7c4d8] hover:text-[#464555] dark:text-stone-600 dark:hover:text-stone-400"
            }`}
            title={saved ? (fr ? "Retirer des suivis" : "Retire nan swivi yo") : (fr ? "Sauvegarder" : "Anrejistre")}
            aria-label={saved ? "Remove from saved" : "Save scholarship"}
          >
            <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Title ── */}
      <h3 className="text-xl font-bold leading-tight text-[#1d1b1a] dark:text-white group-hover:text-[#3525cd] dark:group-hover:text-[#c3c0ff] transition-colors font-display">
        {s.name}
      </h3>

      {/* ── Summary ── */}
      {s.eligibilitySummary && (
        <div className="mt-3">
          <p className={`text-sm leading-relaxed text-[#464555] dark:text-stone-300 ${!expanded ? "line-clamp-2" : ""}`}>
            {s.eligibilitySummary}
          </p>
          {s.eligibilitySummary.length > 120 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-[#3525cd] hover:text-[#4f46e5] dark:text-[#c3c0ff] dark:hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd]"
            >
              {expanded ? (fr ? "Réduire" : "Redwi") : (fr ? "Lire plus" : "Li plis")}
            </button>
          )}
        </div>
      )}

      {/* ── Tags (compact) ── */}
      {s.tags && s.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {visibleTags.map((tag) => (
            <span key={tag} className="rounded-full bg-[#e8e1df] px-2 py-0.5 text-[11px] font-semibold text-[#464555] dark:bg-stone-800 dark:text-stone-400">
              {tag}
            </span>
          ))}
          {!tagsExpanded && hiddenTagCount > 0 && (
            <button
              type="button"
              onClick={() => setTagsExpanded(true)}
              className="rounded-full bg-[#e8e1df] px-2 py-0.5 text-[11px] font-medium text-[#464555] hover:bg-[#c7c4d8] dark:bg-stone-700 dark:text-stone-400 dark:hover:bg-stone-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3525cd]"
            >
              +{hiddenTagCount}
            </button>
          )}
        </div>
      )}

      {/* Spacer to push footer down */}
      <div className="flex-1" />

      {/* ── Footer: dashed border + value + CTA ── */}
      <div className="mt-8 pt-6 border-t border-[#f3ecea] border-dashed dark:border-stone-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-[#474948] dark:text-stone-400 uppercase tracking-wide">
            {funding ? (fr ? funding.fr : funding.ht) : s.fundingType}
            {dlText && ` · ${dlText}`}
          </span>
          {s.level.length > 0 && (
            <span className="text-[10px] text-[#464555] dark:text-stone-500 mt-0.5">
              {s.level.map((l) => {
                const lbl = LEVEL_LABELS[l];
                return lbl ? (fr ? lbl.fr : lbl.ht) : l;
              }).join(" · ")}
            </span>
          )}
        </div>
        <a
          href={s.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3525cd] dark:text-[#c3c0ff] font-bold text-xs flex items-center gap-1 group/cta hover:underline"
        >
          {isDirectory
            ? (fr ? "EXPLORER" : "EKSPLORE")
            : s.howToApplyUrl
              ? (fr ? "POSTULER" : "APLIKE")
              : (fr ? "VOIR DÉTAILS" : "WÈ DETAY")}
          <span className="material-symbols-outlined text-sm group-hover/cta:translate-x-1 transition-transform">arrow_forward</span>
        </a>
      </div>

      {/* ── Collapsible: Source & verification ── */}
      <details className="mt-3">
        <summary className="cursor-pointer list-none text-[11px] font-medium text-[#c7c4d8] transition-colors hover:text-[#464555] dark:text-stone-500 dark:hover:text-stone-300">
          <span className="inline-flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            {fr ? "Source & vérification" : "Sous & verifikasyon"}
            <ChevronDown className="h-3 w-3" />
          </span>
        </summary>
        <div className="mt-2 space-y-2 rounded-lg border border-[#c7c4d8]/15 bg-[#f9f2f0]/70 p-2.5 text-xs dark:border-stone-800 dark:bg-stone-800/40">
          {s.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {s.sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-white px-1.5 py-0.5 text-[10px] text-[#464555] hover:text-[#3525cd] hover:underline dark:bg-stone-900 dark:text-stone-400 dark:hover:text-[#c3c0ff]"
                >
                  {src.label}
                </a>
              ))}
            </div>
          )}
          {s.deadline?.sourceUrl && (
            <a
              href={s.deadline.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-[#3525cd] hover:underline dark:text-[#c3c0ff]"
            >
              {fr ? "Source deadline" : "Sous dat limit"}
            </a>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#c7c4d8] dark:text-stone-500">
            {s.verifiedAtISO && (
              <span className="inline-flex items-center gap-0.5">
                <CheckCircle className="h-2.5 w-2.5 text-emerald-500" />
                {fr ? "Vérifié" : "Verifye"} {formatDate(s.verifiedAtISO, lang)}
              </span>
            )}
            {s.updatedAtISO && (
              <span>
                {fr ? "Mis à jour" : "Mizajou"} {formatDate(s.updatedAtISO, lang)}
              </span>
            )}
          </div>
        </div>
      </details>
    </article>
  );
}
