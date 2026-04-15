"use client";

/**
 * FeaturedBourses — Two-column featured scholarship cards for /bourses.
 *
 * Highlights the top scholarships (closest deadlines with full funding)
 * in a premium editorial card layout with country-themed gradient accents.
 */

import type { ContentLanguage, DatasetCountry, AcademicLevel } from "@edlight-news/types";
import { ArrowUpRight, ChevronLeft, ChevronRight, CalendarDays, Bookmark } from "lucide-react";
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
      <div className="flex justify-between items-baseline">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 dark:text-white">
          {fr ? "Bourses en vedette" : "Bous an vedèt"}
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="w-9 h-9 rounded-full border border-stone-200 dark:border-stone-700 flex items-center justify-center hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-stone-500 dark:text-stone-400"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="w-9 h-9 rounded-full border border-stone-200 dark:border-stone-700 flex items-center justify-center hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors text-stone-500 dark:text-stone-400"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-10">
        {featured.map((s) => {
          const cl = COUNTRY_LABELS[s.country];
          const flag = COUNTRY_ICONS[s.country] ?? "🌍";
          const grad = COUNTRY_GRADIENTS[s.country] ?? COUNTRY_GRADIENTS.Global;
          const fundingLabel = FUNDING_LABELS[s.fundingType];
          const dlStatus = s.deadline?.dateISO ? getDeadlineStatus(s.deadline.dateISO, lang) : null;
          const shortDate = s.deadline?.dateISO ? formatDeadlineDateShort(s.deadline.dateISO, lang) : null;
          const saved = savedIds.has(s.id);

          return (
            <article key={s.id} className="group">
              {/* ── Decorative gradient header ── */}
              <div className={`relative aspect-[16/10] overflow-hidden rounded-xl mb-5 bg-gradient-to-br ${grad} dark:opacity-80 flex items-center justify-center`}>
                <span
                  className="text-[8rem] leading-none opacity-20 select-none transition-transform duration-500 group-hover:scale-110"
                  aria-hidden="true"
                >
                  {flag}
                </span>

                {/* Badge */}
                <div className="absolute top-4 left-4">
                  <span className="bg-brand-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {s.fundingType === "full"
                      ? (fr ? "Sélection premier" : "Premye seleksyon")
                      : (fr ? "Recommandée" : "Rekòmande")}
                  </span>
                </div>

                {/* Bookmark */}
                <button
                  type="button"
                  onClick={() => onToggleSave(s.id)}
                  className={`absolute top-4 right-4 rounded-full p-2 transition-colors backdrop-blur-sm ${
                    saved
                      ? "bg-brand-600/20 text-brand-600 dark:text-brand-400"
                      : "bg-white/40 dark:bg-stone-900/40 text-stone-500 hover:text-stone-700 dark:text-stone-400"
                  }`}
                  aria-label={saved ? "Remove from saved" : "Save scholarship"}
                >
                  <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
                </button>
              </div>

              {/* ── Meta row ── */}
              <div className="flex flex-wrap gap-3 mb-3">
                <span className="text-[11px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest">
                  {cl ? (fr ? cl.fr : cl.ht) : s.country}
                </span>
                {shortDate && (
                  <span className="text-[11px] font-medium text-stone-500 dark:text-stone-400 flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {fr ? "Deadline:" : "Dat limit:"} {shortDate}
                  </span>
                )}
                {dlStatus && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeStyle(dlStatus.badgeVariant)}`}>
                    {dlStatus.badgeLabel}
                  </span>
                )}
              </div>

              {/* ── Title ── */}
              <h3 className="font-serif text-xl sm:text-2xl font-bold mb-3 text-stone-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors cursor-pointer leading-tight">
                {s.name}
              </h3>

              {/* ── Summary ── */}
              {s.eligibilitySummary && (
                <p className="text-stone-500 dark:text-stone-400 leading-relaxed mb-5 font-light text-sm line-clamp-2">
                  {s.eligibilitySummary}
                </p>
              )}

              {/* ── Levels ── */}
              {s.level.length > 0 && (
                <p className="text-xs text-stone-400 dark:text-stone-500 mb-5">
                  {s.level.map((l) => {
                    const lbl = LEVEL_LABELS[l];
                    return lbl ? (fr ? lbl.fr : lbl.ht) : l;
                  }).join(" · ")}
                </p>
              )}

              {/* ── Footer ── */}
              <div className="flex items-center justify-between border-t border-stone-200/60 dark:border-stone-700/40 pt-5">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase text-stone-400 dark:text-stone-500 font-bold tracking-wider">
                    {fr ? "Financement" : "Finansman"}
                  </span>
                  <span className="font-bold text-stone-900 dark:text-white text-sm">
                    {fundingLabel ? (fr ? fundingLabel.fr : fundingLabel.ht) : s.fundingType}
                  </span>
                </div>
                <a
                  href={s.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 dark:text-brand-400 font-bold text-sm hover:underline inline-flex items-center gap-1"
                >
                  {fr ? "Voir détails" : "Wè detay"}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
