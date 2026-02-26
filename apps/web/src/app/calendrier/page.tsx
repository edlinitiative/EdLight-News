/**
 * /calendrier — Timeline-style dashboard.
 *
 * Server component: fetches data, serialises Timestamps, passes props to the
 * client CalendarDashboard (CalendarFilterTabs) for interactive filtering
 * and timeline rendering.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDays, ExternalLink, Sparkles, Clock3, Globe2 } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import {
  fetchCalendarData,
  getLangFromSearchParams,
  type CalendarDeadline,
} from "@/lib/content";
import {
  fetchUpcomingCalendarEvents,
  fetchScholarshipsClosingSoon,
  COUNTRY_LABELS,
} from "@/lib/datasets";
import { CalendarFilterTabs } from "./filter-tabs";
import { getCalendarGeo, type CalendarGeo } from "@/lib/calendarGeo";
import { getCalendarAudience, type CalendarAudience } from "@/lib/calendarAudience";
import type { HaitiCalendarItem, IntlCalendarItem } from "@/components/calendar/types";
import { tsToISONull } from "@/lib/dates";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Calendrier · EdLight News" : "Kalandriye · EdLight News";
  const description = fr
    ? "Dates limites, événements et calendrier académique pour étudiants haïtiens."
    : "Dat limit, evènman ak kalandriye akademik pou elèv ayisyen.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/calendrier", lang }),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// tsToISO imported from shared @/lib/dates
const tsToISO = tsToISONull;

// ─── Legacy deadline row ──────────────────────────────────────────────────────

function LegacyDeadlineRow({
  dl,
  lang,
}: {
  dl: CalendarDeadline;
  lang: ContentLanguage;
}) {
  const fr = lang === "fr";
  const date = dl.dateISO ? new Date(dl.dateISO + "T00:00:00") : null;

  return (
    <div className="flex items-center gap-3 rounded-md border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
      {date && (
        <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-400 dark:text-slate-500">
          {date.toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
            day: "numeric",
            month: "short",
          })}
        </span>
      )}
      <span className="flex-1 truncate text-sm text-gray-700 dark:text-slate-300">{dl.label}</span>
      {dl.sourceUrl && (
        <a
          href={dl.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-brand-500 hover:text-brand-700"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";

  // Data fetching — errors are caught gracefully
  let calendarData: Awaited<ReturnType<typeof fetchCalendarData>>;
  let structuredUpcoming: Awaited<ReturnType<typeof fetchUpcomingCalendarEvents>>;
  let scholarships90: Awaited<ReturnType<typeof fetchScholarshipsClosingSoon>>;

  try {
    [calendarData, structuredUpcoming, scholarships90] = await Promise.all([
      fetchCalendarData(lang),
      fetchUpcomingCalendarEvents(),
      fetchScholarshipsClosingSoon(90),
    ]);
  } catch (err) {
    console.error("[EdLight] /calendrier fetch failed:", err);
    calendarData = { item: null, deadlines: [], hasUpcoming: false };
    structuredUpcoming = [];
    scholarships90 = [];
  }

  // Build unified calendar items (Timestamps serialised to ISO strings)
  const haitiItems: HaitiCalendarItem[] = structuredUpcoming.map((e) => ({
    id: e.id,
    kind: "haiti" as const,
    title: e.title,
    dateISO: e.dateISO,
    endDateISO: e.endDateISO,
    notes: e.notes,
    institution: e.institution,
    level: e.level,
    eventType: e.eventType,
    officialUrl: e.officialUrl,
    sources: e.sources,
    verifiedAt: tsToISO(e.verifiedAt),
    updatedAt: tsToISO(e.updatedAt),
    geo: getCalendarGeo(e) as CalendarGeo,
    audience: getCalendarAudience(e) as CalendarAudience,
  }));

  const intlItems: IntlCalendarItem[] = scholarships90.map((s) => ({
    id: s.id,
    kind: "international" as const,
    name: s.name,
    dateISO: s.deadline?.dateISO ?? null,
    country: s.country,
    countryLabel: fr ? COUNTRY_LABELS[s.country]?.fr : COUNTRY_LABELS[s.country]?.ht,
    countryFlag: COUNTRY_LABELS[s.country]?.flag,
    eligibility: s.eligibilitySummary,
    howToApplyUrl: s.howToApplyUrl,
    geo: getCalendarGeo(s) as CalendarGeo,
    audience: getCalendarAudience(s) as CalendarAudience,
  }));

  // Legacy deadlines from utility articles
  const now = new Date();
  const upcomingLegacy = calendarData.deadlines.filter(
    (d) => d.dateISO && new Date(d.dateISO) >= now,
  );
  const hasLegacy = upcomingLegacy.length > 0 || calendarData.item !== null;
  const hasAnyData =
    haitiItems.length > 0 || intlItems.length > 0 || hasLegacy;

  return (
    <div className="space-y-10">
      <section className="section-shell p-0">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-35" />
          <div className="pointer-events-none absolute -right-10 top-0 h-44 w-44 rounded-full bg-brand-200/35 blur-3xl dark:bg-brand-500/15" />
          <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                {fr ? "Calendrier premium" : "Kalandriye premium"}
              </div>
              <div className="flex items-center gap-2">
                <CalendarDays className="h-7 w-7 text-brand-600 dark:text-brand-400" />
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-slate-100 sm:text-4xl">
                  {fr ? "Calendrier" : "Kalandriye"}
                </h1>
              </div>
              <p className="max-w-2xl text-gray-600 dark:text-slate-300">
                {fr
                  ? "Examens haïtiens, inscriptions et dates limites de bourses internationales dans un tableau filtrable."
                  : "Egzamen ayisyen, enskripsyon ak dat limit bous entènasyonal nan yon tablo ki ka filtre."}
              </p>
            </div>
            <aside className="premium-glass p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Haïti" : "Ayiti"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{haitiItems.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "International" : "Entènasyonal"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{intlItems.length}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-600 dark:text-slate-300">
                <p className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />{fr ? "Vue urgences + semaine + mois" : "View ijans + semèn + mwa"}</p>
                <p className="inline-flex items-center gap-1"><Globe2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />{fr ? "Filtres géo et catégorie" : "Filtè jewo ak kategori"}</p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Main timeline dashboard */}
      <section className="section-shell p-5 sm:p-6">
        <div className="relative z-10">
          <CalendarFilterTabs
            haitiItems={haitiItems}
            intlItems={intlItems}
            lang={lang}
          />
        </div>
      </section>

      {/* Legacy article deadlines — collapsed by default to reduce noise */}
      {hasLegacy && (
        <details className="section-shell p-0">
          <summary className="relative z-10 flex cursor-pointer list-none items-center justify-between px-5 py-3.5 transition-colors hover:bg-gray-50/70 dark:hover:bg-slate-800/60">
            <span className="text-sm font-medium text-gray-500 dark:text-slate-400">
              {fr
                ? "📄 Sources additionnelles (articles)"
                : "📄 Sous adisyonèl (atik)"}
            </span>
            <span aria-hidden className="text-sm text-gray-400 dark:text-slate-500">
              ▸
            </span>
          </summary>
          <div className="relative z-10 space-y-2.5 px-5 pb-5 pt-2.5">
            {upcomingLegacy.map((dl, idx) => (
              <LegacyDeadlineRow
                key={`${dl.dateISO}-${idx}`}
                dl={dl}
                lang={lang}
              />
            ))}
            {calendarData.item && (
              <p className="mt-2 rounded-md bg-gray-50 dark:bg-slate-800 px-4 py-3 text-sm font-medium text-gray-600 dark:text-slate-300">
                {calendarData.item.title}
              </p>
            )}
          </div>
        </details>
      )}

      {/* Empty state */}
      {!hasAnyData && (
        <div className="section-shell border-2 border-dashed py-16 text-center text-gray-400 dark:text-slate-500">
          <CalendarDays className="mx-auto mb-3 h-10 w-10" />
          <p>
            {fr
              ? "Le calendrier sera disponible prochainement."
              : "Kalandriye a pral disponib byento."}
          </p>
        </div>
      )}

      {/* Back link */}
      <div className="pt-2">
        <Link
          href={lang === "ht" ? "/?lang=ht" : "/"}
          className="inline-flex items-center rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
        >
          {fr ? "← Retour à l'accueil" : "← Retounen lakay"}
        </Link>
      </div>
    </div>
  );
}
