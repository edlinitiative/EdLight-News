/**
 * /universites — University database page.
 *
 * Server component: fetches all universities grouped by country.
 * Shows filterable cards with admissions info, tuition bands, and tags.
 */

import type { Metadata } from "next";
import type { ContentLanguage, DatasetCountry } from "@edlight-news/types";
import { School, DollarSign, Languages, Paperclip, CheckCircle, Sparkles, Globe2 } from "lucide-react";
import { getLangFromSearchParams } from "@/lib/content";
import {
  fetchUniversitiesGrouped,
  COUNTRY_LABELS,
  TUITION_LABELS,
} from "@/lib/datasets";
import { MetaBadges } from "@/components/MetaBadges";
import Link from "next/link";

export const revalidate = 900;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  return {
    title: fr ? "Universités · EdLight News" : "Inivèsite · EdLight News",
    description: fr
      ? "Base de données d'universités pour étudiants haïtiens."
      : "Baz done inivèsite pou elèv ayisyen yo.",
  };
}

export default async function UniversitesPage({
  searchParams,
}: {
  searchParams: { lang?: string; country?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";
  const filterCountry = searchParams.country as DatasetCountry | undefined;

  let grouped: Awaited<ReturnType<typeof fetchUniversitiesGrouped>>;
  try {
    grouped = await fetchUniversitiesGrouped();
  } catch (err) {
    console.error("[EdLight] /universites fetch failed:", err);
    grouped = {};
  }

  // If a country filter is applied, only show that country
  const countries = filterCountry
    ? [filterCountry].filter((c) => grouped[c])
    : (Object.keys(grouped) as DatasetCountry[]).sort((a, b) => {
        // Show HT-friendly countries first: CA, FR, US, UK, DO, then rest
        const order: Record<string, number> = { CA: 0, FR: 1, US: 2, UK: 3, DO: 4 };
        return (order[a] ?? 99) - (order[b] ?? 99);
      });

  const totalCount = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);
  const countryCount = Object.keys(grouped).length;

  return (
    <div className="space-y-8">
      <section className="section-shell p-0">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-35" />
          <div className="pointer-events-none absolute -right-10 top-2 h-44 w-44 rounded-full bg-cyan-200/40 blur-3xl dark:bg-cyan-500/15" />
          <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                {fr ? "Annuaire premium" : "Anyè premium"}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight dark:text-white sm:text-4xl">
                <School className="mr-1.5 inline h-7 w-7 text-brand-600 dark:text-brand-400" /> {fr ? "Universités" : "Inivèsite"}
              </h1>
              <p className="text-gray-600 dark:text-slate-300">
                {fr
                  ? `${totalCount} universités dans ${countryCount} pays — filtrées pour les étudiants haïtiens.`
                  : `${totalCount} inivèsite nan ${countryCount} peyi — filtre pou etidyan ayisyen yo.`}
              </p>
            </div>
            <aside className="premium-glass p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Universités" : "Inivèsite"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Pays" : "Peyi"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{countryCount}</p>
                </div>
              </div>
              <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-slate-300">
                <Globe2 className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                {fr ? "Filtres par pays, liens d’admission et bourses" : "Filtè pa peyi, lyen admisyon ak bous"}
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* Country filter pills */}
      <div className="section-shell">
        <div className="relative z-10 flex flex-wrap gap-2">
        <Link
          href={`/universites?lang=${lang}`}
          className={`rounded-full px-3 py-1 text-sm font-medium transition ${
            !filterCountry
              ? "bg-brand-600 text-white shadow-sm"
              : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          }`}
        >
          {fr ? "Tous" : "Tout"}
        </Link>
        {(Object.keys(grouped) as DatasetCountry[]).map((c) => {
          const label = COUNTRY_LABELS[c];
          return (
            <Link
              key={c}
              href={`/universites?lang=${lang}&country=${c}`}
              className={`rounded-full px-3 py-1 text-sm font-medium transition ${
                filterCountry === c
                  ? "bg-brand-600 text-white shadow-sm"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {label?.flag} {fr ? label?.fr : label?.ht}
            </Link>
          );
        })}
        </div>
      </div>

      {/* University cards by country */}
      {countries.map((countryKey) => {
        const unis = grouped[countryKey] ?? [];
        const cl = COUNTRY_LABELS[countryKey];
        return (
          <section key={countryKey} className="section-shell space-y-4">
            <h2 className="relative z-10 text-xl font-bold tracking-tight dark:text-white">
              {cl?.flag} {fr ? cl?.fr : cl?.ht}{" "}
              <span className="text-sm font-normal text-gray-400 dark:text-slate-500">
                ({unis.length})
              </span>
            </h2>
            <div className="relative z-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {unis.map((uni) => {
                const tuition = uni.tuitionBand ? TUITION_LABELS[uni.tuitionBand] : null;
                return (
                  <div
                    key={uni.id}
                    className="premium-card p-5"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold leading-tight dark:text-white">{uni.name}</h3>
                      {uni.haitianFriendly && (
                        <span
                          className="ml-2 flex shrink-0 items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          title={fr ? "Accueil haïtien" : "Akèy ayisyen"}
                        >
                          <CheckCircle className="h-3 w-3" /> HT
                        </span>
                      )}
                    </div>
                    {uni.city && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{uni.city}</p>
                    )}
                    {tuition && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                        <DollarSign className="mr-0.5 inline h-3 w-3" />{fr ? tuition.fr : tuition.ht}
                      </p>
                    )}
                    {uni.languages && uni.languages.length > 0 && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                        <Languages className="mr-0.5 inline h-3 w-3" />{uni.languages.join(", ")}
                      </p>
                    )}
                    {uni.tags && uni.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {uni.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <a
                        href={uni.admissionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-brand-700 dark:text-brand-400 hover:underline"
                      >
                        {fr ? "Admissions →" : "Admisyon →"}
                      </a>
                      {uni.scholarshipUrl && (
                        <a
                          href={uni.scholarshipUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-green-600 dark:text-green-400 hover:underline"
                        >
                          {fr ? "Bourses →" : "Bous →"}
                        </a>
                      )}
                    </div>
                    {/* Sources */}
                    {uni.sources && uni.sources.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {uni.sources.map((src, i) => (
                          <a
                            key={i}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-brand-700 hover:underline dark:bg-slate-800/50 dark:text-slate-500 dark:hover:text-brand-400"
                          >
                            <Paperclip className="mr-0.5 inline h-3 w-3" />{src.label}
                          </a>
                        ))}
                      </div>
                    )}
                    {/* Trust badges */}
                    <div className="mt-2">
                      <MetaBadges
                        verifiedAt={uni.verifiedAt}
                        updatedAt={uni.updatedAt}
                        lang={lang}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {totalCount === 0 && (
        <div className="section-shell border-2 border-dashed py-24 text-center text-gray-400 dark:text-slate-500">
          <p className="text-lg font-medium">
            {fr ? "Base de données en construction…" : "Baz done an konstriksyon…"}
          </p>
        </div>
      )}
    </div>
  );
}
