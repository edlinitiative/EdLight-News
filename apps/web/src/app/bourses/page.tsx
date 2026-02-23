/**
 * /bourses — Scholarship database page.
 *
 * Server component: fetches all scholarships eligible for Haitian students.
 * Shows cards with funding type, deadlines, and application links.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { GraduationCap, Clock, CalendarDays, BookOpen, CheckCircle, Paperclip } from "lucide-react";
import { getLangFromSearchParams } from "@/lib/content";
import {
  fetchScholarshipsForHaiti,
  fetchScholarshipsClosingSoon,
  COUNTRY_LABELS,
} from "@/lib/datasets";
import { MetaBadges } from "@/components/MetaBadges";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { ReportIssueButton } from "@/components/ReportIssueButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bourses | EdLight News",
  description: "Bourses et opportunités pour étudiants haïtiens",
};

function formatDate(iso: string, lang: ContentLanguage): string {
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

const FUNDING_LABELS: Record<string, { fr: string; ht: string; color: string }> = {
  full: { fr: "Bourse complète", ht: "Bous konplè", color: "bg-green-100 text-green-800" },
  partial: { fr: "Partielle", ht: "Pasyèl", color: "bg-yellow-100 text-yellow-800" },
  stipend: { fr: "Allocation", ht: "Alokasyon", color: "bg-blue-100 text-blue-800" },
  "tuition-only": { fr: "Scolarité seulement", ht: "Frè etid sèlman", color: "bg-purple-100 text-purple-800" },
  unknown: { fr: "Variable", ht: "Varyab", color: "bg-gray-100 text-gray-800" },
};

export default async function BoursesPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";

  const [allScholarships, closingSoon] = await Promise.all([
    fetchScholarshipsForHaiti(),
    fetchScholarshipsClosingSoon(60),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <GraduationCap className="mr-1.5 inline h-7 w-7 text-amber-600" /> {fr ? "Bourses & Opportunités" : "Bous & Opòtinite"}
        </h1>
        <p className="text-gray-500">
          {fr
            ? `${allScholarships.length} bourses ouvertes aux étudiants haïtiens.`
            : `${allScholarships.length} bous ki ouvè pou etidyan ayisyen yo.`}
        </p>
      </div>

      {/* Closing soon banner */}
      {closingSoon.length > 0 && (
        <div className="rounded-lg border-l-4 border-orange-400 bg-orange-50 p-4">
          <h2 className="font-bold text-orange-800">
            <Clock className="mr-1 inline h-4 w-4" /> {fr ? "Date limite bientôt !" : "Dat limit byento!"}
          </h2>
          <ul className="mt-2 space-y-1">
            {closingSoon.slice(0, 5).map((s) => (
              <li key={s.id} className="text-sm text-orange-700">
                <strong>{s.name}</strong>
                {s.deadline?.dateISO && (
                  <span> — {formatDate(s.deadline.dateISO, lang)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scholarship cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allScholarships.map((s) => {
          const funding = s.fundingType ? FUNDING_LABELS[s.fundingType] : null;
          const cl = COUNTRY_LABELS[s.country];

          return (
            <div
              key={s.id}
              className="rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold leading-tight">{s.name}</h3>
                {cl && (
                  <span className="ml-2 shrink-0 text-lg" title={fr ? cl.fr : cl.ht}>
                    {cl.flag}
                  </span>
                )}
              </div>

              {/* Funding type badge */}
              {funding && (
                <span
                  className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${funding.color}`}
                >
                  {fr ? funding.fr : funding.ht}
                </span>
              )}

              {/* Description */}
              {s.eligibilitySummary && (
                <p className="mt-2 text-sm text-gray-600 line-clamp-3">
                  {s.eligibilitySummary}
                </p>
              )}

              {/* Levels */}
              {s.level && s.level.length > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  <BookOpen className="mr-0.5 inline h-3 w-3" />{s.level.join(", ")}
                </p>
              )}

              {/* Deadline */}
              {s.deadline?.dateISO && (
                <p className="mt-1 text-xs font-medium text-orange-600">
                  <CalendarDays className="mr-0.5 inline h-3 w-3" /> {fr ? "Date limite:" : "Dat limit:"}{" "}
                  {formatDate(s.deadline.dateISO, lang)}
                </p>
              )}
              {/* Urgency badge */}
              <div className="mt-1">
                <DeadlineBadge
                  dateISO={s.deadline?.dateISO}
                  windowDays={30}
                  lang={lang}
                />
              </div>

              {/* Haitian-friendly indicator */}
              {s.eligibleCountries?.includes("HT") && (
                <p className="mt-1 text-xs text-green-600">
                  <CheckCircle className="mr-0.5 inline h-3 w-3" /> {fr ? "Ouvert aux Haïtiens" : "Ouvè pou Ayisyen"}
                </p>
              )}

              {/* Tags */}
              {s.tags && s.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Action links */}
              <div className="mt-3 flex gap-2">
                {s.howToApplyUrl && (
                  <a
                    href={s.howToApplyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    {fr ? "Postuler →" : "Aplike →"}
                  </a>
                )}
                {s.officialUrl && (
                  <a
                    href={s.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-gray-500 hover:underline"
                  >
                    {fr ? "Site officiel →" : "Sit ofisyèl →"}
                  </a>
                )}
                {s.deadline?.sourceUrl && (
                  <a
                    href={s.deadline.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-orange-500 hover:underline"
                  >
                    {fr ? "Source deadline →" : "Sous dat limit →"}
                  </a>
                )}
              </div>
              {/* Sources */}
              {s.sources && s.sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.sources.map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-blue-600 hover:underline"
                    >
                      <Paperclip className="mr-0.5 inline h-3 w-3" />{src.label}
                    </a>
                  ))}
                </div>
              )}
              {/* Trust badges */}
              <div className="mt-2 flex items-center justify-between">
                <MetaBadges
                  verifiedAt={s.verifiedAt}
                  updatedAt={s.updatedAt}
                  lang={lang}
                />
                <ReportIssueButton itemId={s.id} lang={lang} />
              </div>
            </div>
          );
        })}
      </div>

      {allScholarships.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-24 text-center text-gray-400">
          <p className="text-lg font-medium">
            {fr ? "Base de données en construction…" : "Baz done an konstriksyon…"}
          </p>
        </div>
      )}
    </div>
  );
}
