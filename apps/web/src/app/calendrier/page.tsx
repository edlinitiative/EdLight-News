/**
 * /calendrier — Unified Calendar page with Haiti / International filter tabs.
 *
 * Shows:
 *  - Structured Haiti education events (exams, admissions, results)
 *  - International scholarship deadlines
 *  - Legacy calendar deadlines from utility articles
 *
 * Client-side filtering via filter tabs: Tous | Haiti | International
 */

import Link from "next/link";
import {
  CalendarDays,
  ExternalLink,
  FileText,
  GraduationCap,
  ClipboardList,
  BarChart3,
  School,
  Lock,
  Pin,
  Paperclip,
  Globe,
  Clock,
  DollarSign,
} from "lucide-react";
import type { ContentLanguage, CalendarEventType } from "@edlight-news/types";
import { fetchCalendarData, getLangFromSearchParams, type CalendarDeadline } from "@/lib/content";
import {
  fetchUpcomingCalendarEvents,
  fetchAllCalendarEvents,
  fetchScholarshipsClosingSoon,
  COUNTRY_LABELS,
} from "@/lib/datasets";
import { CalendarFilterTabs } from "./filter-tabs";
import { MetaBadges } from "@/components/MetaBadges";
import { getCalendarGeoLabel } from "@/lib/geo";

export const dynamic = "force-dynamic";

