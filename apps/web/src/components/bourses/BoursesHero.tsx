/**
 * BoursesHero — Editorial hero for the /bourses page.
 *
 * Inspired by the "Architecture of Global Opportunity" reference design.
 * Shows a large headline, descriptive paragraph, and a live-stats callout.
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
    <section className="-mx-4 sm:-mx-6 lg:-mx-8 border-b border-stone-200/60 bg-gradient-to-br from-indigo-50/60 via-white to-white dark:from-indigo-950/20 dark:via-stone-950 dark:to-stone-950 dark:border-stone-800/60">
      <div className="px-4 sm:px-6 lg:px-8 pb-12 pt-10 sm:pb-14 sm:pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          {/* ── Left: Headline + Description ── */}
          <div className="lg:col-span-8 space-y-5">
            <span className="inline-block px-3 py-1 bg-stone-200/60 dark:bg-stone-800/60 text-stone-500 dark:text-stone-400 text-[10px] uppercase tracking-[0.2em] font-bold rounded-md">
              {fr ? "Intelligence académique" : "Entèlijans akademik"}
            </span>

            <h1 className="font-serif text-4xl sm:text-5xl leading-[1.1] font-extrabold tracking-tight text-stone-900 dark:text-white">
              {fr ? (
                <>L&apos;architecture de <br /><span className="text-brand-600 dark:text-brand-400 italic">l&apos;opportunité mondiale.</span></>
              ) : (
                <>Achitekti <br /><span className="text-brand-600 dark:text-brand-400 italic">opòtinite mondyal la.</span></>
              )}
            </h1>

            <p className="text-base sm:text-lg text-stone-500 dark:text-stone-400 leading-relaxed max-w-2xl font-light">
              {fr
                ? "Intelligence curatée sur les financements académiques et professionnels à enjeux élevés. Nous suivons les flux de capitaux qui façonnent la prochaine génération de leaders mondiaux, de pionniers de la recherche et d\u2019architectes des politiques."
                : "Entèlijans kirye sou finansman akademik ak pwofesyonèl ki gen gwo enjè. Nou swiv fliks kapital ki fòme pwochen jenerasyon lidè mondyal, pyonye rechèch ak achitèk politik yo."}
            </p>
          </div>

          {/* ── Right: Live stats callout ── */}
          <div className="lg:col-span-4 lg:text-right">
            <div className="inline-flex flex-col gap-2 border-l-4 border-brand-600 dark:border-brand-400 pl-5 text-left">
              <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-[0.15em]">
                {fr ? "Mises à jour" : "Mizajou"}
              </span>
              <span className="text-3xl font-serif font-extrabold text-stone-900 dark:text-white tabular-nums">
                {totalCount}+
              </span>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {fr ? "bourses suivies ce trimestre" : "bous ki suiv trimès sa a"}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 lg:max-w-[260px] lg:ml-auto">
              <div className="rounded-xl border border-stone-200/80 dark:border-stone-700/60 bg-white/70 dark:bg-stone-900/60 p-3">
                <p className="text-xl font-extrabold tabular-nums text-brand-600 dark:text-brand-400">
                  {closingSoonCount}
                </p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  {fr ? "closing soon" : "k ap fèmen"}
                </p>
              </div>
              <div className="rounded-xl border border-stone-200/80 dark:border-stone-700/60 bg-white/70 dark:bg-stone-900/60 p-3">
                <p className="text-xl font-extrabold tabular-nums text-brand-600 dark:text-brand-400">
                  {countryCount}
                </p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">
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
