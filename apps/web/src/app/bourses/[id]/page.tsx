/**
 * /bourses/[id] — Scholarship detail page.
 *
 * For kind == "directory": uses a directory-specific tone.
 * For kind == "program" (default): standard scholarship detail.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { notFound } from "next/navigation";
import {
  GraduationCap,
  CalendarDays,
  BookOpen,
  CheckCircle,
  HelpCircle,
  FolderOpen,
  ExternalLink,
  Paperclip,
  ArrowLeft,
  Search,
  ClipboardCheck,
  Globe,
} from "lucide-react";
import Link from "next/link";
import { getLangFromSearchParams } from "@/lib/content";
import { fetchScholarship, COUNTRY_LABELS } from "@/lib/datasets";
import { MetaBadges } from "@/components/MetaBadges";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { ReportIssueButton } from "@/components/ReportIssueButton";
import { MONTH_NAMES_FR as SHARED_MONTH_NAMES_FR, formatDateLocalized } from "@/lib/dates";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const scholarship = await fetchScholarship(params.id);
  const title = scholarship ? `${scholarship.name} | Bourses | EdLight News` : "Bourse introuvable";
  return {
    title,
    ...buildOgMetadata({
      title,
      description: scholarship?.eligibilitySummary ?? "",
      path: `/bourses/${params.id}`,
    }),
  };
}

const FUNDING_LABELS: Record<string, { fr: string; ht: string; color: string }> = {
  full: { fr: "Complet", ht: "Konplè", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  partial: { fr: "Partiel", ht: "Pasyèl", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  stipend: { fr: "Partiel", ht: "Pasyèl", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  "tuition-only": { fr: "Scolarité", ht: "Frè etid sèlman", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  unknown: { fr: "Inconnu", ht: "Enkonni", color: "bg-stone-100 text-stone-800 dark:bg-stone-700 dark:text-stone-200" },
};

const LEVEL_LABELS: Record<string, { fr: string; ht: string }> = {
  bachelor: { fr: "Bachelor", ht: "Lisans" },
  master: { fr: "Master", ht: "Metriz" },
  phd: { fr: "PhD", ht: "Doktora" },
  short_programs: { fr: "Courts programmes", ht: "Pwogram kout" },
};

// Month names from shared utility
const MONTH_NAMES_FR = [...SHARED_MONTH_NAMES_FR];

// formatDate delegated to shared utility
const formatDate = (iso: string, lang: ContentLanguage) =>
  formatDateLocalized(iso, lang);

export default async function ScholarshipDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";
  const s = await fetchScholarship(params.id);

  if (!s) notFound();

  const isDirectory = s.kind === "directory";
  const funding = FUNDING_LABELS[s.fundingType];
  const cl = COUNTRY_LABELS[s.country];
  const elig = s.haitianEligibility ?? "unknown";
  const accuracy = s.deadlineAccuracy ?? (s.deadline?.dateISO ? "exact" : "unknown");

  // Deadline label
  let dlLabel: string;
  switch (accuracy) {
    case "exact":
      dlLabel = s.deadline?.dateISO
        ? `${fr ? "Date limite:" : "Dat limit:"} ${formatDate(s.deadline.dateISO, lang)}`
        : (fr ? "À confirmer" : "Pou konfime");
      break;
    case "month-only": {
      const m = s.deadline?.month;
      if (m && m >= 1 && m <= 12) {
        dlLabel = fr ? `Fin ${MONTH_NAMES_FR[m]} (à confirmer)` : `Fen ${MONTH_NAMES_FR[m]} (pou konfime)`;
      } else {
        dlLabel = s.deadline?.notes ?? (fr ? "À confirmer" : "Pou konfime");
      }
      break;
    }
    case "varies":
      dlLabel = fr ? "Délais variables (voir source)" : "Dat limit varyab (wè sous)";
      break;
    default:
      dlLabel = fr ? "À confirmer" : "Pou konfime";
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Back link */}
      <Link
        href={`/bourses${lang !== "fr" ? `?lang=${lang}` : ""}`}
        className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {fr ? "Retour aux bourses" : "Retounen nan bous yo"}
      </Link>

      {/* Title + Country */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="font-serif text-2xl font-bold tracking-tight">
            {isDirectory && <FolderOpen className="mr-1.5 inline h-6 w-6 text-indigo-500" />}
            {!isDirectory && <GraduationCap className="mr-1.5 inline h-6 w-6 text-blue-600" />}
            {s.name}
          </h1>
          {cl && (
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {cl.flag} {fr ? cl.fr : cl.ht}
            </p>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {funding && (
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${funding.color}`}>
            {fr ? funding.fr : funding.ht}
          </span>
        )}
        {elig === "yes" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-sm font-medium text-green-700 dark:bg-green-900/20 dark:text-green-300">
            <CheckCircle className="h-4 w-4" /> {fr ? "Haïti: Oui" : "Ayiti: Wi"}
          </span>
        )}
        {elig === "unknown" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            <HelpCircle className="h-4 w-4" /> {fr ? "Haïti: À confirmer" : "Ayiti: Pou konfime"}
          </span>
        )}
        {isDirectory && (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
            <FolderOpen className="h-4 w-4" /> {fr ? "Répertoire" : "Repètwa"}
          </span>
        )}
      </div>

      {/* ── Directory-specific content ─────────────────────────────── */}
      {isDirectory && (
        <div className="space-y-6 rounded-lg border dark:border-stone-700 bg-indigo-50/30 dark:bg-indigo-900/10 p-6">
          {/* What is this directory */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-indigo-800">
              <Globe className="h-5 w-5" />
              {fr ? "À quoi sert ce répertoire" : "Ki sa repètwa sa a ye"}
            </h2>
            <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">
              {s.eligibilitySummary ?? (fr
                ? "Cette page officielle regroupe plusieurs bourses et programmes. Consultez-la régulièrement pour découvrir les opportunités disponibles."
                : "Paj ofisyèl sa a regwoupe plizyè bous ak pwogram. Tcheke li regilyèman pou dekouvri opòtinite ki disponib.")}
            </p>
          </section>

          {/* How to search effectively */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-indigo-800">
              <Search className="h-5 w-5" />
              {fr ? "Comment chercher efficacement" : "Kijan pou chèche byen"}
            </h2>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-stone-700 dark:text-stone-300">
              {fr ? (
                <>
                  <li>Utilisez les filtres de la page officielle (pays, niveau d&apos;études, domaine).</li>
                  <li>Vérifiez chaque programme individuellement pour les critères d&apos;éligibilité.</li>
                  <li>Notez les dates limites — elles varient par programme.</li>
                  <li>Revenez régulièrement : de nouvelles bourses sont ajoutées fréquemment.</li>
                </>
              ) : (
                <>
                  <li>Sèvi ak filtè yo sou paj ofisyèl la (peyi, nivo etid, domèn).</li>
                  <li>Verifye chak pwogram endividyèlman pou kritè elijibilite yo.</li>
                  <li>Note dat limit yo — yo varye pa pwogram.</li>
                  <li>Retounen regilyèman: nouvo bous ajoute souvan.</li>
                </>
              )}
            </ul>
          </section>

          {/* Where to verify criteria */}
          <section>
            <h2 className="flex items-center gap-2 text-lg font-bold text-indigo-800">
              <ClipboardCheck className="h-5 w-5" />
              {fr ? "Où vérifier les critères" : "Ki kote pou verifye kritè yo"}
            </h2>
            <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">
              {fr
                ? "Consultez toujours la source officielle ci-dessous pour les informations les plus récentes et les critères exacts."
                : "Toujou konsilte sous ofisyèl la anba a pou enfòmasyon ki pi resan ak kritè egzak yo."}
            </p>
          </section>

          {/* Strong CTA */}
          <a
            href={s.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
          >
            <ExternalLink className="h-4 w-4" />
            {fr ? "Consulter la source officielle" : "Wè sous ofisyèl la"}
          </a>
        </div>
      )}

      {/* ── Program-specific content ───────────────────────────────── */}
      {!isDirectory && (
        <div className="space-y-4">
          {/* Description */}
          {s.eligibilitySummary && (
            <div>
              <h2 className="text-lg font-bold">{fr ? "Description" : "Deskripsyon"}</h2>
              <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">{s.eligibilitySummary}</p>
            </div>
          )}

          {/* Levels */}
          {s.level.length > 0 && (
            <div>
              <h2 className="text-lg font-bold">{fr ? "Niveaux" : "Nivo"}</h2>
              <div className="mt-1 flex flex-wrap gap-2">
                {s.level.map((l) => {
                  const lbl = LEVEL_LABELS[l];
                  return (
                    <span key={l} className="rounded bg-stone-100 dark:bg-stone-700 px-2 py-0.5 text-sm text-stone-700 dark:text-stone-300">
                      <BookOpen className="mr-0.5 inline h-3.5 w-3.5" />
                      {lbl ? (fr ? lbl.fr : lbl.ht) : l}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Requirements */}
          {s.requirements && s.requirements.length > 0 && (
            <div>
              <h2 className="text-lg font-bold">{fr ? "Conditions" : "Kondisyon"}</h2>
              <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-stone-700 dark:text-stone-300">
                {s.requirements.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action links */}
          <div className="flex flex-wrap gap-3">
            {s.howToApplyUrl && (
              <a
                href={s.howToApplyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-4 py-2 text-sm font-bold text-white hover:bg-stone-800 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
              >
                {fr ? "Postuler →" : "Aplike →"}
              </a>
            )}
            {s.officialUrl && (
              <a
                href={s.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border dark:border-stone-700 px-4 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {fr ? "Site officiel" : "Sit ofisyèl"}
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── Shared sections ────────────────────────────────────────── */}

      {/* Deadline */}
      <div className="rounded-lg border dark:border-stone-700 bg-blue-50/50 dark:bg-blue-900/20 p-4">
        <h3 className="font-bold text-blue-800 dark:text-blue-300">
          <CalendarDays className="mr-1 inline h-4 w-4" />
          {fr ? "Échéances" : "Dat limit"}
        </h3>
        <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">{dlLabel}</p>
        {s.deadline?.dateISO && accuracy === "exact" && (
          <div className="mt-2">
            <DeadlineBadge item={{ deadline: s.deadline }} lang={lang} />
          </div>
        )}
        {s.deadline?.notes && (
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{s.deadline.notes}</p>
        )}
        {s.deadline?.sourceUrl && (
          <a
            href={s.deadline.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-blue-500 hover:underline"
          >
            {fr ? "Source de la date →" : "Sous dat la →"}
          </a>
        )}
      </div>

      {/* Tags */}
      {s.tags && s.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {s.tags.map((tag) => (
            <span key={tag} className="rounded bg-stone-100 dark:bg-stone-700 px-2 py-0.5 text-xs text-stone-600 dark:text-stone-300">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Sources */}
      {s.sources.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-stone-500 dark:text-stone-400">{fr ? "Sources" : "Sous"}</h3>
          <div className="mt-1 flex flex-wrap gap-2">
            {s.sources.map((src, i) => (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded bg-stone-50 dark:bg-stone-800 px-2 py-1 text-xs text-stone-500 dark:text-stone-400 hover:text-blue-700 hover:underline"
              >
                <Paperclip className="mr-0.5 inline h-3 w-3" /> {src.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Trust badges + report */}
      <div className="flex items-center justify-between border-t dark:border-stone-700 pt-4">
        <MetaBadges verifiedAt={s.verifiedAt} updatedAt={s.updatedAt} lang={lang} />
        <ReportIssueButton itemId={s.id} lang={lang} />
      </div>
    </div>
  );
}
