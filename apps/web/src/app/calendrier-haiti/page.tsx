/**
 * /calendrier-haiti — Full Haiti Education Calendar page.
 *
 * Displays all upcoming (and past) deadlines from the HaitiEducationCalendar
 * utility series. Server component for SEO + fast load.
 */

import Link from "next/link";
import { CalendarDays, ExternalLink, FileText, GraduationCap, ClipboardList, BarChart3, School, Lock, Pin, Paperclip } from "lucide-react";
import type { ContentLanguage, CalendarEventType } from "@edlight-news/types";
import { fetchCalendarData, getLangFromSearchParams, type CalendarDeadline } from "@/lib/content";
import { fetchUpcomingCalendarEvents, fetchAllCalendarEvents } from "@/lib/datasets";

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

export default async function CalendrierHaitiPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";

  const calendarData = await fetchCalendarData(lang);

  // Fetch structured events from the haiti_education_calendar dataset
  const [structuredUpcoming, structuredAll] = await Promise.all([
    fetchUpcomingCalendarEvents(),
    fetchAllCalendarEvents(),
  ]);

  const EVENT_TYPE_ICON: Record<CalendarEventType, React.ReactNode> = {
    exam: <FileText className="h-5 w-5 text-orange-600" />,
    admissions: <GraduationCap className="h-5 w-5 text-brand-600" />,
    registration: <ClipboardList className="h-5 w-5 text-blue-600" />,
    results: <BarChart3 className="h-5 w-5 text-green-600" />,
    rentree: <School className="h-5 w-5 text-purple-600" />,
    closure: <Lock className="h-5 w-5 text-gray-500" />,
  };

  // Get ALL deadlines from the parent item (not limited to 5)
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
            {fr
              ? "Calendrier Haïti — Examens & Admissions"
              : "Kalandriye Ayiti — Egzamen & Admisyon"}
          </h1>
        </div>
        <p className="max-w-2xl text-gray-500">
          {fr
            ? "Toutes les dates importantes pour les étudiants haïtiens : rentrée scolaire, inscriptions au Bac/NS, résultats, admissions UEH et universités privées."
            : "Tout dat enpòtan pou elèv ayisyen yo: rantre lekòl, enskripsyon Bak/NS, rezilta, admisyon UEH ak inivèsite prive."}
        </p>
        <p className="text-xs text-gray-400">
          {fr
            ? "Les dates sont issues de sources officielles. Vérifiez toujours sur le site de votre institution."
            : "Dat yo soti nan sous ofisyèl. Toujou verifye sou sit enstitisyon ou an."}
        </p>
      </div>

      {/* No data state */}
      {!calendarData.item && structuredAll.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-16 text-center text-gray-400">
          <CalendarDays className="mx-auto mb-3 h-10 w-10" />
          <p className="text-lg">
            {fr
              ? "Le calendrier sera disponible prochainement."
              : "Kalandriye a pral disponib byento."}
          </p>
          <Link
            href={lang === "ht" ? "/?lang=ht" : "/"}
            className="mt-4 inline-block text-sm text-brand-600 hover:underline"
          >
            {fr ? "← Retour à l'accueil" : "← Retounen lakay"}
          </Link>
        </div>
      )}

      {/* Structured calendar events from dataset */}
      {structuredUpcoming.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-brand-800">
            <CalendarDays className="mr-1.5 inline h-5 w-5 text-brand-600" /> {fr ? "Événements à venir (Base de données)" : "Evènman k ap vini (Baz done)"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {structuredUpcoming.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border-l-4 border-brand-400 bg-brand-50 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center">{EVENT_TYPE_ICON[e.eventType] ?? <Pin className="h-5 w-5 text-gray-400" />}</span>
                  <h3 className="font-semibold">{e.title}</h3>
                </div>
                <p className="mt-1 text-sm text-brand-700">
                  {new Date(e.dateISO + "T00:00:00").toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                  {e.endDateISO && ` — ${new Date(e.endDateISO + "T00:00:00").toLocaleDateString(fr ? "fr-FR" : "fr-HT", { day: "numeric", month: "long" })}`}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {e.notes ?? ""}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                  {e.institution && <span>{e.institution}</span>}
                  {e.level && <span>• {Array.isArray(e.level) ? e.level.join(", ") : e.level}</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {e.officialUrl && (
                    <a
                      href={e.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-brand-600 hover:underline"
                    >
                      {fr ? "Site officiel →" : "Sit ofisyèl →"}
                    </a>
                  )}
                  {e.sources?.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-brand-600 hover:underline"
                    >
                      <Paperclip className="mr-0.5 inline h-3 w-3" />{src.label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming deadlines */}
      {upcoming.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-brand-800">
            {fr ? "Dates à venir" : "Dat k ap vini"}
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
          <p className="text-sm text-amber-600">
            {fr
              ? "Ces éléments n'ont pas encore de date officielle confirmée."
              : "Eleman sa yo poko gen dat ofisyèl konfime."}
          </p>
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
