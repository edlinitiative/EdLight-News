"use client";

/**
 * FeaturedBourses — Two-column featured scholarship cards for /bourses.
 *
 * Highlights the top scholarships (closest deadlines with full funding)
 * in a premium editorial card layout with country-themed gradient accents.
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
    <section className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#0051d5] dark:text-[#b4c5ff]">{fr ? "Bourses vérifiées" : "Bous verifye"}</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tighter text-[#1d1b1a] dark:text-white mt-2 font-display">
            {fr ? "Bourses en vedette" : "Bous an vedèt"}
          </h2>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {featured.map((s) => {
          const cl = COUNTRY_LABELS[s.country];
          const flag = COUNTRY_ICONS[s.country] ?? "🌍";
          const fundingLabel = FUNDING_LABELS[s.fundingType];
          const dlStatus = s.deadline?.dateISO ? getDeadlineStatus(s.deadline.dateISO, lang) : null;
          const shortDate = s.deadline?.dateISO ? formatDeadlineDateShort(s.deadline.dateISO, lang) : null;
          const saved = savedIds.has(s.id);

          return (
            <article key={s.id} className="bg-white dark:bg-stone-900 rounded-xl p-4 sm:p-6 shadow-[0_20px_40px_rgba(29,27,26,0.05)] flex flex-col group border border-[#c7c4d8]/15 dark:border-stone-700 transition-transform hover:-translate-y-1">
              {/* ── Top row: logo area + urgency badge ── */}
              <div className="flex justify-between items-start mb-4 sm:mb-6">
                <div className="h-12 w-12 sm:h-14 sm:w-14 bg-[#f9f2f0] dark:bg-stone-800 rounded-lg flex items-center justify-center p-2">
                  <span className="text-2xl sm:text-3xl select-none" aria-hidden="true">{flag}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {dlStatus && (dlStatus.badgeVariant === "today" || dlStatus.badgeVariant === "urgent") ? (
                    <span className="bg-[#ffdad6] text-[#93000a] text-[10px] font-bold px-3 py-1 rounded-full uppercase">
                      {dlStatus.badgeLabel}
                    </span>
                  ) : (
                    <span className="bg-[#e8e1df] text-[#464555] text-[10px] font-bold px-3 py-1 rounded-full uppercase italic dark:bg-stone-700 dark:text-stone-300">
                      {s.fundingType === "full"
                        ? (fr ? "Sélection premier" : "Premye seleksyon")
                        : (fr ? "Candidature ouverte" : "Kandidati ouvèt")}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleSave(s.id)}
                    className={`rounded-lg p-1.5 transition-colors ${
                      saved
                        ? "text-[#3525cd] dark:text-[#c3c0ff]"
                        : "text-[#c7c4d8] hover:text-[#464555] dark:text-stone-600 dark:hover:text-stone-400"
                    }`}
                    aria-label={saved ? "Remove from saved" : "Save scholarship"}
                  >
                    <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
                  </button>
                </div>
              </div>

              {/* ── Title ── */}
              <h3 className="text-lg sm:text-xl font-bold leading-tight text-[#1d1b1a] dark:text-white group-hover:text-[#3525cd] dark:group-hover:text-[#c3c0ff] transition-colors font-display">
                {s.name}
              </h3>

              {/* ── Summary ── */}
              {s.eligibilitySummary && (
                <p className="text-[#464555] dark:text-stone-400 text-sm mt-3 leading-relaxed line-clamp-2">
                  {s.eligibilitySummary}
                </p>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* ── Footer: dashed border + value + CTA ── */}
              <div className="mt-5 sm:mt-8 pt-4 sm:pt-6 border-t border-[#f3ecea] border-dashed dark:border-stone-800 flex justify-between items-center">
                <span className="text-xs font-bold text-[#474948] dark:text-stone-400 uppercase">
                  {fundingLabel ? (fr ? fundingLabel.fr : fundingLabel.ht) : s.fundingType}
                  {shortDate && ` · ${shortDate}`}
                </span>
                <a
                  href={s.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#3525cd] dark:text-[#c3c0ff] font-bold text-xs flex items-center gap-1 group/cta"
                >
                  {fr ? "VOIR DÉTAILS" : "WÈ DETAY"}
                  <span className="material-symbols-outlined text-sm group-hover/cta:translate-x-1 transition-transform">arrow_forward</span>
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
