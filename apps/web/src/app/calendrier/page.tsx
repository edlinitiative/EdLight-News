/**
 * /calendrier — Timeline-style dashboard.
 *
 * Server component: fetches data, serialises Timestamps, passes props to the
 * client CalendarDashboard (CalendarFilterTabs) for interactive filtering
 * and timeline rendering.
 */

import Link from "next/link";
import { CalendarDays, ExternalLink } from "lucide-react";
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

export const revalidate = 300;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a Firestore Timestamp (any shape) to an ISO string safe for the client. */
function tsToISO(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const t = v as { seconds?: number; _seconds?: number; toDate?: () => Date };
  const secs = t.seconds ?? t._seconds;
  return secs ? new Date(secs * 1000).toISOString() : null;
}

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
    <div className="flex items-center gap-3 rounded-md border border-gray-100 bg-white px-3 py-2">
      {date && (
        <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-400">
          {date.toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
            day: "numeric",
            month: "short",
          })}
        </span>
      )}
      <span className="flex-1 truncate text-sm text-gray-700">{dl.label}</span>
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
    <div className="space-y-8">
      {/* Page header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-brand-600" />
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            {fr ? "Calendrier" : "Kalandriye"}
          </h1>
        </div>
        <p className="max-w-2xl text-gray-500">
          {fr
            ? "Examens haïtiens, inscriptions et dates limites de bourses internationales."
            : "Egzamen ayisyen, enskripsyon ak dat limit bous entènasyonal."}
        </p>
      </div>

      {/* Main timeline dashboard */}
      <CalendarFilterTabs
        haitiItems={haitiItems}
        intlItems={intlItems}
        lang={lang}
      />

      {/* Legacy article deadlines — collapsed by default to reduce noise */}
      {hasLegacy && (
        <details className="rounded-lg border border-gray-200">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 transition-colors hover:bg-gray-50">
            <span className="text-sm font-medium text-gray-500">
              {fr
                ? "📄 Sources additionnelles (articles)"
                : "📄 Sous adisyonèl (atik)"}
            </span>
            <span aria-hidden className="text-sm text-gray-400">
              ▸
            </span>
          </summary>
          <div className="space-y-2 px-5 pb-4 pt-2">
            {upcomingLegacy.map((dl, idx) => (
              <LegacyDeadlineRow
                key={`${dl.dateISO}-${idx}`}
                dl={dl}
                lang={lang}
              />
            ))}
            {calendarData.item && (
              <p className="mt-2 rounded-md bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
                {calendarData.item.title}
              </p>
            )}
          </div>
        </details>
      )}

      {/* Empty state */}
      {!hasAnyData && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
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
          className="text-sm text-brand-600 hover:underline"
        >
          {fr ? "← Retour à l'accueil" : "← Retounen lakay"}
        </Link>
      </div>
    </div>
  );
}
