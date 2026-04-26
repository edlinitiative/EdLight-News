/**
 * BoursesSidebar — Right sidebar for the /bourses feed section.
 *
 * On mobile (<lg) this appears as a full-width section below the grid.
 * On desktop (lg+) it sits in the right 4 columns as a sticky panel.
 *
 * Contains:
 *   1) How-to-guide card
 *   2) Trending Sectors — tag cloud of popular fields
 *   3) Premium guides
 *   4) Distribution Stats
 */

import type { ContentLanguage } from "@edlight-news/types";
import Link from "next/link";
import type { SerializedScholarship } from "@/components/BoursesFilters";

interface BoursesSidebarProps {
  scholarships: SerializedScholarship[];
  lang: ContentLanguage;
  onTagClick?: (tag: string) => void;
}

/** Extract the most frequent tags from all scholarships */
function getTrendingTags(scholarships: SerializedScholarship[], max = 8): string[] {
  const tagCounts = new Map<string, number>();
  for (const s of scholarships) {
    for (const tag of s.tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([tag]) => tag);
}

export function BoursesSidebar({ scholarships, lang, onTagClick }: BoursesSidebarProps) {
  const fr = lang === "fr";
  const trendingTags = getTrendingTags(scholarships);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ─── How to use this page ─── */}
      <div className="rounded-xl border border-[#c7c4d8]/15 dark:border-stone-700/40 p-4 sm:p-5">
        <h6 className="text-xs font-bold uppercase tracking-widest text-[#1d1b1a] dark:text-white mb-3">
          {fr ? "Comment naviguer" : "Kijan pou navige"}
        </h6>
        <ul className="space-y-2 text-xs leading-relaxed text-[#464555] dark:text-stone-400">
          <li>
            <span className="font-bold text-[#3525cd] dark:text-[#c3c0ff]">·</span>{" "}
            {fr
              ? "Filtrez par Type / Financement directement au-dessus de la liste."
              : "Filtre pa Tip / Finansman dirèkteman sou tèt lis la."}
          </li>
          <li>
            <span className="font-bold text-[#3525cd] dark:text-[#c3c0ff]">·</span>{" "}
            {fr
              ? "Cliquez sur le 🔖 d'une bourse pour la sauvegarder localement."
              : "Klike sou 🔖 yon bous pou anrejistre l."}
          </li>
          <li>
            <span className="font-bold text-[#3525cd] dark:text-[#c3c0ff]">·</span>{" "}
            {fr
              ? "« Affiner la sélection » ouvre les filtres avancés."
              : "« Rafine seleksyon » ouvri filtr avanse yo."}
          </li>
        </ul>
      </div>

      {/* ─── Trending Sectors ─── */}
      {trendingTags.length > 0 && (
        <div className="bg-[#f9f2f0] dark:bg-stone-900/80 p-4 sm:p-6 rounded-xl">
          <h4 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-[#1d1b1a] dark:text-white mb-3 sm:mb-4">
            {fr ? "Secteurs tendance" : "Sektè tandans"}
          </h4>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {trendingTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className="bg-[#e8e1df] text-[#464555] text-[10px] sm:text-[11px] font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full hover:bg-[#3525cd] hover:text-white dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-[#4f46e5] dark:hover:text-white transition-colors cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Premium guides ─── */}
      <div className="rounded-xl border border-[#c7c4d8]/15 dark:border-stone-700/40 p-4 sm:p-5 bg-white dark:bg-stone-900">
        <h6 className="text-xs font-bold uppercase tracking-widest text-[#1d1b1a] dark:text-white mb-3">
          {fr ? "Guides premium" : "Gid premium"}
        </h6>
        <p className="text-xs text-[#474948] dark:text-stone-400 leading-relaxed mb-3">
          {fr
            ? "Playbooks détaillés pour les bourses les plus compétitives (Rhodes, Fulbright, DAAD, Erasmus, Chevening, UWC)."
            : "Gid detaye pou bous ki pi konpetitif yo (Rhodes, Fulbright, DAAD, Erasmus, Chevening, UWC)."}
        </p>

        <div className="space-y-1.5 text-sm">
          <Link href="/bourses/guides" className="block font-semibold text-[#3525cd] dark:text-[#c3c0ff] hover:underline">
            {fr ? "Voir tous les guides" : "Wè tout gid yo"}
          </Link>
          <Link href="/bourses/guides/rhodes-haiti" className="block text-[#474948] dark:text-stone-300 hover:text-[#3525cd] dark:hover:text-[#c3c0ff] transition-colors">
            Rhodes · Oxford
          </Link>
          <Link href="/bourses/guides/fulbright-haiti" className="block text-[#474948] dark:text-stone-300 hover:text-[#3525cd] dark:hover:text-[#c3c0ff] transition-colors">
            Fulbright · USA
          </Link>
          <Link href="/bourses/guides/uwc-haiti" className="block text-[#474948] dark:text-stone-300 hover:text-[#3525cd] dark:hover:text-[#c3c0ff] transition-colors">
            UWC · High School
          </Link>
        </div>
      </div>

      {/* ─── Distribution Stats ─── */}
      <div className="rounded-xl border border-[#c7c4d8]/15 dark:border-stone-700/40 p-4 sm:p-5">
        <h6 className="text-xs font-bold uppercase tracking-widest text-[#474948] dark:text-stone-300 mb-3">
          {fr ? "Répartition" : "Distribisyon"}
        </h6>
        <div className="space-y-3">
          {(() => {
            const countryCounts = new Map<string, number>();
            for (const s of scholarships) {
              countryCounts.set(s.country, (countryCounts.get(s.country) ?? 0) + 1);
            }
            const sorted = Array.from(countryCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5);
            const total = scholarships.length || 1;

            return sorted.map(([country, count]) => (
              <div key={country} className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-xs font-medium text-[#464555] dark:text-stone-300 w-10 sm:w-12 shrink-0">
                  {country === "Global" ? "🌍" : country}
                </span>
                <div className="flex-1 h-1.5 bg-[#e8e1df] dark:bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3525cd] dark:bg-[#c3c0ff] rounded-full transition-all"
                    style={{ width: `${Math.round((count / total) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] sm:text-[11px] tabular-nums font-medium text-[#474948] dark:text-stone-300 w-5 sm:w-6 text-right">
                  {count}
                </span>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
