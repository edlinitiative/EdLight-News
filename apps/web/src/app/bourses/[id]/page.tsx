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
  ListChecks,
  Layers,
  ArrowUpRight,
  Repeat,
} from "lucide-react";
import Link from "next/link";
import { getLangFromSearchParams } from "@/lib/content";
import { fetchScholarship, COUNTRY_LABELS } from "@/lib/datasets";
import { CountryFlag } from "@/components/CountryFlag";
import { MetaBadges } from "@/components/MetaBadges";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { getDeadlineStatus } from "@/lib/ui/deadlines";
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
          <h1 className="text-2xl font-extrabold tracking-tight">
            {isDirectory && <FolderOpen className="mr-1.5 inline h-6 w-6 text-indigo-500" />}
            {!isDirectory && <GraduationCap className="mr-1.5 inline h-6 w-6 text-blue-600" />}
            {s.name}
          </h1>
          {cl && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
              {cl.flag && <CountryFlag code={cl.flag} />} {fr ? cl.fr : cl.ht}
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
        {s.recurring && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            <Repeat className="h-4 w-4" /> {fr ? "Bourse récurrente" : "Bous repetitif"}
          </span>
        )}
      </div>

      {/* Hero image (optional) */}
      {s.heroImageUrl && (
        <figure className="overflow-hidden rounded-lg border dark:border-stone-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={s.heroImageUrl}
            alt={s.name}
            className="h-56 w-full object-cover sm:h-72"
            loading="lazy"
          />
          {s.gallery?.[0]?.credit && (
            <figcaption className="bg-stone-50 dark:bg-stone-800 px-3 py-1 text-xs text-stone-500 dark:text-stone-400">
              {s.gallery[0].credit}
            </figcaption>
          )}
        </figure>
      )}

      {/* Internal related page CTA (e.g. UWC Haiti) */}
      {s.relatedPagePath && (
        <Link
          href={`${s.relatedPagePath}${lang !== "fr" ? `?lang=${lang}` : ""}`}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2 text-sm font-semibold text-indigo-800 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
        >
          <ArrowUpRight className="h-4 w-4" />
          {fr ? "Voir notre page dédiée sur EdLight News" : "Wè paj dedye nou an sou EdLight News"}
        </Link>
      )}

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

          {/* Long-form program description */}
          {s.programDescription && (
            <div className="rounded-lg border dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/50 p-4">
              <h2 className="text-lg font-bold">{fr ? "À propos du programme" : "Konsènan pwogram nan"}</h2>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                {s.programDescription}
              </p>
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

          {/* Sub-programmes */}
          {s.subPrograms && s.subPrograms.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Layers className="h-5 w-5 text-indigo-600" />
                {fr ? "Sous-programmes et options" : "Sou-pwogram ak opsyon"}
              </h2>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {s.subPrograms.map((sp, i) => (
                  <div
                    key={i}
                    className="rounded-lg border dark:border-stone-700 bg-white dark:bg-stone-800 p-3"
                  >
                    <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">{sp.name}</h3>
                    <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">{sp.description}</p>
                    {sp.eligibility && (
                      <p className="mt-1 text-xs italic text-stone-500 dark:text-stone-400">
                        {fr ? "Éligibilité : " : "Kondisyon : "}
                        {sp.eligibility}
                      </p>
                    )}
                    {sp.level && sp.level.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {sp.level.map((l) => {
                          const lbl = LEVEL_LABELS[l];
                          return (
                            <span key={l} className="rounded bg-stone-100 dark:bg-stone-700 px-1.5 py-0.5 text-[10px] text-stone-700 dark:text-stone-300">
                              {lbl ? (fr ? lbl.fr : lbl.ht) : l}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sp.relatedPagePath && (
                        <Link
                          href={`${sp.relatedPagePath}${lang !== "fr" ? `?lang=${lang}` : ""}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-300"
                        >
                          <ArrowUpRight className="h-3 w-3" />
                          {fr ? "Page EdLight" : "Paj EdLight"}
                        </Link>
                      )}
                      {sp.url && (
                        <a
                          href={sp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {fr ? "Site officiel" : "Sit ofisyèl"}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Application steps */}
          {s.applicationSteps && s.applicationSteps.length > 0 && (
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ListChecks className="h-5 w-5 text-emerald-600" />
                {fr ? "Comment postuler" : "Kijan pou aplike"}
              </h2>
              <ol className="mt-2 space-y-3">
                {s.applicationSteps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">{step.title}</p>
                      <p className="mt-0.5 text-sm text-stone-600 dark:text-stone-400">{step.description}</p>
                      {step.url && (
                        <a
                          href={step.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {fr ? "Lien" : "Lyen"}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Key dates timeline */}
          {s.keyDates && s.keyDates.length > 0 && (
            <div className="rounded-lg border dark:border-stone-700 bg-amber-50/40 dark:bg-amber-900/10 p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <CalendarDays className="h-5 w-5 text-amber-700" />
                {fr ? "Calendrier type" : "Kalandriye tip"}
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {s.keyDates.map((kd, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                    <div>
                      <span className="font-semibold text-stone-800 dark:text-stone-200">{kd.label}</span>
                      <span className="text-stone-600 dark:text-stone-400">
                        {" — "}
                        {kd.dateISO ? formatDate(kd.dateISO, lang) : kd.monthRange ?? ""}
                      </span>
                      {kd.notes && (
                        <p className="text-xs italic text-stone-500 dark:text-stone-400">{kd.notes}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
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

          {/* Gallery (skip first image if it was used as hero) */}
          {s.gallery && s.gallery.length > (s.heroImageUrl ? 1 : 0) && (
            <div>
              <h2 className="text-lg font-bold">{fr ? "Galerie" : "Galri"}</h2>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {s.gallery.slice(s.heroImageUrl ? 1 : 0).map((img, i) => (
                  <figure key={i} className="overflow-hidden rounded-lg border dark:border-stone-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.caption ?? `${s.name} — ${i + 1}`}
                      className="h-32 w-full object-cover"
                      loading="lazy"
                    />
                    {(img.caption || img.credit) && (
                      <figcaption className="bg-stone-50 dark:bg-stone-800 px-2 py-1 text-[10px] text-stone-500 dark:text-stone-400">
                        {img.caption}
                        {img.caption && img.credit ? " — " : ""}
                        {img.credit}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
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
          <div className="mt-2 space-y-1">
            <DeadlineBadge item={{ deadline: s.deadline }} lang={lang} />
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {getDeadlineStatus(s.deadline.dateISO, lang).humanLine}
            </p>
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
