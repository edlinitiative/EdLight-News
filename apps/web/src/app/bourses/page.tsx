/**
 * /bourses — Scholarship database page.
 *
 * Server component: fetches all scholarships eligible for Haitian students,
 * serialises them, and delegates filtering/rendering to BoursesFilters (client).
 *
 * When no filter search-params are active the page shows a "Start Here"
 * orientation block with curated country entry cards.
 */

import type { Metadata } from "next";
import type { ContentLanguage, Scholarship } from "@edlight-news/types";
import { Suspense } from "react";
import { GraduationCap, Clock, Filter, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getLangFromSearchParams } from "@/lib/content";
import {
  fetchScholarshipsForHaiti,
  fetchScholarshipsClosingSoon,
} from "@/lib/datasets";
import { BoursesFilters, type SerializedScholarship } from "@/components/BoursesFilters";
import { ScholarshipStartHere } from "@/components/ScholarshipStartHere";
import { FILTER_PARAM_KEYS } from "@/lib/scholarship-params";
import { tsToISO as sharedTsToISO, formatDateLocalized } from "@/lib/dates";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Bourses & Opportunités · EdLight News" : "Bous & Opòtinite · EdLight News";
  const description = fr
    ? "Base de données de bourses et opportunités pour étudiants haïtiens."
    : "Baz done bous ak opòtinite pou elèv ayisyen yo.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/bourses", lang }),
  };
}

// tsToISO imported from @/lib/dates
const tsToISO = sharedTsToISO;

function serializeScholarship(s: Scholarship): SerializedScholarship {
  return {
    id: s.id,
    name: s.name,
    country: s.country,
    eligibleCountries: s.eligibleCountries,
    level: s.level,
    fundingType: s.fundingType,
    kind: s.kind,
    haitianEligibility: s.haitianEligibility,
    deadlineAccuracy: s.deadlineAccuracy,
    deadline: s.deadline
      ? {
          dateISO: s.deadline.dateISO,
          month: s.deadline.month,
          notes: s.deadline.notes,
          sourceUrl: s.deadline.sourceUrl,
        }
      : undefined,
    officialUrl: s.officialUrl,
    howToApplyUrl: s.howToApplyUrl,
    requirements: s.requirements,
    eligibilitySummary: s.eligibilitySummary,
    recurring: s.recurring,
    tags: s.tags,
    sources: s.sources.map((src) => ({ label: src.label, url: src.url })),
    verifiedAtISO: tsToISO(s.verifiedAt),
    updatedAtISO: tsToISO(s.updatedAt),
  };
}

// formatDateBanner delegated to shared utility
const formatDateBanner = (iso: string, lang: ContentLanguage) =>
  formatDateLocalized(iso, lang);

export default async function BoursesPage({
  searchParams,
}: {
  searchParams: { lang?: string; [key: string]: string | string[] | undefined };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";

  // Detect whether any filter search-param is active
  const hasActiveFilters = FILTER_PARAM_KEYS.some(
    (k) => searchParams[k] !== undefined,
  );

  let allScholarships: Scholarship[];
  let closingSoon: Scholarship[];
  try {
    [allScholarships, closingSoon] = await Promise.all([
      fetchScholarshipsForHaiti(),
      fetchScholarshipsClosingSoon(60),
    ]);
  } catch (err) {
    console.error("[EdLight] /bourses fetch failed:", err);
    allScholarships = [];
    closingSoon = [];
  }

  const serialized = allScholarships.map(serializeScholarship);
  const langQ = lang === "ht" ? "?lang=ht" : "";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-stone-900 dark:text-white sm:text-4xl">
            {fr ? "Bourses & Opportunités" : "Bous & Opòtinite"}
          </h1>
          <p className="max-w-2xl text-stone-600 dark:text-stone-300">
            {fr
              ? "Comparez les bourses ouvertes aux étudiants haïtiens, filtrez par pays ou niveau."
              : "Konpare bous ki ouvè pou etidyan ayisyen, filtre pa peyi oswa nivo."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
            {allScholarships.length} {fr ? "résultats" : "rezilta"}
          </span>
          <Link
            href={`/closing-soon${langQ}`}
            className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
          >
            {fr ? "Dates limites" : "Dat limit yo"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Closing soon banner */}
      {closingSoon.length > 0 && (
        <section className="mx-auto max-w-6xl rounded-xl border border-blue-200/80 bg-blue-50/40 px-4 py-5 dark:border-blue-800/40 dark:bg-blue-950/10 sm:px-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold tracking-tight text-blue-800 dark:text-blue-300">
              <Clock className="mr-1 inline h-4 w-4" />
              {fr ? "Date limite bientôt" : "Dat limit byento"}
            </h2>
            <Link
              href={`/closing-soon${langQ}`}
              className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800/40 dark:bg-stone-900/70 dark:text-blue-300"
            >
              {fr ? "Voir tout" : "Wè tout"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {closingSoon.slice(0, 4).map((s) => (
              <li key={s.id} className="rounded-xl border border-white/80 bg-white/90 p-3 text-sm text-blue-700 dark:border-stone-700/50 dark:bg-stone-900/50 dark:text-blue-300">
                <p className="line-clamp-2 font-semibold leading-snug">{s.name}</p>
                {s.deadline?.dateISO && (
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                    {formatDateBanner(s.deadline.dateISO, lang)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Start-Here orientation block (hidden when filters active) */}
      {!hasActiveFilters && (
        <section className="mx-auto max-w-6xl space-y-4 px-2 sm:px-0">
          <ScholarshipStartHere lang={lang} />
          <div className="flex items-center gap-4 py-1">
            <div className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
              {fr ? "Ou explorez toutes les bourses" : "Oswa eksplore tout bous yo"}
            </span>
            <div className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
          </div>
        </section>
      )}

      {/* Client-side filters + cards */}
      <section className="mx-auto max-w-6xl px-2 pb-4 sm:px-0">
        <Suspense fallback={null}>
          <BoursesFilters scholarships={serialized} lang={lang} />
        </Suspense>
      </section>
    </div>
  );
}
