/**
 * /bourses/etudier/[pays] — "Étudier à l'étranger" country guide.
 *
 * The SEO/owned backbone for the scholarship strategy: one page per destination
 * (France, USA, Chine, Russie, Canada, Rép. Dominicaine) that answers "how do I
 * study there as a Haitian?" — why, language, cost, a live list of that
 * country's scholarships (pulled from the dataset), how to apply, and a FAQ.
 *
 * The carousel generator (worker) reuses the same COUNTRY_GUIDES context so a
 * social post and this page always tell the same story.
 */

import type { Metadata } from "next";
import type { ContentLanguage, Scholarship } from "@edlight-news/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Globe,
  Wallet,
  Languages,
  ListChecks,
  CalendarClock,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import { getLangFromSearchParams } from "@/lib/content";
import { fetchScholarshipsForHaiti } from "@/lib/datasets";
import { COUNTRY_GUIDES, getCountryGuide } from "@/lib/bourses/countryGuides";
import { buildOgMetadata } from "@/lib/og";
import { getDeadlineStatus, formatDeadlineDateShort } from "@/lib/ui/deadlines";
import { fundingLabel, levelText } from "@/lib/bourses/labels";

export const revalidate = 300;

/** French/Creole "study in X" prepositional phrase (varies per country). */
const STUDY_IN: Record<string, { fr: string; ht: string }> = {
  france: { fr: "en France", ht: "an Frans" },
  usa: { fr: "aux États-Unis", ht: "Ozetazini" },
  chine: { fr: "en Chine", ht: "an Chin" },
  russie: { fr: "en Russie", ht: "an Risi" },
  canada: { fr: "au Canada", ht: "nan Kanada" },
  "republique-dominicaine": { fr: "en République Dominicaine", ht: "nan Repiblik Dominikèn" },
};

