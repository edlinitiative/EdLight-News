"use client";

/**
 * BoursesFeed — List-style feed of latest scholarship opportunities.
 *
 * Renders scholarships in a compact, editorial feed format with icons,
 * badges, deadlines, and summaries — matching the "Latest Funding Streams"
 * section from the reference design.
 */

import type { ContentLanguage, DatasetCountry, AcademicLevel } from "@edlight-news/types";
import {
  Landmark,
  FlaskConical,
  Globe,
  GraduationCap,
  BookOpen,
  ChevronRight,
  Bookmark,
} from "lucide-react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { getDeadlineStatus, formatDeadlineDateShort, badgeStyle } from "@/lib/ui/deadlines";

const COUNTRY_LABELS: Record<DatasetCountry, { fr: string; ht: string }> = {
  US: { fr: "États-Unis", ht: "Etazini" },
  CA: { fr: "Canada", ht: "Kanada" },
  FR: { fr: "France", ht: "Frans" },
  UK: { fr: "Royaume-Uni", ht: "Wayòm Ini" },
  DO: { fr: "Rép. Dominicaine", ht: "Rep. Dominikèn" },
  MX: { fr: "Mexique", ht: "Meksik" },
  CN: { fr: "Chine", ht: "Lachin" },
  RU: { fr: "Russie", ht: "Larisi" },
  HT: { fr: "Haïti", ht: "Ayiti" },
  Global: { fr: "International", ht: "Entènasyonal" },
};

const LEVEL_LABELS: Record<AcademicLevel, { fr: string; ht: string }> = {
  bachelor: { fr: "Bachelor", ht: "Lisans" },
  master: { fr: "Master", ht: "Metriz" },
  phd: { fr: "PhD", ht: "Doktora" },
  short_programs: { fr: "Courts programmes", ht: "Pwogram kout" },
};

const FUNDING_BADGE_LABELS: Record<string, { fr: string; ht: string }> = {
  full: { fr: "Complet", ht: "Konplè" },
  partial: { fr: "Partiel", ht: "Pasyèl" },
  stipend: { fr: "Allocation", ht: "Alokasyon" },
  "tuition-only": { fr: "Scolarité", ht: "Frè etid" },
  unknown: { fr: "Inconnu", ht: "Enkonni" },
};

/** Pick a thematic icon based on scholarship tags or funding type */
function pickIcon(s: SerializedScholarship) {
  const tags = (s.tags ?? []).join(" ").toLowerCase();
  if (tags.includes("stem") || tags.includes("science") || tags.includes("research"))
    return <FlaskConical className="h-6 w-6 text-brand-600 dark:text-brand-400" />;
  if (tags.includes("policy") || tags.includes("government") || tags.includes("public"))
    return <Landmark className="h-6 w-6 text-brand-600 dark:text-brand-400" />;
  if (s.country === "Global" || tags.includes("international"))
    return <Globe className="h-6 w-6 text-brand-600 dark:text-brand-400" />;
  if (s.level.includes("phd") || s.level.includes("master"))
    return <GraduationCap className="h-6 w-6 text-brand-600 dark:text-brand-400" />;
  return <BookOpen className="h-6 w-6 text-brand-600 dark:text-brand-400" />;
}

interface BoursesFeedProps {
  scholarships: SerializedScholarship[];
  lang: ContentLanguage;
  /** IDs of featured scholarships to exclude from the feed */
  excludeIds?: Set<string>;
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
  maxItems?: number;
}

