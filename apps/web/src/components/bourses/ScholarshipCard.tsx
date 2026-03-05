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
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md dark:bg-stone-900 ${
        isDirectory
          ? "border-l-4 border-l-indigo-300 border-stone-200 dark:border-l-indigo-600 dark:border-stone-700"
          : "border-stone-200 dark:border-stone-700"
      }`}
    >
      {/* ── Decorative country-themed background ── */}
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${bg.gradient} ${bg.darkGradient}`}
        aria-hidden="true"
      />
      <span
        className="pointer-events-none absolute -right-4 -top-2 select-none text-[7rem] leading-none opacity-[0.07] dark:opacity-[0.05] transition-transform duration-300 group-hover:scale-110"
        aria-hidden="true"
      >
        {bg.emoji}
      </span>

      {/* ── Top row: Title + Funding chip + Save ── */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold leading-snug text-stone-900 dark:text-white">
            {s.name}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {funding && (
            <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${funding.color}`}>
              {fr ? funding.fr : funding.ht}
            </span>
          )}
          <button
            type="button"
            onClick={() => onToggleSave(s.id)}
            className={`rounded-lg p-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              saved
                ? "text-blue-600 dark:text-blue-400"
                : "text-stone-300 hover:text-stone-500 dark:text-stone-600 dark:hover:text-stone-400"
            }`}
            title={saved ? (fr ? "Retirer des suivis" : "Retire nan swivi yo") : (fr ? "Sauvegarder" : "Anrejistre")}
            aria-label={saved ? "Remove from saved" : "Save scholarship"}
          >
            <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Second row: Deadline + Country + Eligibility ── */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {cl && (
          <span className="inline-flex items-center rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
            {cl.code}
          </span>
        )}

        {dlText && (
          <span className="inline-flex items-center gap-1 text-xs text-stone-600 dark:text-stone-400">
            <CalendarDays className="h-3 w-3 text-blue-500" />
            {dlText}
          </span>
        )}

        {dlStatus && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeStyle(dlStatus.badgeVariant)}`}>
            {dlStatus.badgeLabel}
          </span>
        )}

        {dlStatus && dlStatus.daysLeft !== null && (
          <span className="text-[11px] text-stone-400 dark:text-stone-500">
            {dlStatus.humanLine}
          </span>
        )}

        {elig === "yes" && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/20 dark:text-green-300">
            <CheckCircle className="h-3 w-3" />
            {fr ? "Haïti: Oui" : "Ayiti: Wi"}
          </span>
        )}
        {elig === "unknown" && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-400">
            <HelpCircle className="h-3 w-3" />
            {fr ? "Haïti: À vérifier" : "Ayiti: Pou verifye"}
          </span>
        )}

        {isDirectory && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
            <FolderOpen className="h-3 w-3" />
            {fr ? "Répertoire" : "Repètwa"}
          </span>
        )}
      </div>

      {/* ── Levels ── */}
      {s.level.length > 0 && (
        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
          <BookOpen className="mr-1 inline h-3 w-3" />
          {s.level.map((l) => {
            const lbl = LEVEL_LABELS[l];
            return lbl ? (fr ? lbl.fr : lbl.ht) : l;
          }).join(" · ")}
        </p>
      )}

      {/* ── Summary (clamped) ── */}
      {s.eligibilitySummary && (
        <div className="mt-3">
          <p className={`text-sm leading-relaxed text-stone-600 dark:text-stone-300 ${!expanded ? "line-clamp-2" : ""}`}>
            {s.eligibilitySummary}
          </p>
          {s.eligibilitySummary.length > 120 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {expanded ? (fr ? "Réduire" : "Redwi") : (fr ? "Lire plus" : "Li plis")}
            </button>
          )}
        </div>
      )}

      {/* ── Tags ── */}
      {s.tags && s.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {visibleTags.map((tag) => (
            <span key={tag} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600 dark:bg-stone-800 dark:text-stone-400">
              {tag}
            </span>
          ))}
          {!tagsExpanded && hiddenTagCount > 0 && (
            <button
              type="button"
              onClick={() => setTagsExpanded(true)}
              className="rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-medium text-stone-500 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-400 dark:hover:bg-stone-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              +{hiddenTagCount}
            </button>
          )}
        </div>
      )}

      {/* Spacer to push footer down */}
      <div className="flex-1" />

      {/* ── Footer: CTAs ── */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
        {isDirectory ? (
          <a
            href={s.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
          >
            <ExternalLink className="h-3 w-3" />
            {fr ? "Voir détails" : "Wè detay"}
          </a>
        ) : (
          <>
            <a
              href={s.officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
            >
              {fr ? "Voir détails" : "Wè detay"}
            </a>
            {s.howToApplyUrl && (
              <a
                href={s.howToApplyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
              >
                {fr ? "Postuler" : "Aplike"}
              </a>
            )}
          </>
        )}
      </div>

      {/* ── Collapsible: Source & verification ── */}
      <details className="mt-2.5">
        <summary className="cursor-pointer list-none text-[11px] font-medium text-stone-400 transition-colors hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300">
          <span className="inline-flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            {fr ? "Source & vérification" : "Sous & verifikasyon"}
            <ChevronDown className="h-3 w-3" />
          </span>
        </summary>
        <div className="mt-2 space-y-2 rounded-lg border border-stone-100 bg-stone-50/70 p-2.5 text-xs dark:border-stone-800 dark:bg-stone-800/40">
          {/* Source links */}
          {s.sources.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {s.sources.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded bg-white px-1.5 py-0.5 text-[10px] text-stone-500 hover:text-blue-700 hover:underline dark:bg-stone-900 dark:text-stone-400 dark:hover:text-blue-300"
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
              className="text-[10px] text-blue-600 hover:underline dark:text-blue-400"
            >
              {fr ? "Source deadline" : "Sous dat limit"}
            </a>
          )}
          {/* Verified / Updated badges */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-stone-400 dark:text-stone-500">
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
