/**
 * BoursesHero — Editorial hero for the /bourses page.
 *
 * Redesigned for the warm-surface M3 system: #fff8f5 canvas,
 * Manrope display headline, indigo pill badge, and stat boxes
 * with subtle ambient shadows.
 */

import type { ContentLanguage } from "@edlight-news/types";

interface BoursesHeroProps {
  lang: ContentLanguage;
  totalCount: number;
  closingSoonCount: number;
  countryCount: number;
}

export function BoursesHero({
  lang,
  totalCount,
  closingSoonCount,
  countryCount,
}: BoursesHeroProps) {
  const fr = lang === "fr";

  return (
    <section className="-mx-4 sm:-mx-6 lg:-mx-8 border-b border-[#c7c4d8]/15 bg-gradient-to-br from-[#f0edff]/60 via-[#fff8f5] to-[#fff8f5] dark:from-indigo-950/20 dark:via-stone-950 dark:to-stone-950">
      <div className="px-4 sm:px-6 lg:px-8 pb-12 pt-10 sm:pb-14 sm:pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          {/* ── Left: Headline + Description ── */}
          <div className="lg:col-span-8 space-y-5">
            <span className="inline-block px-3 py-1 bg-[#0051d5] text-white text-[10px] uppercase tracking-[0.2em] font-bold rounded-full">
              {fr ? "Verified Opportunities" : "Opòtinite verifye"}
            </span>

            <h1 className="text-4xl sm:text-5xl leading-[1.1] font-extrabold tracking-tighter font-display text-[#1d1b1a] dark:text-white">
              {fr ? (
                <>L&apos;architecture de <br /><span className="text-[#3525cd] dark:text-[#c3c0ff] italic">l&apos;opportunité mondiale.</span></>
              ) : (
                <>Achitekti <br /><span className="text-[#3525cd] dark:text-[#c3c0ff] italic">opòtinite mondyal la.</span></>
              )}
            </h1>

            <p className="text-base sm:text-lg text-[#464555] dark:text-stone-400 leading-relaxed max-w-2xl font-light">
              {fr
                ? "Intelligence curatée sur les financements académiques et professionnels à enjeux élevés. Nous suivons les flux de capitaux qui façonnent la prochaine génération de leaders mondiaux, de pionniers de la recherche et d\u2019architectes des politiques."
                : "Entèlijans kirye sou finansman akademik ak pwofesyonèl ki gen gwo enjè. Nou swiv fliks kapital ki fòme pwochen jenerasyon lidè mondyal, pyonye rechèch ak achitèk politik yo."}
            </p>
          </div>

          {/* ── Right: Live stats callout ── */}
          <div className="lg:col-span-4 lg:text-right">
            <div className="inline-flex flex-col gap-2 border-l-4 border-[#316bf3] dark:border-[#c3c0ff] pl-5 text-left">
              <span className="text-[10px] font-bold text-[#0051d5] dark:text-[#b4c5ff] uppercase tracking-[0.15em]">
                {fr ? "Mises à jour" : "Mizajou"}
              </span>
              <span className="text-3xl font-extrabold text-[#1d1b1a] dark:text-white tabular-nums">
                {totalCount}+
              </span>
              <span className="text-xs text-[#474948] dark:text-stone-400">
                {fr ? "bourses suivies ce trimestre" : "bous ki suiv trimès sa a"}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:max-w-[260px] lg:ml-auto">
              <div className="rounded-xl border border-[#c7c4d8]/20 bg-white/80 dark:bg-stone-900/60 p-3 shadow-[0_20px_40px_rgba(29,27,26,0.03)]">
                <p className="text-xl font-extrabold tabular-nums text-[#3525cd] dark:text-[#c3c0ff]">
                  {closingSoonCount}
                </p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#474948] dark:text-stone-500">
                  {fr ? "closing soon" : "k ap fèmen"}
                </p>
              </div>
              <div className="rounded-xl border border-[#c7c4d8]/20 bg-white/80 dark:bg-stone-900/60 p-3 shadow-[0_20px_40px_rgba(29,27,26,0.03)]">
                <p className="text-xl font-extrabold tabular-nums text-[#3525cd] dark:text-[#c3c0ff]">
                  {countryCount}
                </p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[#474948] dark:text-stone-500">
                  {fr ? "pays couverts" : "peyi kouvri"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
