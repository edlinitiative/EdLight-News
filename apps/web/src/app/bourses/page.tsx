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
import { getLangFromSearchParams } from "@/lib/content";
import {
  fetchScholarshipsForHaiti,
  fetchScholarshipsClosingSoon,
} from "@/lib/datasets";
import type { SerializedScholarship } from "@/components/BoursesFilters";
import { BoursesEditorial } from "@/components/bourses/BoursesEditorial";
import { tsToISO as sharedTsToISO } from "@/lib/dates";
import { parseISODateSafe, daysUntil } from "@/lib/deadlines";
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

/**
 * A scholarship is "clearly expired" only when it has a concrete deadline date
 * that is strictly in the past. Month-only / varies / undated entries are never
 * treated as expired (we can't be sure), so they stay in the main list.
 */
function isExpired(s: SerializedScholarship, now: Date): boolean {
  const d = parseISODateSafe(s.deadline?.dateISO);
  return d ? daysUntil(d, now) < 0 : false;
}

/**
 * "Actionable" = the reader has both a way to apply (an application/official
 * link) and some how-to / eligibility content to act on. Incomplete records
 * still render — they just sort below the actionable ones.
 */
function isActionable(s: SerializedScholarship): boolean {
  const hasApplyLink = Boolean(s.howToApplyUrl) || Boolean(s.officialUrl);
  const hasHowTo =
    Boolean(s.howToApplyUrl) ||
    Boolean(s.eligibilitySummary) ||
    (s.requirements?.length ?? 0) > 0;
  return hasApplyLink && hasHowTo;
}

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

  // Default ordering (non-destructive): keep every scholarship, but push clearly
  // expired ones to the bottom and lift entries with complete, actionable data
  // to the top. Array.sort is stable, so ties keep their original dataset order.
  const now = new Date();
  serialized.sort((a, b) => {
    const expiredDelta = (isExpired(a, now) ? 1 : 0) - (isExpired(b, now) ? 1 : 0);
    if (expiredDelta !== 0) return expiredDelta;
    return (isActionable(a) ? 0 : 1) - (isActionable(b) ? 0 : 1);
  });

  const closingSerialized = closingSoon.map(serializeScholarship);
  // Match the "Éligible" sidebar filter exactly (strict haitianEligibility === "yes")
  // so the hero stat and the filter count never disagree.
  const haitianEligibleCount = allScholarships.filter(
    (s) => s.haitianEligibility === "yes",
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
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      {/* Hero, urgent deadline rail, filters, and catalogue all live in the client component. */}
      <Suspense fallback={null}>
        <BoursesEditorial
          scholarships={serialized}
          closingSoon={closingSerialized}
          lang={lang}
          stats={{ total: allScholarships.length, eligible: haitianEligibleCount }}
        />
      </Suspense>
    </div>
  );
}
