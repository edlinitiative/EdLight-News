/**
 * /bourses — Scholarship database page.
 *
 * Server component: fetches all scholarships eligible for Haitian students,
 * serialises them, and delegates rendering to the BoursesEditorial client
 * component.
 *
 * Layout (mirrors /universites and /opportunites for visual consistency):
 *   1) PageHeroCompact — shared editorial hero with stats
 *   2) DeadlineBoard — upcoming scholarship deadlines (when present)
 *   3) BoursesEditorial — search, filters, featured, feed, sidebar, catalogue
 */

import type { Metadata } from "next";
import type { ContentLanguage, Scholarship } from "@edlight-news/types";
import { Suspense } from "react";
import { PageHeroCompact } from "@/components/PageHeroCompact";
import { getLangFromSearchParams } from "@/lib/content";
import {
  fetchScholarshipsForHaiti,
  fetchScholarshipsClosingSoon,
} from "@/lib/datasets";
import type { SerializedScholarship } from "@/components/BoursesFilters";
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
    ? "Bourses vérifiées pour étudiants haïtiens : financement, niveaux, dates limites."
    : "Bous verifye pou etidyan ayisyen: finansman, nivo, dat limit.";
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
  const haitianEligibleCount = allScholarships.filter(
    (s) =>
      s.haitianEligibility === "yes" ||
      s.eligibleCountries?.includes("HT") ||
      s.country === "HT" ||
      s.country === "Global",
  ).length;

  // Schema.org ItemList of Course for SEO discoverability.
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: fr ? "Bourses pour étudiants haïtiens" : "Bous pou etidyan ayisyen",
    numberOfItems: serialized.length,
    itemListElement: serialized.slice(0, 50).map((s, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `https://news.edlight.org/bourses/${s.id}`,
      item: {
        "@type": "Course",
        name: s.name,
        ...(s.eligibilitySummary
          ? { description: s.eligibilitySummary }
          : {}),
        ...(s.deadline?.dateISO
          ? { applicationDeadline: s.deadline.dateISO }
          : {}),
        ...(s.level ? { educationalCredentialAwarded: s.level } : {}),
        provider: { "@type": "Organization", name: s.country },
      },
    })),
  };

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      {/* ─── Section 1: Editorial Hero (shared component for cross-page consistency) ─── */}
      <PageHeroCompact
        tint="indigo"
        eyebrow={fr ? "Bourses" : "Bous"}
        title={
          fr
            ? "Trouver la bonne bourse, sans perdre une saison."
            : "Jwenn bon bous la, san w pa pèdi yon sezon."
        }
        titleAccent={
          fr ? "Vérifiées pour Haïti." : "Verifye pou Ayiti."
        }
        description={
          fr
            ? "Une base curatée de bourses académiques et professionnelles, filtrables par pays, niveau, financement et éligibilité haïtienne."
            : "Yon baz kirye bous akademik ak pwofesyonèl, filtre selon peyi, nivo, finansman ak elijibilite ayisyen."
        }
        stats={[
          { value: String(allScholarships.length), label: fr ? "bourses" : "bous" },
          { value: String(closingSoon.length), label: fr ? "deadlines" : "dat limit" },
          { value: String(countryCount), label: fr ? "pays" : "peyi" },
          { value: String(haitianEligibleCount), label: fr ? "éligibles HT" : "elijib HT" },
        ]}
      />

      {/* ─── Section 2: Deadline Board (only when there are upcoming deadlines) ─── */}
      {closingSerialized.length > 0 && (
        <DeadlineBoard scholarships={closingSerialized} lang={lang} max={8} />
      )}

      {/* ─── Section 3: Search, Featured, Feed+Sidebar, Catalogue ─── */}
      <Suspense fallback={null}>
        <BoursesEditorial scholarships={serialized} lang={lang} />
      </Suspense>
    </div>
  );
}
