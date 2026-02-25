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
    <div className="space-y-10">
      <section className="mx-auto max-w-6xl px-2 sm:px-0">
        <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-100/70 blur-3xl dark:bg-brand-900/30" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-indigo-100/70 blur-3xl dark:bg-indigo-900/20" />

          <div className="relative grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-700/40 dark:bg-brand-900/20 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                {fr ? "Répertoire guidé" : "Repètwa gide"}
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                <GraduationCap className="mr-2 inline h-7 w-7 text-brand-600 dark:text-brand-400" />
                {fr ? "Bourses & Opportunités" : "Bous & Opòtinite"}
              </h1>

              <p className="max-w-3xl text-gray-600 dark:text-slate-300">
                {fr
                  ? "Un espace unique pour comparer les bourses ouvertes aux étudiants haïtiens, filtrer vite, et partager une recherche précise."
                  : "Yon sèl espas pou konpare bous ki ouvè pou etidyan ayisyen, filtre rapid, epi pataje rechèch la fasil."}
              </p>

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Filter className="h-3.5 w-3.5" />
                  {fr ? "Filtres URL partageables" : "Filtè URL patajab"}
                </span>
                <Link
                  href={`/closing-soon${langQ}`}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-brand-300 dark:hover:bg-brand-900/30"
                >
                  {fr ? "Voir les dates limites" : "Wè dat limit yo"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            <aside className="grid grid-cols-2 gap-3 self-start rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">
                  {fr ? "Résultats" : "Rezilta"}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{allScholarships.length}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/70">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">
                  {fr ? "Urgentes (60j)" : "Ijan (60j)"}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{closingSoon.length}</p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Closing soon banner */}
      {closingSoon.length > 0 && (
        <section className="mx-auto max-w-6xl space-y-4 rounded-2xl border border-brand-200/80 bg-brand-50/40 px-4 py-5 dark:border-brand-800/40 dark:bg-brand-950/10 sm:px-5">
          <h2 className="font-bold tracking-tight text-brand-800 dark:text-brand-300">
            <Clock className="mr-1 inline h-4 w-4" />
            {fr ? "Date limite bientôt !" : "Dat limit byento!"}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {closingSoon.slice(0, 5).map((s) => (
              <li key={s.id} className="rounded-xl border border-white/80 bg-white/80 p-3 text-sm text-brand-700 dark:border-slate-700/50 dark:bg-slate-900/50 dark:text-brand-300">
                <strong className="font-semibold">{s.name}</strong>
                {s.deadline?.dateISO && (
                  <p className="mt-1 text-xs text-brand-600 dark:text-brand-400">
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
        <section className="mx-auto max-w-6xl space-y-5 px-2 sm:px-0">
          <ScholarshipStartHere lang={lang} />
          <div className="flex items-center gap-4 py-2">
            <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-slate-500">
              {fr ? "Ou explorez toutes les bourses" : "Oswa eksplore tout bous yo"}
            </span>
            <div className="h-px flex-1 bg-gray-200 dark:bg-slate-700" />
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