export function BoursesFeed({
  scholarships,
  lang,
  excludeIds,
  savedIds,
  onToggleSave,
  maxItems = 8,
}: BoursesFeedProps) {
  const fr = lang === "fr";

  // Exclude featured, sort by deadline proximity
  const feedItems = scholarships
    .filter((s) => !excludeIds?.has(s.id))
    .sort((a, b) => {
      const aISO = a.deadline?.dateISO ?? "9999";
      const bISO = b.deadline?.dateISO ?? "9999";
      return aISO.localeCompare(bISO);
    })
    .slice(0, maxItems);

  if (feedItems.length === 0) return null;

  return (
    <div>
      <h4 className="font-serif text-lg sm:text-xl font-bold mb-6 flex items-center gap-3 text-stone-900 dark:text-white">
        <span className="w-2 h-2 bg-brand-600 dark:bg-brand-400 rounded-full" />
        {fr ? "Dernières opportunités" : "Dènye opòtinite yo"}
      </h4>

      <div className="space-y-0">
        {feedItems.map((s) => {
          const cl = COUNTRY_LABELS[s.country];
          const dlStatus = s.deadline?.dateISO ? getDeadlineStatus(s.deadline.dateISO, lang) : null;
          const shortDate = s.deadline?.dateISO ? formatDeadlineDateShort(s.deadline.dateISO, lang) : null;
          const funding = FUNDING_BADGE_LABELS[s.fundingType];
          const levelStr = s.level
            .map((l) => {
              const lbl = LEVEL_LABELS[l];
              return lbl ? (fr ? lbl.fr : lbl.ht) : l;
            })
            .join(", ");
          const saved = savedIds.has(s.id);

          return (
            <div
              key={s.id}
              id={`scholarship-${s.id}`}
              className="py-6 border-b border-stone-200/40 dark:border-stone-700/40 flex flex-col sm:flex-row gap-4 hover:bg-stone-50/50 dark:hover:bg-stone-900/50 transition-colors group -mx-3 px-3 rounded-lg"
            >
              {/* Icon */}
              <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-xl flex-shrink-0 flex items-center justify-center">
                {pickIcon(s)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-2 mb-1.5">
                  {funding && (
                    <span className="bg-stone-200/60 dark:bg-stone-700/60 px-2 py-0.5 rounded text-[10px] font-bold uppercase text-stone-600 dark:text-stone-300">
                      {fr ? funding.fr : funding.ht}
                    </span>
                  )}
                  {levelStr && (
                    <span className="text-[10px] font-bold uppercase text-stone-400 dark:text-stone-500 tracking-wider">
                      {levelStr}
                    </span>
                  )}
                  <span className="text-[10px] font-bold uppercase text-stone-400 dark:text-stone-500 tracking-wider">
                    {cl ? (fr ? cl.fr : cl.ht) : s.country}
                  </span>
                </div>

                <h5 className="text-base font-bold mb-1.5 text-stone-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors cursor-pointer leading-snug">
                  <a href={s.officialUrl} target="_blank" rel="noopener noreferrer">
                    {s.name}
                  </a>
                </h5>

                {s.eligibilitySummary && (
                  <p className="text-sm text-stone-500 dark:text-stone-400 font-light line-clamp-2 leading-relaxed">
                    {s.eligibilitySummary}
                  </p>
                )}
              </div>

              {/* Right: deadline + actions */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-between shrink-0 gap-2">
                {shortDate ? (
                  <span
                    className={`text-xs font-bold ${
                      dlStatus && (dlStatus.badgeVariant === "today" || dlStatus.badgeVariant === "urgent")
                        ? "text-red-600 dark:text-red-400"
                        : "text-stone-600 dark:text-stone-400"
                    }`}
                  >
                    {fr ? "Deadline:" : "Dat limit:"} {shortDate}
                  </span>
                ) : (
                  <span className="text-xs text-stone-400 dark:text-stone-500">
                    {fr ? "Date à confirmer" : "Dat pou konfime"}
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleSave(s.id)}
                    className={`rounded-lg p-1.5 transition-colors ${
                      saved
                        ? "text-brand-600 dark:text-brand-400"
                        : "text-stone-300 dark:text-stone-600 hover:text-stone-500"
                    }`}
                    aria-label={saved ? "Remove from saved" : "Save"}
                  >
                    <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
                  </button>
                  <ChevronRight className="h-4 w-4 text-stone-300 dark:text-stone-600 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
