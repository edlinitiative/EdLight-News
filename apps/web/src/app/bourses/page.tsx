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
import { PageHero } from "@/components/PageHero";
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
import { withLangParam } from "@/lib/utils";

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
  const l = (href: string) => withLangParam(href, lang);

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
  const countryCount = new Set(allScholarships.map((scholarship) => scholarship.country)).size;

  return (
    <div className="space-y-8">
      <PageHero
        variant="bourses"
        eyebrow={fr ? "Base de données étudiante" : "Baz done etidyan"}
        title={fr ? "Trouver une bourse sans se perdre." : "Jwenn yon bous san w pa pèdi."}
        description={
          fr
            ? "Comparez les opportunités, filtrez par pays ou niveau, puis gardez un oeil sur les deadlines qui approchent."
            : "Konpare okazyon yo, filtre pa peyi oswa nivo, epi kontinye suiv dat limit ki ap pwoche yo."
        }
        icon={<GraduationCap className="h-5 w-5" />}
        actions={[
          { href: l("/closing-soon"), label: fr ? "Voir les deadlines" : "Wè dat limit yo" },
          { href: l("/parcours"), label: fr ? "Explorer les parcours" : "Eksplore pakou yo" },
        ]}
        stats={[
          { value: String(allScholarships.length), label: fr ? "bourses" : "bous" },
          { value: String(closingSoon.length), label: fr ? "closing soon" : "k ap fèmen" },
          { value: String(countryCount), label: fr ? "pays" : "peyi" },
        ]}
      />

      {/* ─── Section 2: Deadline Board ─── */}
      {closingSerialized.length > 0 && (
        <section>
          <DeadlineBoard scholarships={closingSerialized} lang={lang} max={8} />
        </section>
      )}

      {/* ─── Section 3: Parcours (hidden when filters active) ─── */}
      {!hasActiveFilters && (
        <section className="space-y-4">
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
      <section className="pb-8">
        <Suspense fallback={null}>
          <BoursesFilters scholarships={serialized} lang={lang} />
        </Suspense>
      </section>
    </div>
  );
}