function DeadlineRow({
  dl,
  lang,
  isPast,
}: {
  dl: CalendarDeadline;
  lang: ContentLanguage;
  isPast: boolean;
}) {
  const fr = lang === "fr";
  const hasDate = dl.dateISO && dl.dateISO.length > 0;
  const dateObj = hasDate ? new Date(dl.dateISO + "T00:00:00") : null;

  return (
    <div
      className={[
        "flex items-start gap-4 rounded-lg border p-4 transition",
        isPast ? "border-gray-200 bg-gray-50 opacity-70" : "border-brand-200 bg-white",
      ].join(" ")}
    >
      {/* Date badge */}
      <div
        className={[
          "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg text-center font-bold",
          isPast ? "bg-gray-300 text-white" : "bg-brand-600 text-white",
        ].join(" ")}
      >
        {dateObj ? (
          <>
            <span className="text-lg leading-tight">
              {dateObj.getDate()}
            </span>
            <span className="text-[10px] uppercase leading-tight">
              {dateObj.toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
                month: "short",
              })}
            </span>
          </>
        ) : (
          <span className="text-xs">?</span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-gray-900">{dl.label}</p>
        {dateObj && (
          <p className="text-sm text-gray-500">
            {dateObj.toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        )}
        {!hasDate && (
          <p className="text-sm italic text-amber-600">
            {fr ? "Date à confirmer" : "Dat pou konfime"}
          </p>
        )}
      </div>

      {/* Source link */}
      {dl.sourceUrl && (
        <a
          href={dl.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
        >
          <ExternalLink className="h-3 w-3" />
          {fr ? "Source officielle" : "Sous ofisyèl"}
        </a>
      )}
    </div>
  );
}

export default async function CalendrierPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";

  let calendarData: Awaited<ReturnType<typeof fetchCalendarData>>;
  let structuredUpcoming: Awaited<ReturnType<typeof fetchUpcomingCalendarEvents>>;
  let structuredAll: Awaited<ReturnType<typeof fetchAllCalendarEvents>>;
  let scholarships90: Awaited<ReturnType<typeof fetchScholarshipsClosingSoon>>;
  try {
    [calendarData, structuredUpcoming, structuredAll, scholarships90] =
      await Promise.all([
        fetchCalendarData(lang),
        fetchUpcomingCalendarEvents(),
        fetchAllCalendarEvents(),
        fetchScholarshipsClosingSoon(90),
      ]);
  } catch (err) {
    console.error("[EdLight] /calendrier fetch failed:", err);
    calendarData = { item: null, deadlines: [], hasUpcoming: false };
    structuredUpcoming = [];
    structuredAll = [];
    scholarships90 = [];
  }

  const EVENT_TYPE_ICON: Record<CalendarEventType, React.ReactNode> = {
    exam: <FileText className="h-5 w-5 text-orange-600" />,
    admissions: <GraduationCap className="h-5 w-5 text-brand-600" />,
    registration: <ClipboardList className="h-5 w-5 text-blue-600" />,
    results: <BarChart3 className="h-5 w-5 text-green-600" />,
    rentree: <School className="h-5 w-5 text-purple-600" />,
    closure: <Lock className="h-5 w-5 text-gray-500" />,
  };

  // ── Timestamp → ISO-string helper (Firestore Timestamps are class instances
  //    that cannot cross the server→client boundary) ─────────────────────────
  const tsToISO = (v: unknown): string | null => {
    if (!v || typeof v !== "object") return null;
    const t = v as { seconds?: number; _seconds?: number; toDate?: () => Date };
    const secs = t.seconds ?? t._seconds;
    return secs ? new Date(secs * 1000).toISOString() : null;
  };

  // Build unified list for filter tabs
  const haitiItems = structuredUpcoming.map((e) => ({
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
    geoLabel: getCalendarGeoLabel(e),
  }));

  const intlItems = scholarships90.map((s) => ({
    id: s.id,
    kind: "international" as const,
    name: s.name,
    dateISO: s.deadline?.dateISO ?? null,
    country: s.country,
    countryLabel: fr ? COUNTRY_LABELS[s.country]?.fr : COUNTRY_LABELS[s.country]?.ht,
    countryFlag: COUNTRY_LABELS[s.country]?.flag,
    eligibility: s.eligibilitySummary,
    howToApplyUrl: s.howToApplyUrl,
    geoLabel: getCalendarGeoLabel(s),
  }));

  // Get ALL deadlines from the parent item
  const allDeadlines = calendarData.deadlines;
  const now = new Date();

  const upcoming = allDeadlines.filter(
    (d) => d.dateISO && d.dateISO.length > 0 && new Date(d.dateISO) >= now,
  );
  const past = allDeadlines.filter(
    (d) => d.dateISO && d.dateISO.length > 0 && new Date(d.dateISO) < now,
  );
  const unconfirmed = allDeadlines.filter(
    (d) => !d.dateISO || d.dateISO.length === 0,
  );

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-brand-600" />
          <h1 className="text-3xl font-extrabold tracking-tight">
            {fr ? "Calendrier" : "Kalandriye"}
          </h1>
        </div>
        <p className="max-w-2xl text-gray-500">
          {fr
            ? "Toutes les dates importantes : examens haïtiens, inscriptions, dates limites de bourses internationales."
            : "Tout dat enpòtan yo: egzamen ayisyen, enskripsyon, dat limit bous entènasyonal."}
        </p>
      </div>

      {/* Filter tabs (client component) */}
      <CalendarFilterTabs
        haitiItems={haitiItems}
        intlItems={intlItems}
        lang={lang}
      />

      {/* Legacy deadlines from utility articles */}
      {upcoming.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-brand-800">
            {fr ? "Dates à venir (articles)" : "Dat k ap vini (atik)"}
          </h2>
          <div className="space-y-3">
            {upcoming.map((dl, idx) => (
              <DeadlineRow
                key={`upcoming-${dl.dateISO}-${idx}`}
                dl={dl}
                lang={lang}
                isPast={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* Unconfirmed dates */}
      {unconfirmed.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-amber-700">
            {fr ? "À confirmer" : "Pou konfime"}
          </h2>
          <div className="space-y-3">
            {unconfirmed.map((dl, idx) => (
              <DeadlineRow
                key={`unconfirmed-${idx}`}
                dl={dl}
                lang={lang}
                isPast={false}
              />
            ))}
          </div>
        </section>
      )}

      {/* Past deadlines */}
      {past.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-500">
            {fr ? "Dates passées" : "Dat ki pase"}
          </h2>
          <div className="space-y-3">
            {past.map((dl, idx) => (
              <DeadlineRow
                key={`past-${dl.dateISO}-${idx}`}
                dl={dl}
                lang={lang}
                isPast
              />
            ))}
          </div>
        </section>
      )}

      {/* Calendar article body */}
      {calendarData.item && (
        <section className="space-y-4 rounded-lg border bg-gray-50 p-6">
          <h2 className="text-lg font-bold">
            {calendarData.item.title}
          </h2>
          <div className="prose prose-sm max-w-none text-gray-700">
            {calendarData.item.body.split("\n").map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </section>
      )}

      {/* No data state */}
      {!calendarData.item && structuredAll.length === 0 && scholarships90.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
          <CalendarDays className="mx-auto mb-3 h-10 w-10" />
          <p className="text-lg">
            {fr
              ? "Le calendrier sera disponible prochainement."
              : "Kalandriye a pral disponib byento."}
          </p>
        </div>
      )}

      {/* Back link */}
      <div className="pt-4">
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
