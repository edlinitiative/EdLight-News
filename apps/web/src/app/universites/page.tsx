/**
 * /universites — University database page.
 *
 * Server component: fetches all universities grouped by country.
 * Shows filterable cards with admissions info, tuition bands, and tags.
 */

import type { Metadata } from "next";
import type { ContentLanguage, DatasetCountry } from "@edlight-news/types";
import { DollarSign, Languages, Paperclip, CheckCircle, Globe2 } from "lucide-react";
import { PageHeroCompact } from "@/components/PageHeroCompact";
import { getLangFromSearchParams } from "@/lib/content";
import {
  fetchUniversitiesGrouped,
  COUNTRY_LABELS,
  TUITION_LABELS,
} from "@/lib/datasets";
import { MetaBadges } from "@/components/MetaBadges";
import { CountryFlag } from "@/components/CountryFlag";
import Link from "next/link";
import { buildOgMetadata } from "@/lib/og";
import { withLangParam } from "@/lib/utils";

export const revalidate = 900;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Universités · EdLight News" : "Inivèsite · EdLight News";
  const description = fr
    ? "Base de données d'universités pour étudiants haïtiens."
    : "Baz done inivèsite pou elèv ayisyen yo.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/universites", lang }),
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
  const l = (href: string) => withLangParam(href, lang);

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
  const haitianFriendlyCount = Object.values(grouped)
    .flat()
    .filter((uni) => uni.haitianFriendly).length;

  return (
    <div className="space-y-8">
      <PageHeroCompact
        tint="indigo"
        eyebrow={fr ? "Universités" : "Inivèsite"}
        title={fr ? "Comparer les universités avant d'ouvrir dix onglets." : "Konpare inivèsite yo anvan ou louvri dis onglet."}
        description={
          fr
            ? "Un répertoire plus lisible pour repérer les campus, les coûts, les langues et les portes d'entrée les plus utiles aux étudiants haïtiens."
            : "Yon repètwa ki pi klè pou remake kanpis yo, depans yo, lang yo ak pòt antre ki pi itil pou etidyan ayisyen yo."
        }
        stats={[
          { value: String(totalCount), label: fr ? "universités" : "inivèsite" },
          { value: String(countryCount), label: fr ? "pays" : "peyi" },
          { value: String(haitianFriendlyCount), label: fr ? "accueil HT" : "akèy HT" },
        ]}
      />

      <section className="section-shell space-y-6">
          {/* Inline country filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              <Globe2 className="mr-1 inline h-3.5 w-3.5 -translate-y-px" />
              {fr ? "Pays" : "Peyi"}
            </span>
            <Link
              href={l("/universites")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                !filterCountry
                  ? "bg-stone-900 text-white shadow-md ring-2 ring-stone-900/20 dark:bg-white dark:text-stone-900 dark:ring-white/20"
                  : "border border-stone-200/80 bg-white text-stone-600 shadow-sm hover:border-stone-300 hover:bg-stone-50 hover:shadow-md dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              }`}
            >
              {fr ? "Tous" : "Tout"}
            </Link>
            {(Object.keys(grouped) as DatasetCountry[]).map((c) => {
              const label = COUNTRY_LABELS[c];
              return (
                <Link
                  key={c}
                  href={l(`/universites?country=${c}`)}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    filterCountry === c
                      ? "bg-stone-900 text-white shadow-md ring-2 ring-stone-900/20 dark:bg-white dark:text-stone-900 dark:ring-white/20"
                      : "border border-stone-200/80 bg-white text-stone-600 shadow-sm hover:border-stone-300 hover:bg-stone-50 hover:shadow-md dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                  }`}
                >
                  {label?.flag && <CountryFlag code={label.flag} />} {fr ? label?.fr : label?.ht}
                </Link>
              );
            })}
          </div>

          {/* University cards by country */}
          <div className="space-y-8">
            {countries.map((countryKey) => {
              const unis = grouped[countryKey] ?? [];
              const cl = COUNTRY_LABELS[countryKey];
              return (
                <section key={countryKey} className="space-y-4">
                  <h2 className="relative z-10 flex items-center gap-3 text-2xl font-bold tracking-tight dark:text-white" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>
                    {cl?.flag && <CountryFlag code={cl.flag} size="lg" />} {fr ? cl?.fr : cl?.ht}{" "}
                    <span className="text-sm font-normal text-stone-400 dark:text-stone-500">
                      ({unis.length})
                    </span>
                  </h2>
                  <div className="relative z-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                    {unis.map((uni) => {
                      const tuition = uni.tuitionBand ? TUITION_LABELS[uni.tuitionBand] : null;
                      return (
                        <div
                          key={uni.id}
                          className="flex flex-col rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700"
                        >
                          <div className="flex items-start justify-between">
                            <h3 className="text-lg font-bold leading-tight tracking-tight dark:text-white" style={{ fontFamily: "var(--font-serif, Georgia, serif)" }}>{uni.name}</h3>
                            {uni.haitianFriendly && (
                              <span
                                className="ml-2 flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-800/30"
                                title={fr ? "Accueil haïtien" : "Akèy ayisyen"}
                              >
                                <CheckCircle className="h-3 w-3" /> HT
                              </span>
                            )}
                          </div>
                          {uni.city && (
                            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{uni.city}</p>
                          )}

                          {/* Info pills row */}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {tuition && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                <DollarSign className="h-3 w-3" />{fr ? tuition.fr : tuition.ht}
                              </span>
                            )}
                            {uni.languages && uni.languages.length > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                <Languages className="h-3 w-3" />{uni.languages.join(", ")}
                              </span>
                            )}
                          </div>

                          {uni.tags && uni.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {uni.tags.slice(0, 4).map((tag) => (
                                <span key={tag} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Links — separated by a divider for visual clarity */}
                          <div className="mt-auto flex flex-col gap-2.5 pt-3">
                            <div className="border-t border-stone-100 dark:border-stone-800" />
                            <div className="flex gap-3">
                              <a
                                href={uni.admissionsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline"
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
                                  className="rounded bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-400 hover:text-blue-700 hover:underline dark:bg-stone-800/50 dark:text-stone-500 dark:hover:text-blue-400"
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
          </div>
      </section>

      {totalCount === 0 && (
        <div className="section-shell border-2 border-dashed py-24 text-center text-stone-400 dark:text-stone-500">
          <p className="text-lg font-medium">
            {fr ? "Base de données en construction…" : "Baz done an konstriksyon…"}
          </p>
        </div>
      )}
    </div>
  );
}
