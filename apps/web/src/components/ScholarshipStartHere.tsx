"use client";

/**
 * ScholarshipStartHere — Orientation block for /bourses.
 *
 * Shows 3 curated country entry-point cards. Clicking a card navigates
 * to /bourses?country=XX (optionally with extra filters), which the
 * URL-driven BoursesFilters component picks up automatically.
 */

import { useRouter } from "next/navigation";
import type { ContentLanguage } from "@edlight-news/types";
import { ArrowRight } from "lucide-react";

interface EntryCard {
  flag: string;
  country: string;
  /** Query params to push when clicked */
  params: Record<string, string>;
  label: { fr: string; ht: string };
  description: { fr: string; ht: string };
  cta: { fr: string; ht: string };
}

const ENTRIES: EntryCard[] = [
  {
    flag: "🇨🇦",
    country: "Canada",
    params: { country: "CA" },
    label: {
      fr: "Bourses et aides universitaires",
      ht: "Bous ak èd inivèsite",
    },
    description: {
      fr: "Aides d'entrée, exemptions, et programmes fédéraux.",
      ht: "Èd pou antre, egzanpsyon, ak pwogram federal.",
    },
    cta: { fr: "Explorer le Canada", ht: "Eksplore Kanada" },
  },
  {
    flag: "🇫🇷",
    country: "France",
    params: { country: "FR" },
    label: {
      fr: "Programmes + Campus France",
      ht: "Pwogram + Campus France",
    },
    description: {
      fr: "Eiffel, aides universitaires, et répertoires officiels.",
      ht: "Eiffel, èd inivèsite, ak repètwa ofisyèl.",
    },
    cta: { fr: "Explorer la France", ht: "Eksplore Lafrans" },
  },
  {
    flag: "🇬🇧",
    country: "Royaume-Uni",
    params: { country: "UK" },
    label: {
      fr: "Financement complet et partiel",
      ht: "Finansman konplè ak pasyèl",
    },
    description: {
      fr: "Chevening, GREAT, et bourses universitaires.",
      ht: "Chevening, GREAT, ak bous inivèsite.",
    },
    cta: { fr: "Explorer le Royaume-Uni", ht: "Eksplore Wayòm Ini" },
  },
];

interface ScholarshipStartHereProps {
  lang: ContentLanguage;
}

export function ScholarshipStartHere({ lang }: ScholarshipStartHereProps) {
  const fr = lang === "fr";
  const router = useRouter();

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(params);
    if (lang !== "fr") sp.set("lang", lang);
    router.push(`/bourses?${sp.toString()}`);
  }

  return (
    <section className="section-shell space-y-4">
      <div className="relative z-10">
        <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          {fr ? "Par où commencer ?" : "Ki kote pou kòmanse ?"}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
          {fr
            ? "Trois portes d'entrée pour financer vos études."
            : "Twa pòt antre pou finanse etid ou yo."}
        </p>
      </div>

      <div className="relative z-10 grid gap-4 sm:grid-cols-3">
        {ENTRIES.map((entry) => (
          <button
            key={entry.country}
            type="button"
            onClick={() => navigate(entry.params)}
            className="premium-card group flex flex-col items-start p-5 text-left"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-2xl leading-none dark:bg-brand-900/20">
              {entry.flag}
            </span>

            <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
              {fr ? entry.label.fr : entry.label.ht}
            </h3>

            <p className="mt-1 flex-1 text-xs text-gray-500 dark:text-slate-400">
              {fr ? entry.description.fr : entry.description.ht}
            </p>

            <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 transition group-hover:gap-2">
              {fr ? entry.cta.fr : entry.cta.ht}
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
