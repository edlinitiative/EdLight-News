"use client";

/**
 * FeaturedBourses — Two-column featured scholarship cards for /bourses.
 *
 * Highlights the top scholarships (closest deadlines with full funding)
 * in a premium editorial card layout with country-themed gradient accents.
 *
 * Mobile-first refinements:
 * - Cards stack full-width on mobile, side-by-side on sm+
 * - Softer shadows, smoother transitions, richer hover states
 * - Typography scales naturally: ~sm~ → sm and up
 */

import type { ContentLanguage, DatasetCountry, AcademicLevel } from "@edlight-news/types";
import { Bookmark } from "lucide-react";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { getDeadlineStatus, formatDeadlineDateShort } from "@/lib/ui/deadlines";

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

const FUNDING_LABELS: Record<string, { fr: string; ht: string }> = {
  full: { fr: "Bourse complète", ht: "Bous konplè" },
  partial: { fr: "Bourse partielle", ht: "Bous pasyèl" },
  stipend: { fr: "Allocation", ht: "Alokasyon" },
  "tuition-only": { fr: "Frais de scolarité", ht: "Frè etid sèlman" },
  unknown: { fr: "À vérifier", ht: "Pou verifye" },
};

const COUNTRY_ICONS: Record<string, string> = {
  US: "🇺🇸", CA: "🇨🇦", FR: "🇫🇷", UK: "🇬🇧", DO: "🇩🇴",
  MX: "🇲🇽", CN: "🇨🇳", RU: "🇷🇺", HT: "🇭🇹", Global: "🌍",
};

const COUNTRY_GRADIENTS: Record<string, string> = {
  US: "from-blue-600/10 to-red-600/5",
  CA: "from-red-600/10 to-white/5",
  FR: "from-blue-600/10 to-red-600/5",
  UK: "from-indigo-600/10 to-red-600/5",
  DO: "from-red-600/10 to-blue-600/5",
  MX: "from-green-600/10 to-red-600/5",
  CN: "from-red-600/10 to-yellow-600/5",
  RU: "from-sky-600/10 to-red-600/5",
  HT: "from-blue-600/10 to-red-600/5",
  Global: "from-amber-600/10 to-emerald-600/5",
};

interface FeaturedBoursesProps {
  scholarships: SerializedScholarship[];
  lang: ContentLanguage;
  savedIds: Set<string>;
  onToggleSave: (id: string) => void;
}

