/**
 * /bourses — Scholarship database page (v3 — editorial redesign).
 *
 * Server component: fetches all scholarships eligible for Haitian students,
 * serialises them, and delegates rendering to the BoursesEditorial client
 * component which orchestrates the full editorial layout:
 *
 *   1) BoursesHero — large editorial headline + live stats
 *   2) BoursesSearchBar — unified search & quick-filter bar
 *   3) FeaturedBourses — 2-column featured scholarship cards
 *   4) BoursesFeed + BoursesSidebar — 8/4 editorial grid
 *   5) Full catalogue toggle with ScholarshipCard grid
 */

import type { Metadata } from "next";
import type { ContentLanguage, Scholarship } from "@edlight-news/types";
import { Suspense } from "react";
import { getLangFromSearchParams } from "@/lib/content";
import {
  fetchScholarshipsForHaiti,
  fetchScholarshipsClosingSoon,
} from "@/lib/datasets";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { BoursesHero } from "@/components/bourses/BoursesHero";
import { BoursesEditorial } from "@/components/bourses/BoursesEditorial";
import { DeadlineBoard } from "@/components/bourses/DeadlineBoard";
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
    ? "Intelligence curatée sur les financements académiques et professionnels à enjeux élevés."
    : "Entèlijans kirye sou finansman akademik ak pwofesyonèl ki gen gwo enjè.";
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
  const countryCount = new Set(allScholarships.map((s) => s.country)).size;

  return (
    <div className="space-y-12">
      {/* ─── Section 1: Editorial Hero ─── */}
      <BoursesHero
        lang={lang}
        totalCount={allScholarships.length}
        closingSoonCount={closingSoon.length}
        countryCount={countryCount}
      />

      {/* ─── Section 2: Deadline Board ─── */}
      {closingSerialized.length > 0 && (
        <section>
          <DeadlineBoard scholarships={closingSerialized} lang={lang} max={8} />
        </section>
      )}

      {/* ─── Sections 3-6: Search, Featured, Feed+Sidebar, Catalogue ─── */}
      <Suspense fallback={null}>
        <BoursesEditorial scholarships={serialized} lang={lang} />
      </Suspense>
    </div>
  );
}