export function generateStaticParams() {
  return COUNTRY_GUIDES.map((g) => ({ pays: g.slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { pays: string };
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const guide = getCountryGuide(params.pays);
  if (!guide) return { title: "Guide introuvable" };
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const inCountry = STUDY_IN[guide.slug] ?? { fr: guide.name.fr, ht: guide.name.ht };
  const title = fr
    ? `Étudier ${inCountry.fr} depuis Haïti — bourses 2026 | Bourses`
    : `Etidye ${inCountry.ht} depi Ayiti — bous 2026 | Bous`;
  const description = fr ? guide.hook.fr : guide.hook.ht;
  return {
    title,
    ...buildOgMetadata({ title, description, path: `/bourses/etudier/${guide.slug}`, lang }),
  };
}

/** Eligible first, then closing-soonest, then fully-funded first. */
function sortForGuide(a: Scholarship, b: Scholarship): number {
  const elig = (s: Scholarship) => (s.haitianEligibility === "yes" ? 0 : 1);
  if (elig(a) !== elig(b)) return elig(a) - elig(b);
  const aISO = a.deadline?.dateISO ?? "";
  const bISO = b.deadline?.dateISO ?? "";
  if (aISO && bISO && aISO !== bISO) return aISO.localeCompare(bISO);
  if (aISO && !bISO) return -1;
  if (!aISO && bISO) return 1;
  const order: Record<string, number> = { full: 0, partial: 1, stipend: 2, "tuition-only": 3, unknown: 4 };
  return (order[a.fundingType] ?? 4) - (order[b.fundingType] ?? 4);
}

export default async function CountryGuidePage({
  params,
  searchParams,
}: {
  params: { pays: string };
  searchParams: { lang?: string };
}) {
  const guide = getCountryGuide(params.pays);
  if (!guide) notFound();

  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";
  const L = <T,>(v: { fr: T; ht: T }) => (fr ? v.fr : v.ht);
  const inCountry = STUDY_IN[guide.slug] ?? guide.name;
  const q = lang !== "fr" ? `?lang=${lang}` : "";

  let all: Scholarship[] = [];
  try {
    all = await fetchScholarshipsForHaiti();
  } catch (err) {
    console.error("[EdLight] country guide fetch failed:", err);
  }
  const scholarships = all.filter((s) => s.country === guide.country).sort(sortForGuide);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faq.map((f) => ({
      "@type": "Question",
      name: L(f.q),
      acceptedAnswer: { "@type": "Answer", text: L(f.a) },
    })),
  };

  const others = COUNTRY_GUIDES.filter((g) => g.slug !== guide.slug);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <Link
        href={`/bourses${q}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-[#3525cd] hover:underline dark:text-[#c3c0ff]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {fr ? "Retour aux bourses" : "Retounen nan bous yo"}
      </Link>

      {/* Hero */}
      <header
        className="relative overflow-hidden rounded-3xl border border-[#f3ecea] p-6 sm:p-9 dark:border-stone-800"
        style={{ background: `linear-gradient(135deg, ${guide.accent}14, transparent 60%)` }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3525cd] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white dark:bg-[#c3c0ff] dark:text-[#1d1b1a]">
          {fr ? "Étudier à l'étranger" : "Etidye aletranje"}
        </span>
        <h1 className="mt-3 font-display text-[28px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#1d1b1a] sm:text-[38px] dark:text-white">
          <span aria-hidden="true">{guide.flag}</span>{" "}
          {fr ? `Étudier ${inCountry.fr} depuis Haïti` : `Etidye ${inCountry.ht} depi Ayiti`}
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#464555] dark:text-stone-300">
          {L(guide.hook)}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[13px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f3ecea] bg-white/70 px-3 py-1.5 font-semibold text-[#1d1b1a] dark:border-stone-700 dark:bg-stone-900/60 dark:text-white">
            <Sparkles className="h-4 w-4 text-[#3525cd] dark:text-[#c3c0ff]" />
            {scholarships.length} {fr ? "bourses vérifiées" : "bous verifye"}
          </span>
        </div>
      </header>

      {/* Why */}
      <section>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[#1d1b1a] dark:text-white">
          <Globe className="h-5 w-5 text-[#3525cd] dark:text-[#c3c0ff]" />
          {fr ? `Pourquoi ${guide.name.fr}` : `Poukisa ${guide.name.ht}`}
        </h2>
        <ul className="mt-3 space-y-2">
          {L(guide.why).map((w, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[14px] leading-relaxed text-[#464555] dark:text-stone-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Quick facts: language + cost + pathway */}
      <section className="grid gap-px overflow-hidden rounded-2xl border border-[#f3ecea] bg-[#f3ecea] sm:grid-cols-2 dark:border-stone-800 dark:bg-stone-800">
        <div className="bg-white p-4 dark:bg-stone-900">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6b6563] dark:text-stone-400">
            <Languages className="h-3.5 w-3.5" /> {fr ? "Langue" : "Lang"}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#1d1b1a] dark:text-stone-100">{L(guide.language)}</p>
        </div>
        <div className="bg-white p-4 dark:bg-stone-900">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#6b6563] dark:text-stone-400">
            <Wallet className="h-3.5 w-3.5" /> {fr ? "Coût" : "Kòb"}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#1d1b1a] dark:text-stone-100">{L(guide.cost)}</p>
        </div>
      </section>

      {/* Scholarships for this country */}
      <section>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[#1d1b1a] dark:text-white">
          {guide.flag} {fr ? `Bourses pour étudier ${inCountry.fr}` : `Bous pou etidye ${inCountry.ht}`}
        </h2>
        {scholarships.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-[#e7e1de] bg-[#faf7f5] p-5 text-sm text-[#6b6563] dark:border-stone-700 dark:bg-stone-900/50 dark:text-stone-400">
            {fr
              ? "Aucune bourse spécifique à ce pays pour le moment — consultez toutes les bourses ci-dessous, elles sont mises à jour régulièrement."
              : "Pa gen bous espesifik pou peyi sa a pou kounye a — gade tout bous yo anba a, yo mete ajou regilyèman."}
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-[#f3ecea] bg-white dark:border-stone-800 dark:bg-stone-900/95">
            <ul className="divide-y divide-[#f3ecea] dark:divide-stone-800">
              {scholarships.slice(0, 12).map((s) => {
                const dl = getDeadlineStatus(s.deadline?.dateISO, lang);
                const urgent = dl.badgeVariant === "today" || dl.badgeVariant === "urgent";
                const soon = dl.badgeVariant === "soon";
                const f = fundingLabel(s.fundingType, lang);
                const lvl = levelText(s.level ?? [], lang);
                const dateShort = formatDeadlineDateShort(s.deadline?.dateISO, lang);
                return (
                  <li key={s.id}>
                    <Link
                      href={`/bourses/${s.id}${q}`}
                      className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f5f0ee]/60 dark:hover:bg-stone-800/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-display text-[14px] font-bold text-[#1d1b1a] transition-colors group-hover:text-[#3525cd] dark:text-white dark:group-hover:text-[#c3c0ff]">
                            {s.name}
                          </h3>
                          {s.haitianEligibility === "yes" && (
                            <span className="hidden shrink-0 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 sm:inline dark:text-emerald-400">
                              {fr ? "Éligible" : "Elijib"}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-[#6b6563] dark:text-stone-400">
                          {f && <span className="font-semibold text-[#464555] dark:text-stone-300">{f.text}</span>}
                          {f && lvl && <span className="text-[#c7c4d8] dark:text-stone-600">·</span>}
                          {lvl && <span className="truncate">{lvl}</span>}
                        </p>
                      </div>
                      <span
                        className={`hidden shrink-0 text-right text-[12px] font-semibold sm:block ${
                          urgent ? "text-[#93000a] dark:text-red-400" : soon ? "text-amber-700 dark:text-amber-400" : "text-[#6b6563] dark:text-stone-400"
                        }`}
                      >
                        {urgent || soon ? dl.badgeLabel : dateShort ?? ""}
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#c7c4d8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#3525cd] dark:text-stone-600 dark:group-hover:text-[#c3c0ff]" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {/* How to apply */}
      <section>
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[#1d1b1a] dark:text-white">
          <ListChecks className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          {fr ? "Comment postuler" : "Kijan pou aplike"}
        </h2>
        <ol className="mt-3 space-y-3">
          {L(guide.steps).map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#3525cd]/10 text-sm font-bold text-[#3525cd] dark:bg-[#c3c0ff]/15 dark:text-[#c3c0ff]">
                {i + 1}
              </span>
              <p className="pt-1 text-[14px] leading-relaxed text-[#464555] dark:text-stone-300">{step}</p>
            </li>
          ))}
        </ol>
        {guide.pathway && (
          <a
            href={guide.pathway.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#c7c4d8]/30 px-4 py-2.5 text-sm font-bold text-[#3525cd] transition-colors hover:bg-[#f5f0ee] dark:border-stone-700 dark:text-[#c3c0ff] dark:hover:bg-stone-800"
          >
            <ExternalLink className="h-4 w-4" />
            {guide.pathway.label}
          </a>
        )}
      </section>

      {/* FAQ */}
      {guide.faq.length > 0 && (
        <section>
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-[#1d1b1a] dark:text-white">
            <CalendarClock className="h-5 w-5 text-[#3525cd] dark:text-[#c3c0ff]" />
            {fr ? "Questions fréquentes" : "Kesyon moun poze souvan"}
          </h2>
          <div className="mt-3 space-y-2">
            {guide.faq.map((f, i) => (
              <details
                key={i}
                className="group rounded-xl border border-[#f3ecea] bg-white p-4 dark:border-stone-800 dark:bg-stone-900/60"
              >
                <summary className="cursor-pointer list-none font-semibold text-[14px] text-[#1d1b1a] marker:content-none dark:text-white">
                  {L(f.q)}
                </summary>
                <p className="mt-2 text-[13px] leading-relaxed text-[#6b6563] dark:text-stone-400">{L(f.a)}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="flex flex-wrap gap-3">
        <Link
          href={`/bourses${q}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#3525cd] px-5 py-3 text-sm font-extrabold text-white transition-colors hover:bg-[#2a1ea7] dark:bg-[#c3c0ff] dark:text-[#1d1b1a] dark:hover:bg-[#a8a3ff]"
        >
          {fr ? "Voir toutes les bourses" : "Wè tout bous yo"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Other destinations (internal links) */}
      <section className="border-t border-[#f3ecea] pt-6 dark:border-stone-800">
        <h2 className="text-[11px] font-bold uppercase tracking-wide text-[#6b6563] dark:text-stone-400">
          {fr ? "Autres destinations" : "Lòt destinasyon"}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {others.map((g) => (
            <Link
              key={g.slug}
              href={`/bourses/etudier/${g.slug}${q}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#f3ecea] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#464555] transition-colors hover:border-[#3525cd]/30 hover:text-[#3525cd] dark:border-stone-700 dark:bg-stone-900/60 dark:text-stone-300 dark:hover:text-[#c3c0ff]"
            >
              <span aria-hidden="true">{g.flag}</span> {L(g.name)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
