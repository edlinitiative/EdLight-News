/**
 * BoursesSidebar — Right sidebar for the /bourses feed section.
 *
 * Contains:
 *   1) Curator's Insight — editorial quote/advice card
 *   2) Trending Sectors — tag cloud of popular fields
 */

import type { ContentLanguage } from "@edlight-news/types";
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
    <div className="space-y-8">
      {/* ─── Curator's Insight — editorial quote ─── */}
      <div className="py-6 border-l-4 border-[#316bf3] dark:border-[#c3c0ff] pl-6">
        <blockquote className="text-xl font-bold italic leading-relaxed text-[#1d1b1a] dark:text-white font-display">
          {fr
            ? "« Le virage vers les financements STEM spécifiques dans le G7 atteint une masse critique. Les candidats ayant des intersections climat-politique voient un taux de succès 40% plus élevé. »"
            : "« Vire vè finansman STEM espesifik nan G7 la ap rive nan yon mas kritik. Kandida ki gen entèseksyon klima-politik wè yon to siksè 40% pi wo. »"}
        </blockquote>
        <cite className="block mt-4 text-xs font-bold uppercase tracking-widest text-[#0051d5] dark:text-[#b4c5ff]">
          — {fr ? "Analyse Éditoriale" : "Analiz Editoryal"}
        </cite>
      </div>

      {/* ─── Trending Sectors ─── */}
      {trendingTags.length > 0 && (
        <div className="bg-[#f9f2f0] dark:bg-stone-900/80 p-6 rounded-xl">
          <h4 className="text-sm font-bold uppercase tracking-widest text-[#1d1b1a] dark:text-white mb-4">
            {fr ? "Secteurs tendance" : "Sektè tandans"}
          </h4>
          <div className="flex flex-wrap gap-2">
            {trendingTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className="bg-[#e8e1df] text-[#464555] text-[11px] font-semibold px-4 py-2 rounded-full hover:bg-[#3525cd] hover:text-white dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-[#4f46e5] dark:hover:text-white transition-colors cursor-pointer"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Distribution Stats ─── */}
      <div className="rounded-xl border border-[#c7c4d8]/15 dark:border-stone-700/40 p-5">
        <h6 className="text-xs font-bold uppercase tracking-widest text-[#474948] dark:text-stone-500 mb-3">
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
                <span className="text-xs font-medium text-[#464555] dark:text-stone-300 w-12 shrink-0">
                  {country === "Global" ? "🌍" : country}
                </span>
                <div className="flex-1 h-1.5 bg-[#e8e1df] dark:bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3525cd] dark:bg-[#c3c0ff] rounded-full transition-all"
                    style={{ width: `${Math.round((count / total) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums font-medium text-[#474948] dark:text-stone-400 w-6 text-right">
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
