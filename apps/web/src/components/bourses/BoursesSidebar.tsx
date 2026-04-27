/**
 * BoursesSidebar — Right sidebar for the /bourses feed section.
 *
 * On mobile (<lg) this collapses key sections into expandable accordions
 * to save vertical space. On desktop (lg+) it sits in the right 4 columns
 * as a sticky panel with all content visible.
 *
 * Contains:
 *   1) How-to-guide card (collapsible on mobile)
 *   2) Trending Sectors — tag cloud (collapsible on mobile)
 *   3) Premium guides (collapsible on mobile)
 *   4) Distribution Stats (collapsible on mobile)
 */

"use client";

import type { ContentLanguage } from "@edlight-news/types";
import Link from "next/link";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

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

/** Collapsible section wrapper used on mobile; always open on desktop */
function SidebarSection({
  title,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  badge?: string | number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-[#c7c4d8]/10 dark:border-stone-700/40 bg-white dark:bg-stone-900/90 p-3.5 sm:p-5 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 lg:cursor-default"
      >
        <h6 className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#1d1b1a] dark:text-white flex items-center gap-2">
          {title}
          {badge !== undefined && (
            <span className="inline-flex items-center justify-center rounded-full bg-[#3525cd]/10 dark:bg-[#c3c0ff]/15 px-2 py-0.5 text-[10px] font-extrabold text-[#3525cd] dark:text-[#c3c0ff]">
              {badge}
            </span>
          )}
        </h6>
        <ChevronDown
          className={`h-4 w-4 text-[#c7c4d8] dark:text-stone-500 transition-transform duration-200 lg:hidden ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "mt-3 sm:mt-4 max-h-[600px] opacity-100" : "mt-0 max-h-0 opacity-0"
        } lg:mt-3 lg:max-h-none lg:opacity-100 lg:overflow-visible`}
      >
        {children}
      </div>
    </div>
  );
}

export function BoursesSidebar({ scholarships, lang, onTagClick }: BoursesSidebarProps) {
  const fr = lang === "fr";
  const trendingTags = getTrendingTags(scholarships);

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* ─── How to use this page ─── */}
      <SidebarSection title={fr ? "Comment naviguer" : "Kijan pou navige"}>
        <ul className="space-y-2 text-xs leading-relaxed text-[#464555] dark:text-stone-400">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#3525cd]/10 text-[11px] font-bold text-[#3525cd] dark:bg-[#c3c0ff]/15 dark:text-[#c3c0ff]">1</span>
            <span>
              {fr
                ? "Filtrez par Type / Financement directement au-dessus de la liste."
                : "Filtre pa Tip / Finansman dirèkteman sou tèt lis la."}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#3525cd]/10 text-[11px] font-bold text-[#3525cd] dark:bg-[#c3c0ff]/15 dark:text-[#c3c0ff]">2</span>
            <span>
              {fr
                ? "Cliquez sur le 🔖 d'une bourse pour la sauvegarder localement."
                : "Klike sou 🔖 yon bous pou anrejistre l."}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#3525cd]/10 text-[11px] font-bold text-[#3525cd] dark:bg-[#c3c0ff]/15 dark:text-[#c3c0ff]">3</span>
            <span>
              {fr
                ? "« Affiner la sélection » ouvre les filtres avancés."
                : "« Rafine seleksyon » ouvri filtr avanse yo."}
            </span>
          </li>
        </ul>
      </SidebarSection>

      {/* ─── Trending Sectors ─── */}
      {trendingTags.length > 0 && (
        <SidebarSection
          title={fr ? "Secteurs tendance" : "Sektè tandans"}
          badge={trendingTags.length}
        >
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {trendingTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick?.(tag)}
                className="bg-[#f3eeeb] dark:bg-stone-800 text-[#464555] dark:text-stone-300 text-[10px] sm:text-[11px] font-semibold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full hover:bg-[#3525cd] hover:text-white dark:hover:bg-[#4f46e5] dark:hover:text-white transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
              >
                {tag}
              </button>
            ))}
          </div>
        </SidebarSection>
      )}

      {/* ─── Premium guides ─── */}
      <SidebarSection title={fr ? "Guides premium" : "Gid premium"}>
        <p className="text-xs text-[#474948] dark:text-stone-400 leading-relaxed mb-3">
          {fr
            ? "Playbooks détaillés pour les bourses les plus compétitives (Rhodes, Fulbright, DAAD, Erasmus, Chevening, UWC)."
            : "Gid detaye pou bous ki pi konpetitif yo (Rhodes, Fulbright, DAAD, Erasmus, Chevening, UWC)."}
        </p>

        <div className="space-y-1.5 text-sm">
          <Link
            href="/bourses/guides"
            className="inline-flex items-center gap-1 font-semibold text-[#3525cd] dark:text-[#c3c0ff] hover:underline"
          >
            {fr ? "Voir tous les guides" : "Wè tout gid yo"}
            <span className="text-xs">→</span>
          </Link>
          <div className="mt-2 grid grid-cols-1 gap-1">
            <Link
              href="/bourses/guides/rhodes-haiti"
              className="block rounded-lg px-3 py-2 text-xs font-medium text-[#474948] dark:text-stone-300 hover:bg-[#f3eeeb] dark:hover:bg-stone-800 hover:text-[#3525cd] dark:hover:text-[#c3c0ff] transition-colors"
            >
              <span className="font-bold">Rhodes</span> · Oxford
            </Link>
            <Link
              href="/bourses/guides/fulbright-haiti"
              className="block rounded-lg px-3 py-2 text-xs font-medium text-[#474948] dark:text-stone-300 hover:bg-[#f3eeeb] dark:hover:bg-stone-800 hover:text-[#3525cd] dark:hover:text-[#c3c0ff] transition-colors"
            >
              <span className="font-bold">Fulbright</span> · USA
            </Link>
            <Link
              href="/bourses/guides/uwc-haiti"
              className="block rounded-lg px-3 py-2 text-xs font-medium text-[#474948] dark:text-stone-300 hover:bg-[#f3eeeb] dark:hover:bg-stone-800 hover:text-[#3525cd] dark:hover:text-[#c3c0ff] transition-colors"
            >
              <span className="font-bold">UWC</span> · High School
            </Link>
          </div>
        </div>
      </SidebarSection>

      {/* ─── Distribution Stats ─── */}
      <SidebarSection title={fr ? "Répartition" : "Distribisyon"}>
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
                <span className="text-[10px] sm:text-xs font-semibold text-[#464555] dark:text-stone-300 w-10 sm:w-12 shrink-0">
                  {country === "Global" ? "🌍" : country}
                </span>
                <div className="flex-1 h-1.5 sm:h-2 bg-[#e8e1df] dark:bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#3525cd] to-[#4f46e5] dark:from-[#c3c0ff] dark:to-[#a5a0ff] rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((count / total) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] sm:text-[11px] tabular-nums font-bold text-[#474948] dark:text-stone-300 w-5 sm:w-6 text-right">
                  {count}
                </span>
              </div>
            ));
          })()}
        </div>
      </SidebarSection>
    </div>
  );
}