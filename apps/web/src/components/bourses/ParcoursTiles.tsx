"use client";

/**
 * ParcoursTiles — "Choose your path" entry-point tiles for /bourses.
 * Each tile applies preset filters by updating URL search params
 * (reusing the existing URL-driven filter mechanism).
 */

import { useRouter } from "next/navigation";
import type { ContentLanguage } from "@edlight-news/types";

interface PathTile {
  code: string;
  flag: string;
  params: Record<string, string>;
  label: { fr: string; ht: string };
  description: { fr: string; ht: string };
}

const PATHS: PathTile[] = [
  {
    code: "CA",
    flag: "🇨🇦",
    params: { country: "CA" },
    label: { fr: "Étudier au Canada", ht: "Etidye Kanada" },
    description: {
      fr: "Aides d'entrée, exemptions et programmes fédéraux.",
      ht: "Èd pou antre, egzanpsyon ak pwogram federal.",
    },
  },
  {
    code: "FR",
    flag: "🇫🇷",
    params: { country: "FR" },
    label: { fr: "Étudier en France", ht: "Etidye Lafrans" },
    description: {
      fr: "Eiffel, Campus France et bourses universitaires.",
      ht: "Eiffel, Campus France ak bous inivèsite.",
    },
  },
  {
    code: "UK",
    flag: "🇬🇧",
    params: { country: "UK" },
    label: { fr: "Étudier au Royaume-Uni", ht: "Etidye Wayòm Ini" },
    description: {
      fr: "Chevening, GREAT et bourses de mérite.",
      ht: "Chevening, GREAT ak bous merite.",
    },
  },
  {
    code: "Global",
    flag: "🌍",
    params: { country: "Global" },
    label: { fr: "Programmes internationaux", ht: "Pwogram entènasyonal" },
    description: {
      fr: "Bourses sans restriction géographique.",
      ht: "Bous san restriksyon jewografik.",
    },
  },
];

interface ParcoursTilesProps {
  lang: ContentLanguage;
}

export function ParcoursTiles({ lang }: ParcoursTilesProps) {
  const fr = lang === "fr";
  const router = useRouter();

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(params);
    if (lang !== "fr") sp.set("lang", lang);
    router.push(`/bourses?${sp.toString()}`, { scroll: false });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-widest text-[#1d1b1a] dark:text-stone-200">
        {fr ? "Parcours" : "Pakou"}
      </h2>
      <p className="text-sm text-[#474948] dark:text-stone-400">
        {fr
          ? "Choisissez une destination pour filtrer automatiquement les bourses."
          : "Chwazi yon destinasyon pou filtre bous yo otomatikman."}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PATHS.map((tile) => (
          <button
            key={tile.code}
            type="button"
            onClick={() => navigate(tile.params)}
            className="group flex flex-col items-start rounded-xl border border-[#c7c4d8]/15 dark:border-stone-700/40 bg-white dark:bg-stone-900/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(29,27,26,0.05)] hover:border-[#3525cd]/20"
          >
            <span className="text-2xl">{tile.flag}</span>
            <h3 className="mt-2 text-sm font-bold font-display text-[#1d1b1a] dark:text-white">
              {fr ? tile.label.fr : tile.label.ht}
            </h3>
            <p className="mt-1 flex-1 text-xs text-[#474948] dark:text-stone-400">
              {fr ? tile.description.fr : tile.description.ht}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#3525cd] transition-all group-hover:gap-2 dark:text-[#c3c0ff]">
              {fr ? "Explorer" : "Eksplore"}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
