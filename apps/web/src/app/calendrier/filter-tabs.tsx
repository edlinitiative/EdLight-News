"use client";

import { useState } from "react";
import {
  CalendarDays,
  Globe,
  GraduationCap,
  FileText,
  ClipboardList,
  BarChart3,
  School,
  Lock,
  Pin,
  Clock,
  Paperclip,
  DollarSign,
  ExternalLink,
} from "lucide-react";
import type { ContentLanguage, CalendarEventType } from "@edlight-news/types";
import type { CalendarGeoLabel } from "@/lib/geo";
import { MetaBadges } from "@/components/MetaBadges";
import { DeadlineBadge } from "@/components/DeadlineBadge";

type FilterTab = "tous" | "haiti" | "international";

interface HaitiItem {
  id: string;
  kind: "haiti";
  title: string;
  dateISO?: string;
  endDateISO?: string | null;
  notes?: string | null;
  institution?: string | null;
  level?: string | string[] | null;
  eventType: CalendarEventType;
  officialUrl?: string | null;
  sources?: { label: string; url: string }[] | null;
  verifiedAt?: unknown;
  updatedAt?: unknown;
  geoLabel: CalendarGeoLabel;
}

interface IntlItem {
  id: string;
  kind: "international";
  name: string;
  dateISO: string | null;
  country: string;
  countryLabel?: string;
  countryFlag?: string;
  eligibility?: string | null;
  howToApplyUrl?: string | null;
  geoLabel: CalendarGeoLabel;
}

const EVENT_TYPE_ICON: Record<CalendarEventType, React.ReactNode> = {
  exam: <FileText className="h-5 w-5 text-orange-600" />,
  admissions: <GraduationCap className="h-5 w-5 text-brand-600" />,
  registration: <ClipboardList className="h-5 w-5 text-blue-600" />,
  results: <BarChart3 className="h-5 w-5 text-green-600" />,
  rentree: <School className="h-5 w-5 text-purple-600" />,
  closure: <Lock className="h-5 w-5 text-gray-500" />,
};

export function CalendarFilterTabs({
  haitiItems,
  intlItems,
  lang,
}: {
  haitiItems: HaitiItem[];
  intlItems: IntlItem[];
  lang: ContentLanguage;
}) {
  const [tab, setTab] = useState<FilterTab>("tous");
  const fr = lang === "fr";

  // Geo-based filtering
  const geoFilter = (label: CalendarGeoLabel): boolean =>
    tab === "tous" || (tab === "haiti" ? label === "HT" : label === "International");

  const filteredHaiti = haitiItems.filter((i) => geoFilter(i.geoLabel));
  const filteredIntl = intlItems.filter((i) => geoFilter(i.geoLabel));

  const haitiGeoCount =
    haitiItems.filter((i) => i.geoLabel === "HT").length +
    intlItems.filter((i) => i.geoLabel === "HT").length;
  const intlGeoCount =
    haitiItems.filter((i) => i.geoLabel === "International").length +
    intlItems.filter((i) => i.geoLabel === "International").length;

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "tous", label: fr ? "Tous" : "Tout", count: haitiItems.length + intlItems.length },
    { key: "haiti", label: fr ? "Haïti" : "Ayiti", count: haitiGeoCount },
    { key: "international", label: "International", count: intlGeoCount },
  ];

  return (
    <div className="space-y-6">
      {/* Tab pills */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              tab === t.key
                ? "bg-brand-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200",
            ].join(" ")}
          >
            {t.label} <span className="ml-1 opacity-70">({t.count})</span>
          </button>
        ))}
      </div>

      {/* Haiti events */}
      {filteredHaiti.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-blue-800">
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">Haïti</span>
            {fr ? "Événements Haïti" : "Evènman Ayiti"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredHaiti.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border-l-4 border-blue-400 bg-blue-50/50 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center">
                    {EVENT_TYPE_ICON[e.eventType] ?? <Pin className="h-5 w-5 text-gray-400" />}
                  </span>
                  <h3 className="font-semibold">{e.title}</h3>
                </div>
                <p className="mt-1 text-sm text-blue-700">
                  {e.dateISO
                    ? new Date(e.dateISO + "T00:00:00").toLocaleDateString(
                        fr ? "fr-FR" : "fr-HT",
                        { weekday: "long", day: "numeric", month: "long", year: "numeric" },
                      )
                    : (fr ? "Date à confirmer" : "Dat pou konfime")}
                  {e.endDateISO &&
                    ` — ${new Date(e.endDateISO + "T00:00:00").toLocaleDateString(
                      fr ? "fr-FR" : "fr-HT",
                      { day: "numeric", month: "long" },
                    )}`}
                </p>
                {e.notes && (
                  <p className="mt-1 text-sm text-gray-600">{e.notes}</p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                  {e.institution && <span>{e.institution}</span>}
                  {e.level && (
                    <span>
                      • {Array.isArray(e.level) ? e.level.join(", ") : e.level}
                    </span>
                  )}
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
                      <Paperclip className="mr-0.5 inline h-3 w-3" />
                      {src.label}
                    </a>
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <DeadlineBadge
                    dateISO={e.dateISO}
                    windowDays={14}
                    lang={lang}
                    prefix={{ fr: "Événement", ht: "Evènman" }}
                  />
                  <MetaBadges
                    verifiedAt={e.verifiedAt as any}
                    updatedAt={e.updatedAt as any}
                    lang={lang}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* International scholarship deadlines */}
      {filteredIntl.length > 0 && (
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-emerald-800">
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
              <Globe className="h-3 w-3" /> International
            </span>
            {fr ? "Bourses internationales — Dates limites" : "Bous entènasyonal — Dat limit"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {filteredIntl.map((s) => {
              const dateObj = s.dateISO
                ? new Date(s.dateISO + "T00:00:00")
                : null;
              return (
                <div
                  key={s.id}
                  className="rounded-lg border-l-4 border-amber-400 bg-amber-50/50 p-4"
                >
                  <h3 className="font-semibold text-gray-900">{s.name}</h3>
                  {dateObj && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-amber-700">
                      <Clock className="h-3.5 w-3.5" />
                      {dateObj.toLocaleDateString(fr ? "fr-FR" : "fr-HT", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  {s.eligibility && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                      {s.eligibility}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                    <span>{s.countryFlag} {s.countryLabel}</span>
                  </div>
                  <div className="mt-1">
                    <DeadlineBadge
                      dateISO={s.dateISO}
                      windowDays={30}
                      lang={lang}
                    />
                  </div>
                  {s.howToApplyUrl && (
                    <a
                      href={s.howToApplyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {fr ? "Postuler →" : "Aplike →"}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {filteredHaiti.length === 0 && filteredIntl.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 text-center text-gray-400">
          <CalendarDays className="mx-auto mb-2 h-8 w-8" />
          <p>{fr ? "Aucun événement pour ce filtre." : "Pa gen evènman pou filt sa a."}</p>
        </div>
      )}
    </div>
  );
}
