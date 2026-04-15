/**
 * HistoryHero — immersive editorial hero for /histoire.
 *
 * Layout:
 *   Top: serif headline + description (left) + stat cards (right)
 *   Bottom: full-width cinematic image with gradient overlay + featured content
 */

import { ArrowRight } from "lucide-react";

interface HeroStat {
  value: string;
  label: string;
  sublabel: string;
}

interface HeroContent {
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  headlineSuffix: string;
  description: string;
  heroImageUrl: string;
  heroImageAlt: string;
  heroBadge: string;
  heroTitle: string;
  heroDescription: string;
  heroMeta: string;
}

interface HistoryHeroProps {
  content: HeroContent;
  stats: readonly HeroStat[];
}

const STAT_ACCENT_COLORS = [
  "text-[#3525cd] dark:text-indigo-400",
  "text-[#6f2438] dark:text-rose-400",
  "text-[#9a7a2f] dark:text-amber-400",
];

export function HistoryHero({ content, stats }: HistoryHeroProps) {
  return (
    <section id="hero" className="space-y-12 pt-8 md:space-y-16 md:pt-14">
      {/* ── Headline + Stats Grid ─────────────────────────── */}
      <div className="grid grid-cols-1 items-end gap-10 xl:grid-cols-12 xl:gap-14">
        <div className="xl:col-span-7">
          <span className="mb-6 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f2438] dark:text-rose-400">
            <span className="h-px w-8 bg-[#6f2438]/60 dark:bg-rose-400/60" />
            {content.eyebrow}
          </span>
          <h1 className="mb-6 font-serif text-5xl leading-[0.92] text-[#1d1b1a] dark:text-white md:text-7xl xl:text-8xl">
            {content.headline}
            <br />
            <span className="italic text-[#6f2438] dark:text-rose-400">
              {content.headlineAccent}
            </span>{" "}
            {content.headlineSuffix}
          </h1>
          <p className="max-w-2xl text-base leading-8 text-[#464555] dark:text-stone-400 md:text-lg">
            {content.description}
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
        <img
          src={content.heroImageUrl}
          alt={content.heroImageAlt}
          className="absolute inset-0 h-full w-full object-cover grayscale-[0.15] transition-transform duration-1000 hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#1d1b1a]/80 via-[#1d1b1a]/45 to-[#1d1b1a]/10" />

        <div className="relative z-10 flex h-full min-h-[520px] flex-col justify-end p-8 md:p-12 lg:p-14">
          <div className="max-w-3xl">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white">
              <span className="h-2 w-2 rounded-full bg-[#e8d39b]" />
              {content.heroBadge}
            </span>
            <h2 className="mb-4 font-serif text-4xl leading-[0.96] text-white md:text-5xl lg:text-6xl">
              {content.heroTitle}
            </h2>
            <p className="mb-8 max-w-2xl text-base leading-8 text-white/82 md:text-lg">
              {content.heroDescription}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-semibold text-[#1d1b1a] transition-colors hover:bg-[#f3ecea]">
                Explorer le document d&apos;archive
                <ArrowRight className="h-4 w-4" />
              </button>
              <span className="text-sm uppercase tracking-[0.22em] text-white/75">
                {content.heroMeta}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
