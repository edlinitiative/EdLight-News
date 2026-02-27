"use client";

/**
 * ParcoursTiles — "Choose your path" entry-point tiles for /bourses.
 * Each tile applies preset filters by updating URL search params
 * (reusing the existing URL-driven filter mechanism).
 */

import { useRouter } from "next/navigation";
import type { ContentLanguage } from "@edlight-news/types";
import { ArrowRight, Globe, MapPin } from "lucide-react";

interface PathTile {
  code: string;
  flag: string;
  params: Record<string, string>;
  label: { fr: string; ht: string };
  description: { fr: string; ht: string };
  color: string;
  darkColor: string;
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
    color: "bg-red-50 border-red-200 hover:bg-red-100/80",
    darkColor: "dark:bg-red-950/15 dark:border-red-800/30 dark:hover:bg-red-950/25",
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
    color: "bg-blue-50 border-blue-200 hover:bg-blue-100/80",
    darkColor: "dark:bg-blue-950/15 dark:border-blue-800/30 dark:hover:bg-blue-950/25",
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
    color: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100/80",
    darkColor: "dark:bg-indigo-950/15 dark:border-indigo-800/30 dark:hover:bg-indigo-950/25",
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
    color: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/80",
    darkColor: "dark:bg-emerald-950/15 dark:border-emerald-800/30 dark:hover:bg-emerald-950/25",
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
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-emerald-500" />
        <h2 className="text-sm font-bold uppercase tracking-widest text-stone-800 dark:text-stone-200">
          {fr ? "Parcours" : "Pakou"}
        </h2>
      </div>
      <p className="text-sm text-stone-500 dark:text-stone-400">
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
            className={`group flex flex-col items-start rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${tile.color} ${tile.darkColor}`}
          >
            <span className="text-2xl">{tile.flag}</span>
            <h3 className="mt-2 text-sm font-semibold text-stone-900 dark:text-white">
              {fr ? tile.label.fr : tile.label.ht}
            </h3>
            <p className="mt-1 flex-1 text-xs text-stone-500 dark:text-stone-400">
              {fr ? tile.description.fr : tile.description.ht}
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 transition-all group-hover:gap-2 dark:text-blue-400">
              {fr ? "Explorer" : "Eksplore"}
              <ArrowRight className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
