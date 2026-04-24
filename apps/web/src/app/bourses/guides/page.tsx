import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles, BookOpenCheck } from "lucide-react";
import { SCHOLARSHIP_GUIDES } from "@/lib/scholarship-guides";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Guides Premium Bourses · EdLight News",
  description:
    "Guides premium pour étudiants haïtiens: Rhodes, Fulbright, DAAD, Erasmus, Chevening, UWC et plus.",
  ...buildOgMetadata({
    title: "Guides Premium Bourses · EdLight News",
    description:
      "Guides premium pour étudiants haïtiens: Rhodes, Fulbright, DAAD, Erasmus, Chevening, UWC et plus.",
    path: "/bourses/guides",
    lang: "fr",
  }),
};

export default function ScholarshipGuidesHubPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="rounded-2xl border border-[#c7c4d8]/20 dark:border-stone-700 bg-gradient-to-r from-indigo-50 via-white to-amber-50 dark:from-indigo-950/20 dark:via-stone-900 dark:to-amber-950/10 p-6 sm:p-8">
        <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[#3525cd] dark:text-[#c3c0ff]">
          <Sparkles className="h-3.5 w-3.5" /> Guides Premium
        </p>
        <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-[#1d1b1a] dark:text-white font-display">
          Le centre de stratégie bourses pour Haïti.
        </h1>
        <p className="mt-3 max-w-3xl text-sm sm:text-base text-[#474948] dark:text-stone-300 leading-relaxed">
          Pas seulement des liens: des playbooks complets pour candidater mieux, éviter les erreurs coûteuses,
          et améliorer votre taux d'admission sur les programmes les plus compétitifs.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SCHOLARSHIP_GUIDES.map((guide) => (
          <article
            key={guide.slug}
            className="group rounded-xl border border-[#c7c4d8]/20 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 hover:shadow-[0_20px_40px_rgba(29,27,26,0.08)] transition-all"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#0051d5] dark:text-[#b4c5ff]">
              {guide.region} · {guide.level}
            </p>
            <h2 className="mt-2 text-lg font-bold text-[#1d1b1a] dark:text-white group-hover:text-[#3525cd] dark:group-hover:text-[#c3c0ff] transition-colors">
              {guide.title}
            </h2>
            <p className="mt-1 text-sm text-[#474948] dark:text-stone-400">{guide.subtitle}</p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-full bg-[#f9f2f0] dark:bg-stone-800 px-2 py-1">Financement: {guide.funding}</span>
              <span className="rounded-full bg-[#f9f2f0] dark:bg-stone-800 px-2 py-1">Compétition: {guide.competitiveness}</span>
            </div>
            <Link
              href={`/bourses/guides/${guide.slug}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#3525cd] dark:text-[#c3c0ff] hover:underline"
            >
              Ouvrir le guide
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </article>
        ))}
      </section>

      <div className="rounded-xl border border-dashed border-[#c7c4d8]/30 dark:border-stone-700 p-4 text-xs sm:text-sm text-[#474948] dark:text-stone-400 inline-flex items-center gap-2">
        <BookOpenCheck className="h-4 w-4 text-[#3525cd] dark:text-[#c3c0ff]" />
        Nouveaux guides ajoutés en continu selon les programmes prioritaires pour les étudiants haïtiens.
      </div>
    </div>
  );
}
