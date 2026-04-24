import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Scholarship } from "@edlight-news/types";
import {
  ArrowLeft,
  CheckCircle2,
  CalendarDays,
  FileCheck,
  ShieldAlert,
  ExternalLink,
  Sparkles,
  Rocket,
} from "lucide-react";
import {
  getScholarshipGuide,
  SCHOLARSHIP_GUIDES,
  type ScholarshipGuide,
} from "@/lib/scholarship-guides";
import { fetchScholarshipsForHaiti } from "@/lib/datasets";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateStaticParams() {
  return SCHOLARSHIP_GUIDES.map((g) => ({ slug: g.slug }));
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function fundingLabel(fundingType?: string): string {
  switch (fundingType) {
    case "full":
      return "Complet";
    case "partial":
      return "Partiel";
    case "stipend":
      return "Allocation";
    case "tuition-only":
      return "Frais / exemption";
    default:
      return "À vérifier";
  }
}

function levelLabel(levels: Scholarship["level"]): string {
  const map: Record<string, string> = {
    bachelor: "Bachelor",
    master: "Master",
    phd: "PhD",
    short_programs: "Programmes courts",
  };
  const labels = levels.map((l) => map[l] ?? l);
  return labels.join(" · ");
}

function buildDynamicGuide(s: Scholarship, slug: string): ScholarshipGuide {
  const timeline =
    s.keyDates && s.keyDates.length > 0
      ? s.keyDates.map((k) => ({
          phase: k.label,
          window: k.dateISO ?? k.monthRange ?? "À confirmer",
          details: k.notes ?? "Vérifier l'annonce officielle.",
        }))
      : [
          {
            phase: "Cycle candidature",
            window: s.deadline?.dateISO ?? s.deadline?.notes ?? "Variable",
            details: "Les dates évoluent chaque année. Vérifiez la source officielle.",
          },
        ];

  const steps =
    s.applicationSteps && s.applicationSteps.length > 0
      ? s.applicationSteps.map((st) => ({
          title: st.title,
          details: st.description,
          actionUrl: st.url,
        }))
      : [
          {
            title: "Vérifier l'éligibilité",
            details: s.eligibilitySummary ?? "Confirmer les critères pays/niveau avant toute candidature.",
          },
          {
            title: "Préparer le dossier",
            details: "Assembler relevés, diplômes, recommandations et preuve de langue.",
          },
          {
            title: "Soumettre via le portail officiel",
            details: "Toujours candidater depuis la source officielle du programme.",
            actionUrl: s.howToApplyUrl ?? s.officialUrl,
          },
        ];

  const documents =
    s.requirements && s.requirements.length > 0
      ? s.requirements
      : [
          "Relevés et diplômes",
          "Pièce d'identité / passeport",
          "Lettre(s) de recommandation",
          "Preuve de langue (si exigée)",
        ];

  return {
    slug,
    title: s.name,
    subtitle: "Guide dynamique généré depuis la base de bourses EdLight",
    region: s.country === "Global" ? "International" : s.country,
    level: levelLabel(s.level),
    funding: fundingLabel(s.fundingType),
    competitiveness: "Élevée",
    overview:
      s.programDescription ??
      s.eligibilitySummary ??
      "Programme en suivi continu par EdLight News pour les étudiants haïtiens.",
    whyForHaiti: [
      s.haitianEligibility === "yes"
        ? "Haïti est explicitement indiqué comme éligible."
        : "Éligibilité haïtienne à confirmer sur la source officielle.",
      "Guide mis à jour à mesure que de nouveaux contenus sont ingérés.",
      "Comparer ce guide avec d'autres options depuis /bourses/guides.",
    ],
    timeline,
    steps,
    documents,
    mistakes: [
      "Soumettre tardivement sans marge pour corrections.",
      "Utiliser des informations non-officielles au lieu du site source.",
      "Négliger la cohérence entre projet d'études et impact en Haïti.",
    ],
    officialLinks: [
      { label: "Site officiel", url: s.officialUrl },
      ...(s.howToApplyUrl ? [{ label: "Postuler", url: s.howToApplyUrl }] : []),
    ],
  };
}

async function resolveGuide(slug: string): Promise<ScholarshipGuide | undefined> {
  const staticGuide = getScholarshipGuide(slug);
  if (staticGuide) return staticGuide;

  // Dynamic fallback: auto-create guide pages from newly ingested scholarships.
  // We first match relatedPagePath, then name slug.
  const scholarships = await fetchScholarshipsForHaiti();
  const fromPath = scholarships.find((s) => s.relatedPagePath?.endsWith(`/${slug}`));
  const fromName = scholarships.find((s) => slugify(s.name) === slug);
  const match = fromPath ?? fromName;
  if (!match) return undefined;

  return buildDynamicGuide(match, slug);
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const guide = await resolveGuide(params.slug);
  if (!guide) {
    return { title: "Guide introuvable · EdLight News" };
  }

  const title = `${guide.title} · Guide Haïti · EdLight News`;
  const description = `${guide.subtitle} — stratégie candidature, calendrier, checklist et erreurs à éviter.`;
  return {
    title,
    description,
    ...buildOgMetadata({
      title,
      description,
      path: `/bourses/guides/${params.slug}`,
      lang: "fr",
    }),
  };
}

export default async function ScholarshipGuideDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const guide = await resolveGuide(params.slug);
  if (!guide) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link
        href="/bourses/guides"
        className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour aux guides
      </Link>

      <header className="rounded-2xl border border-[#c7c4d8]/20 dark:border-stone-700 bg-gradient-to-r from-indigo-50 via-white to-amber-50 dark:from-indigo-950/20 dark:via-stone-900 dark:to-amber-950/10 p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3525cd] dark:text-[#c3c0ff]">
          {guide.region} · {guide.level}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1d1b1a] dark:text-white font-display">
          {guide.title}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-[#474948] dark:text-stone-300">{guide.subtitle}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white dark:bg-stone-800 px-3 py-1 border border-[#c7c4d8]/20 dark:border-stone-700">Financement: {guide.funding}</span>
          <span className="rounded-full bg-white dark:bg-stone-800 px-3 py-1 border border-[#c7c4d8]/20 dark:border-stone-700">Compétition: {guide.competitiveness}</span>
        </div>
      </header>

      <section className="rounded-xl border border-[#c7c4d8]/20 dark:border-stone-700 p-5 bg-white dark:bg-stone-900">
        <h2 className="text-xl font-bold inline-flex items-center gap-2 text-[#1d1b1a] dark:text-white">
          <Sparkles className="h-5 w-5 text-[#3525cd] dark:text-[#c3c0ff]" /> Positionnement stratégique
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#474948] dark:text-stone-300">{guide.overview}</p>
        <ul className="mt-4 space-y-1.5 text-sm text-[#474948] dark:text-stone-300">
          {guide.whyForHaiti.map((point) => (
            <li key={point} className="inline-flex items-start gap-2 w-full">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#c7c4d8]/20 dark:border-stone-700 p-5 bg-white dark:bg-stone-900">
          <h2 className="text-lg font-bold inline-flex items-center gap-2 text-[#1d1b1a] dark:text-white">
            <CalendarDays className="h-5 w-5 text-amber-600" /> Calendrier type
          </h2>
          <ol className="mt-3 space-y-2.5 text-sm">
            {guide.timeline.map((item) => (
              <li key={`${item.phase}-${item.window}`}>
                <p className="font-semibold text-[#1d1b1a] dark:text-white">{item.phase}</p>
                <p className="text-[12px] uppercase tracking-wide text-[#0051d5] dark:text-[#b4c5ff]">{item.window}</p>
                <p className="text-[#474948] dark:text-stone-400">{item.details}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-[#c7c4d8]/20 dark:border-stone-700 p-5 bg-white dark:bg-stone-900">
          <h2 className="text-lg font-bold inline-flex items-center gap-2 text-[#1d1b1a] dark:text-white">
            <FileCheck className="h-5 w-5 text-indigo-600" /> Checklist documents
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-[#474948] dark:text-stone-300">
            {guide.documents.map((d) => (
              <li key={d} className="inline-flex items-start gap-2 w-full">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-xl border border-[#c7c4d8]/20 dark:border-stone-700 p-5 bg-white dark:bg-stone-900">
        <h2 className="text-xl font-bold inline-flex items-center gap-2 text-[#1d1b1a] dark:text-white">
          <Rocket className="h-5 w-5 text-emerald-600" /> Plan d'exécution candidature
        </h2>
        <ol className="mt-3 space-y-3">
          {guide.steps.map((step, idx) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                {idx + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-[#1d1b1a] dark:text-white">{step.title}</p>
                <p className="text-sm text-[#474948] dark:text-stone-400">{step.details}</p>
                {step.actionUrl && (
                  <a
                    href={step.actionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline dark:text-blue-300"
                  >
                    Ouvrir
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-red-200/60 dark:border-red-900/40 p-5 bg-red-50/60 dark:bg-red-950/15">
        <h2 className="text-lg font-bold inline-flex items-center gap-2 text-[#1d1b1a] dark:text-white">
          <ShieldAlert className="h-5 w-5 text-red-600" /> Erreurs à éviter
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-[#5b2a2a] dark:text-red-200">
          {guide.mistakes.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-[#c7c4d8]/20 dark:border-stone-700 p-5 bg-white dark:bg-stone-900">
        <h2 className="text-lg font-bold text-[#1d1b1a] dark:text-white">Sources officielles</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {guide.officialLinks.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-[#c7c4d8]/30 dark:border-stone-700 px-3 py-1.5 text-sm text-[#3525cd] dark:text-[#c3c0ff] hover:bg-[#f9f2f0] dark:hover:bg-stone-800"
            >
              {link.label}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