export function FeaturedBourses({
  scholarships,
  lang,
  savedIds,
  onToggleSave,
}: FeaturedBoursesProps) {
  const fr = lang === "fr";

  // Select top featured: prefer full-funding scholarships with upcoming deadlines
  const featured = scholarships
    .filter((s) => s.kind !== "directory")
    .sort((a, b) => {
      // Prioritize full funding
      const fundingOrder: Record<string, number> = { full: 0, partial: 1, stipend: 2, "tuition-only": 3, unknown: 4 };
      const fa = fundingOrder[a.fundingType] ?? 4;
      const fb = fundingOrder[b.fundingType] ?? 4;
      if (fa !== fb) return fa - fb;
      // Then by deadline proximity
      const aISO = a.deadline?.dateISO ?? "9999";
      const bISO = b.deadline?.dateISO ?? "9999";
      return aISO.localeCompare(bISO);
    })
    .slice(0, 2);

  if (featured.length === 0) return null;

  return (
    <section className="space-y-3 sm:space-y-5">
      <header className="flex justify-between items-end">
        <div>
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#3525cd] dark:text-[#c3c0ff]">
            {fr ? "Bourses vérifiées" : "Bous verifye"}
          </span>
          <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tighter text-[#1d1b1a] dark:text-white mt-1 font-display">
            {fr ? "Bourses en vedette" : "Bous an vedèt"}
          </h2>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
        {featured.map((s) => {
          const cl = COUNTRY_LABELS[s.country];
          const flag = COUNTRY_ICONS[s.country] ?? "🌍";
          const fundingLabel = FUNDING_LABELS[s.fundingType];
          const dlStatus = s.deadline?.dateISO ? getDeadlineStatus(s.deadline.dateISO, lang) : null;
          const shortDate = s.deadline?.dateISO ? formatDeadlineDateShort(s.deadline.dateISO, lang) : null;
          const saved = savedIds.has(s.id);

          return (
            <article
              key={s.id}
              className="group relative overflow-hidden rounded-2xl border border-[#c7c4d8]/10 dark:border-stone-700/50 bg-white dark:bg-stone-900 shadow-[0_4px_16px_rgba(29,27,26,0.04)] hover:shadow-[0_12px_32px_rgba(29,27,26,0.08)] dark:shadow-none dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-0.5 flex flex-col"
            >
              {/* Country accent gradient strip at top */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${COUNTRY_GRADIENTS[s.country] ?? COUNTRY_GRADIENTS.Global}`} />

              <div className="p-3.5 sm:p-5 flex flex-col flex-1">
                {/* ── Top row: logo area + urgency badge ── */}
                <div className="flex justify-between items-start mb-2.5 sm:mb-4">
                  <div className="h-8 w-8 sm:h-12 sm:w-12 bg-gradient-to-br from-[#f3eeeb] to-[#e8e1df] dark:from-stone-800 dark:to-stone-700 rounded-xl flex items-center justify-center p-1 sm:p-2 shadow-inner">
                    <span className="text-lg sm:text-2xl select-none" aria-hidden="true">{flag}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {dlStatus && (dlStatus.badgeVariant === "today" || dlStatus.badgeVariant === "urgent") ? (
                      <span className="bg-[#ffdad6] text-[#93000a] text-[10px] font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wide">
                        {dlStatus.badgeLabel}
                      </span>
                    ) : (
                      <span className="bg-[#e8e1df] text-[#464555] text-[10px] font-bold px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase italic tracking-wide dark:bg-stone-700 dark:text-stone-300">
                        {s.fundingType === "full"
                          ? (fr ? "Sélection premier" : "Premye seleksyon")
                          : (fr ? "Candidature ouverte" : "Kandidati ouvèt")}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onToggleSave(s.id)}
                      className={`rounded-lg p-1 sm:p-1.5 transition-colors ${
                        saved
                          ? "text-[#3525cd] dark:text-[#c3c0ff]"
                          : "text-[#c7c4d8] hover:text-[#464555] dark:text-stone-600 dark:hover:text-stone-400"
                      }`}
                      aria-label={saved ? "Remove from saved" : "Save scholarship"}
                    >
                      <Bookmark className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${saved ? "fill-current" : ""}`} />
                    </button>
                  </div>
                </div>

                {/* ── Title ── */}
                <h3 className="text-sm sm:text-lg md:text-xl font-bold leading-tight text-[#1d1b1a] dark:text-white group-hover:text-[#3525cd] dark:group-hover:text-[#c3c0ff] transition-colors font-display line-clamp-2">
                  {s.name}
                </h3>

                {/* ── Country + Level info row ── */}
                {(cl || s.level.length > 0) && (
                  <div className="flex items-center gap-1.5 mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] text-[#474948] dark:text-stone-500">
                    {cl && <span className="font-semibold">{fr ? cl.fr : cl.ht}</span>}
                    {cl && s.level.length > 0 && <span className="text-[#c7c4d8]">·</span>}
                    {s.level.length > 0 && (
                      <span>
                        {s.level.map((l) => {
                          const lbl = LEVEL_LABELS[l];
                          return lbl ? (fr ? lbl.fr : lbl.ht) : l;
                        }).join(" · ")}
                      </span>
                    )}
                  </div>
                )}

                {/* ── Summary ── */}
                {s.eligibilitySummary && (
                  <p className="text-[#464555] dark:text-stone-400 text-[11px] sm:text-sm mt-2 sm:mt-3 leading-relaxed line-clamp-2">
                    {s.eligibilitySummary}
                  </p>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* ── Footer: dashed border + value + CTA ── */}
                <div className="mt-3 sm:mt-5 pt-2.5 sm:pt-4 border-t border-[#f3ecea]/60 dark:border-stone-800 border-dashed flex justify-between items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-bold text-[#474948] dark:text-stone-400 uppercase truncate">
                    {fundingLabel ? (fr ? fundingLabel.fr : fundingLabel.ht) : s.fundingType}
                    {shortDate && ` · ${shortDate}`}
                  </span>
                  <a
                    href={s.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3525cd] dark:text-[#c3c0ff] font-bold text-[10px] sm:text-xs flex items-center gap-1 shrink-0 group/cta hover:gap-2 transition-all"
                  >
                    {fr ? "VOIR DÉTAILS" : "WÈ DETAY"}
                    <span className="material-symbols-outlined text-sm group-hover/cta:translate-x-1 transition-transform duration-200">arrow_forward</span>
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}