/**
 * /bourses — Scholarship database page (v2 — premium redesign).
 *
 * Server component: fetches all scholarships eligible for Haitian students,
 * serialises them, and delegates filtering/rendering to client components.
 *
 * Layout (4 sections):
 *   1) Header — title, subtitle, count
 *   2) DeadlineBoard — compact upcoming-deadline strip
 *   3) Parcours — 4 country path tiles (hidden when filters active)
 *   4) Catalogue — sticky filter bar + search + card grid
 *
 * No backend logic was changed; only UI composition.
 */

import type { Metadata } from "next";
import type { ContentLanguage, Scholarship } from "@edlight-news/types";
import { Suspense } from "react";
import { GraduationCap } from "lucide-react";
import { getLangFromSearchParams } from "@/lib/content";
import {
  fetchScholarshipsForHaiti,
  fetchScholarshipsClosingSoon,
} from "@/lib/datasets";
import { BoursesFilters, type SerializedScholarship } from "@/components/BoursesFilters";
import { DeadlineBoard } from "@/components/bourses/DeadlineBoard";
import { ParcoursTiles } from "@/components/bourses/ParcoursTiles";
import { FILTER_PARAM_KEYS } from "@/lib/scholarship-params";
import { tsToISO as sharedTsToISO } from "@/lib/dates";
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

export default async function BoursesPage({
  searchParams,
}: {
  searchParams: { lang?: string; [key: string]: string | string[] | undefined };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";

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
  const closingSerialized = closingSoon.map(serializeScholarship);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6">
      {/* ─── Section 1: Header ─── */}
      <header className="space-y-3 pt-2">
        <div className="section-rule" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-stone-900 dark:text-white sm:text-3xl">
              <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              {fr ? "Bourses" : "Bous"}
            </h1>
            <p className="max-w-2xl text-sm text-stone-500 dark:text-stone-400">
              {fr
                ? "Trouvez, comparez et suivez les bourses ouvertes aux étudiants haïtiens. Filtrez par pays, niveau ou type de financement."
                : "Jwenn, konpare epi swiv bous ki ouvè pou etidyan ayisyen. Filtre pa peyi, nivo oswa kalite finansman."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
              {allScholarships.length} {fr ? "bourses" : "bous"}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Section 2: Deadline Board ─── */}
      {closingSerialized.length > 0 && (
        <section className="mx-auto max-w-6xl">
          <DeadlineBoard scholarships={closingSerialized} lang={lang} max={8} />
        </section>
      )}

      {/* ─── Section 3: Parcours (hidden when filters active) ─── */}
      {!hasActiveFilters && (
        <section className="mx-auto max-w-6xl space-y-4">
          <ParcoursTiles lang={lang} />
          <div className="flex items-center gap-4 py-1">
            <div className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
              {fr ? "Ou explorez toutes les bourses" : "Oswa eksplore tout bous yo"}
            </span>
            <div className="h-px flex-1 bg-stone-200 dark:bg-stone-700" />
          </div>
        </section>
      )}

      {/* ─── Section 4: Catalogue (filters + cards) ─── */}
      <section className="mx-auto max-w-6xl pb-8">
        <Suspense fallback={null}>
          <BoursesFilters scholarships={serialized} lang={lang} />
        </Suspense>
      </section>
    </div>
  );
}
