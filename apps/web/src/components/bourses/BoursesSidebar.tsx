/**
 * BoursesSidebar — Right sidebar for the /bourses feed section.
 *
 * Contains:
 *   1) Curator's Insight — editorial quote/advice card
 *   2) Trending Sectors — tag cloud of popular fields
 */

import type { ContentLanguage } from "@edlight-news/types";
import { ArrowRight, TrendingUp } from "lucide-react";
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
    <div className="space-y-10">
      {/* ─── Curator's Insight ─── */}
      <div className="bg-stone-50 dark:bg-stone-900/80 p-6 sm:p-7 rounded-2xl border border-stone-200/60 dark:border-stone-700/40 shadow-soft">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-brand-600 dark:text-brand-400" />
          </div>
          <div>
            <h6 className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
              {fr ? "Analyse éditoriale" : "Analiz editoryal"}
            </h6>
            <p className="text-[10px] text-stone-400 dark:text-stone-500">
              {fr ? "Intelligence curatée" : "Entèlijans kirye"}
            </p>
          </div>
        </div>

        <div className="border-l-4 border-brand-600 dark:border-brand-400 pl-4 mb-5">
          <p className="text-base sm:text-lg font-serif font-medium leading-snug text-stone-800 dark:text-stone-200">
            {fr
              ? "« Le virage vers les financements STEM spécifiques dans le G7 atteint une masse critique. Les candidats ayant des intersections climat-politique voient un taux de succès 40% plus élevé. »"
              : "« Vire vè finansman STEM espesifik nan G7 la ap rive nan yon mas kritik. Kandida ki gen entèseksyon klima-politik wè yon to siksè 40% pi wo. »"}
          </p>
        </div>

        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed mb-5 font-light">
          {fr
            ? "Les candidatures pour le cycle 2025/26 ouvrent plus tôt que les données historiques. Nous recommandons de préparer votre « CV narratif » au moins quatre mois avant les deadlines traditionnels."
            : "Kandidati pou sik 2025/26 ap louvri pi bonè pase done istorik yo. Nou rekòmande prepare « CV naratif » ou omwen kat mwa anvan dat limit tradisyonèl yo."}
        </p>

        <a
          href={fr ? "/bourses?sort=deadline" : "/bourses?sort=deadline&lang=ht"}
          className="text-xs font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1 group/link"
        >
          {fr ? "Lire l'analyse complète" : "Li analiz konplè a"}
          <ArrowRight className="h-3 w-3 group-hover/link:translate-x-1 transition-transform" />
        </a>
      </div>

      {/* ─── Trending Sectors ─── */}
      {trendingTags.length > 0 && (
        <div>
          <h6 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-4">
            {fr ? "Secteurs tendance" : "Sektè tandans"}
          </h6>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className="px-3.5 py-2 bg-stone-200/60 dark:bg-stone-800/60 rounded-full text-[11px] font-medium text-stone-700 dark:text-stone-300 hover:bg-brand-600 hover:text-white dark:hover:bg-brand-500 dark:hover:text-white transition-colors cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Quick Stats ─── */}
      <div className="rounded-2xl border border-stone-200/60 dark:border-stone-700/40 p-5">
        <h6 className="text-xs font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
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
              <div key={country} className="flex items-center gap-3">
                <span className="text-xs font-medium text-stone-600 dark:text-stone-300 w-12 shrink-0">
                  {country === "Global" ? "🌍" : country}
                </span>
                <div className="flex-1 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 dark:bg-brand-400 rounded-full transition-all"
                    style={{ width: `${Math.round((count / total) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums font-medium text-stone-500 dark:text-stone-400 w-6 text-right">
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
