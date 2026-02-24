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
import { GraduationCap, Clock } from "lucide-react";
import { getLangFromSearchParams } from "@/lib/content";
import {
  fetchScholarshipsForHaiti,
  fetchScholarshipsClosingSoon,
} from "@/lib/datasets";
import { BoursesFilters, type SerializedScholarship } from "@/components/BoursesFilters";
import { ScholarshipStartHere } from "@/components/ScholarshipStartHere";
import { FILTER_PARAM_KEYS } from "@/lib/scholarship-params";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  return {
    title: fr ? "Bourses & Opportunités · EdLight News" : "Bous & Opòtinite · EdLight News",
    description: fr
      ? "Base de données de bourses et opportunités pour étudiants haïtiens."
      : "Baz done bous ak opòtinite pou elèv ayisyen yo.",
  };
}

// ── Timestamp → ISO string helper ──────────────────────────────────────────

function tsToISO(v: unknown): string | undefined {
  if (!v || typeof v !== "object") return undefined;
  const t = v as { seconds?: number; _seconds?: number };
  const secs = t.seconds ?? t._seconds;
  if (typeof secs !== "number") return undefined;
  return new Date(secs * 1000).toISOString();
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

function formatDateBanner(iso: string, lang: ContentLanguage): string {
  try {
    return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "fr-HT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <GraduationCap className="mr-1.5 inline h-7 w-7 text-brand-600" />{" "}
          {fr ? "Bourses & Opportunités" : "Bous & Opòtinite"}
        </h1>
        <p className="text-gray-500">
          {fr
            ? `${allScholarships.length} bourses ouvertes aux étudiants haïtiens.`
            : `${allScholarships.length} bous ki ouvè pou etidyan ayisyen yo.`}
        </p>
      </div>

      {/* Closing soon banner */}
      {closingSoon.length > 0 && (
        <div className="rounded-lg border-l-4 border-brand-300 bg-brand-50 p-4">
          <h2 className="font-bold text-brand-800">
            <Clock className="mr-1 inline h-4 w-4" />{" "}
            {fr ? "Date limite bientôt !" : "Dat limit byento!"}
          </h2>
          <ul className="mt-2 space-y-1">
            {closingSoon.slice(0, 5).map((s) => (
              <li key={s.id} className="text-sm text-brand-700">
                <strong>{s.name}</strong>
                {s.deadline?.dateISO && (
                  <span> — {formatDateBanner(s.deadline.dateISO, lang)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Start-Here orientation block (hidden when filters active) */}
      {!hasActiveFilters && (
        <>
          <ScholarshipStartHere lang={lang} />
          <div className="flex items-center gap-4 py-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-gray-400">
              {fr ? "Ou explorez toutes les bourses" : "Oswa eksplore tout bous yo"}
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
        </>
      )}

      {/* Client-side filters + cards */}
      <Suspense fallback={null}>
        <BoursesFilters scholarships={serialized} lang={lang} />
      </Suspense>
    </div>
  );
}
