/**
 * /universites — University database page.
 *
 * Server component: fetches all universities grouped by country.
 * Shows filterable cards with admissions info, tuition bands, and tags.
 */

import type { Metadata } from "next";
import type { ContentLanguage, DatasetCountry } from "@edlight-news/types";
import { getLangFromSearchParams } from "@/lib/content";
import {
  fetchUniversitiesGrouped,
  COUNTRY_LABELS,
  TUITION_LABELS,
} from "@/lib/datasets";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Universités | EdLight News",
  description: "Base de données d'universités pour étudiants haïtiens",
};

export default async function UniversitesPage({
  searchParams,
}: {
  searchParams: { lang?: string; country?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";
  const filterCountry = searchParams.country as DatasetCountry | undefined;

  const grouped = await fetchUniversitiesGrouped();

  // If a country filter is applied, only show that country
  const countries = filterCountry
    ? [filterCountry].filter((c) => grouped[c])
    : (Object.keys(grouped) as DatasetCountry[]).sort((a, b) => {
        // Show HT-friendly countries first: CA, FR, US, UK, DO, then rest
        const order: Record<string, number> = { CA: 0, FR: 1, US: 2, UK: 3, DO: 4 };
        return (order[a] ?? 99) - (order[b] ?? 99);
      });

  const totalCount = Object.values(grouped).reduce((s, arr) => s + arr.length, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">
          🏫 {fr ? "Universités" : "Inivèsite"}
        </h1>
        <p className="text-gray-500">
          {fr
            ? `${totalCount} universités dans ${Object.keys(grouped).length} pays — filtrées pour les étudiants haïtiens.`
            : `${totalCount} inivèsite nan ${Object.keys(grouped).length} peyi — filtre pou etidyan ayisyen yo.`}
        </p>
      </div>

      {/* Country filter pills */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/universites?lang=${lang}`}
          className={`rounded-full px-3 py-1 text-sm font-medium transition ${
            !filterCountry
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {label?.flag} {fr ? label?.fr : label?.ht}
            </Link>
          );
        })}
      </div>

      {/* University cards by country */}
      {countries.map((countryKey) => {
        const unis = grouped[countryKey] ?? [];
        const cl = COUNTRY_LABELS[countryKey];
        return (
          <section key={countryKey} className="space-y-4">
            <h2 className="text-xl font-bold">
              {cl?.flag} {fr ? cl?.fr : cl?.ht}{" "}
              <span className="text-sm font-normal text-gray-400">
                ({unis.length})
              </span>
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {unis.map((uni) => {
                const tuition = uni.tuitionBand ? TUITION_LABELS[uni.tuitionBand] : null;
                return (
                  <div
                    key={uni.id}
                    className="rounded-lg border bg-white p-4 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold leading-tight">{uni.name}</h3>
                      {uni.haitianFriendly && (
                        <span
                          className="ml-2 shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
                          title={fr ? "Accueil haïtien" : "Akèy ayisyen"}
                        >
                          🇭🇹
                        </span>
                      )}
                    </div>
                    {uni.city && (
                      <p className="mt-1 text-sm text-gray-500">{uni.city}</p>
                    )}
                    {tuition && (
                      <p className="mt-1 text-xs text-gray-400">
                        💰 {fr ? tuition.fr : tuition.ht}
                      </p>
                    )}
                    {uni.languages && uni.languages.length > 0 && (
                      <p className="mt-1 text-xs text-gray-400">
                        🗣️ {uni.languages.join(", ")}
                      </p>
                    )}
                    {uni.tags && uni.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {uni.tags.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                          >
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
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        {fr ? "Admissions →" : "Admisyon →"}
                      </a>
                      {uni.scholarshipUrl && (
                        <a
                          href={uni.scholarshipUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-green-600 hover:underline"
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
                            className="rounded bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-blue-600 hover:underline"
                          >
                            📎 {src.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {totalCount === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-24 text-center text-gray-400">
          <p className="text-lg font-medium">
            {fr ? "Base de données en construction…" : "Baz done an konstriksyon…"}
          </p>
        </div>
      )}
    </div>
  );
}
