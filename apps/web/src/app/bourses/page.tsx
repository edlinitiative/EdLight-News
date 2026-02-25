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
import { GraduationCap, Clock, Sparkles, Filter, ArrowRight } from "lucide-react";
import Link from "next/link";
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
  const langQ = lang === "ht" ? "?lang=ht" : "";

  return (
    <div className="space-y-8">
      <section className="section-shell p-0">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-40" />
          <div className="pointer-events-none absolute -top-10 right-0 h-44 w-44 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/20" />
          <div className="relative grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                {fr ? "Base de bourses premium" : "Baz bous premium"}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                <GraduationCap className="mr-1.5 inline h-7 w-7 text-brand-600 dark:text-brand-400" />
                {fr ? "Bourses & Opportunités" : "Bous & Opòtinite"}
              </h1>
              <p className="text-gray-600 dark:text-slate-300">
                {fr
                  ? `${allScholarships.length} bourses ouvertes aux étudiants haïtiens, avec filtres par pays, niveau, financement et urgence.`
                  : `${allScholarships.length} bous ki ouvè pou etidyan ayisyen yo, ak filtè pa peyi, nivo, finansman ak ijans.`}
              </p>
            </div>
            <aside className="premium-glass p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Résultats" : "Rezilta"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{allScholarships.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Urgentes (60j)" : "Ijan (60j)"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{closingSoon.length}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-gray-700 dark:border-slate-700/70 dark:bg-slate-900/60 dark:text-slate-300">
                  <Filter className="h-3.5 w-3.5" />
                  {fr ? "Filtres URL partageables" : "Filtè URL patajab"}
                </span>
                <Link
                  href={`/closing-soon${langQ}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
                >
                  {fr ? "Voir les dates limites" : "Wè dat limit yo"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Closing soon banner */}
      {closingSoon.length > 0 && (
        <section className="section-shell space-y-3 border-brand-200/80 bg-brand-50/40 dark:border-brand-800/40 dark:bg-brand-950/10">
          <h2 className="font-bold text-brand-800 dark:text-brand-300">
            <Clock className="mr-1 inline h-4 w-4" />{" "}
            {fr ? "Date limite bientôt !" : "Dat limit byento!"}
          </h2>
          <ul className="space-y-2">
            {closingSoon.slice(0, 5).map((s) => (
              <li key={s.id} className="rounded-xl border border-white/80 bg-white/80 p-2.5 text-sm text-brand-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-brand-300">
                <strong className="font-semibold">{s.name}</strong>
                {s.deadline?.dateISO && (
                  <span> — {formatDateBanner(s.deadline.dateISO, lang)}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Start-Here orientation block (hidden when filters active) */}
      {!hasActiveFilters && (
        <>
          <ScholarshipStartHere lang={lang} />
          <div className="flex items-center gap-4 py-2">
            <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500">
              {fr ? "Ou explorez toutes les bourses" : "Oswa eksplore tout bous yo"}
            </span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
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
