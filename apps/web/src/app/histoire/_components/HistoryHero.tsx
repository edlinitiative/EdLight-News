"use client";

/**
 * HistoryHero — immersive editorial hero for /histoire.
 *
 * Layout:
 *   Top: serif headline + description (left) + stat cards (right)
 *   Bottom: full-width cinematic image with gradient overlay + featured content
 *
 * Fully data-driven — all content comes through props.
 */

import { ArrowRight } from "lucide-react";
import type { ContentLanguage } from "@edlight-news/types";
import type { SerializableAlmanacEntry } from "./shared";
import { useWikiImage } from "./useWikiImage";

interface HistoryHeroProps {
  lang: ContentLanguage;
  totalEvents: number;
  totalHolidays: number;
  heroEntry: SerializableAlmanacEntry | null;
  todayLabel: string; // e.g. "15 avril" — pre-formatted
}

const STAT_ACCENT_COLORS = [
  "text-[#3525cd] dark:text-indigo-400",
  "text-[#6f2438] dark:text-rose-400",
  "text-[#9a7a2f] dark:text-amber-400",
];

export function HistoryHero({
  lang,
  totalEvents,
  totalHolidays,
  heroEntry,
  todayLabel,
}: HistoryHeroProps) {
  const fr = lang === "fr";

  const { url: wikiUrl } = useWikiImage(
    heroEntry?.title_fr ?? null,
    heroEntry?.year,
  );

  // Resolve the best available image URL
  const heroIllustration =
    heroEntry?.illustration?.imageUrl &&
    (heroEntry.illustration.confidence ?? 0) >= 0.55
      ? heroEntry.illustration.imageUrl
      : wikiUrl;

  const stats = [
    {
      value: String(totalEvents),
      label: fr ? "repères historiques" : "repè istorik",
      sublabel: fr ? "Ce mois" : "Mwa sa a",
    },
    {
      value: String(totalHolidays),
      label: fr ? "fêtes & commémorations" : "fèt ak komemorasyon",
      sublabel: fr ? "Jours fériés" : "Jou ferye",
    },
    {
      value: "12",
      label: fr ? "mois explorés" : "mwa eksplore",
      sublabel: fr ? "Archive complète" : "Achiv konplè",
    },
  ];

  const eyebrow = fr ? "Éphéméride haïtienne" : "Efemerid ayisyen";
  const headline = fr ? "La mémoire" : "Memwa";
  const headlineAccent = fr ? "vivante" : "vivan";
  const headlineSuffix = fr ? "d'Haïti." : "Ayiti.";
  const description = fr
    ? "Chaque jour porte une page de l'histoire d'Haïti. Cette section transforme les dates fondatrices, les luttes, les symboles et les trajectoires nationales en une archive éditoriale plus immersive, plus lisible et plus précieuse."
    : "Chak jou pote yon paj nan istwa Ayiti. Seksyon sa a transfòme dat fondatris yo, lit yo, senbòl yo ak trajektwa nasyonal yo nan yon achiv editoryal ki pi imèsif, pi lizib e pi presye.";

  return (
    <section id="hero" className="space-y-12 pt-8 md:space-y-16 md:pt-14">
      {/* ── Headline + Stats Grid ─────────────────────────── */}
      <div className="grid grid-cols-1 items-end gap-10 xl:grid-cols-12 xl:gap-14">
        <div className="xl:col-span-7">
          <span className="mb-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f2438] dark:text-rose-400">
            <span className="h-px w-8 bg-[#6f2438]/60 dark:bg-rose-400/60" />
            {eyebrow}
          </span>
          <h1 className="mb-6 font-serif text-5xl leading-[0.92] text-[#1d1b1a] dark:text-white md:text-7xl xl:text-8xl">
            {headline}
            <br />
            <span className="italic text-[#6f2438] dark:text-rose-400">
              {headlineAccent}
            </span>{" "}
            {headlineSuffix}
          </h1>
          <p className="max-w-2xl text-base leading-8 text-[#464555] dark:text-stone-400 md:text-lg">
            {description}
          </p>
        </div>

        <div className="xl:col-span-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-1 xl:gap-5">
            {stats.map((stat, i) => (
              <div
                key={stat.sublabel}
                className="rounded-[1.25rem] border border-black/5 bg-white/90 p-5 shadow-[0_10px_30px_rgba(29,27,26,0.05)] dark:border-stone-700/40 dark:bg-stone-800/80"
              >
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.22em] text-[#464555]/70 dark:text-stone-500">
                  {stat.sublabel}
                </p>
                <div className="flex items-end gap-3">
                  <span
                    className={`font-display text-4xl font-extrabold ${STAT_ACCENT_COLORS[i % STAT_ACCENT_COLORS.length]}`}
                  >
                    {stat.value}
                  </span>
                  <span className="pb-1 text-sm text-[#464555] dark:text-stone-400">
                    {stat.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Cinematic hero image ──────────────────────────── */}
      <div className="relative min-h-[520px] overflow-hidden rounded-[1.75rem] border border-black/5 shadow-[0_20px_50px_rgba(29,27,26,0.08)] dark:border-stone-700/40">
        {heroEntry && heroIllustration ? (
          <img
            src={heroIllustration}
            alt={fr ? heroEntry.title_fr : (heroEntry.title_ht ?? heroEntry.title_fr)}
            className="absolute inset-0 h-full w-full object-cover grayscale-[0.15] transition-transform duration-1000 hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1d1b1a] via-[#2a2827] to-[#3d3835]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#1d1b1a]/80 via-[#1d1b1a]/45 to-[#1d1b1a]/10" />

        <div className="relative z-10 flex h-full min-h-[520px] flex-col justify-end p-8 md:p-12 lg:p-14">
          <div className="max-w-3xl">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              <span className="h-2 w-2 rounded-full bg-[#e8d39b]" />
              {todayLabel}
            </span>

            {heroEntry ? (
              <>
                <h2 className="mb-4 font-serif text-4xl leading-[0.96] text-white md:text-5xl lg:text-6xl">
                  {fr
                    ? heroEntry.title_fr
                    : (heroEntry.title_ht ?? heroEntry.title_fr)}
                </h2>
                <p className="mb-8 max-w-2xl text-base leading-8 text-white/82 md:text-lg">
                  {fr
                    ? heroEntry.summary_fr
                    : (heroEntry.summary_ht ?? heroEntry.summary_fr)}
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <a
                    href="#spotlight"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-[#1d1b1a] transition-colors hover:bg-[#f3ecea]"
                  >
                    {fr ? "Lire la suite" : "Li plis"}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                  <span className="text-sm uppercase tracking-[0.22em] text-white/75">
                    {heroEntry.year ?? ""} · {todayLabel}
                  </span>
                </div>
              </>
            ) : (
              <h2 className="mb-4 font-serif text-4xl leading-[0.96] text-white md:text-5xl lg:text-6xl">
                {headline}
                <br />
                <span className="italic text-[#e8d39b]">
                  {headlineAccent}
                </span>{" "}
                {headlineSuffix}
              </h2>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
