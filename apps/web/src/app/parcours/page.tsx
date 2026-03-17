/**
 * /parcours — Study pathways page.
 *
 * Server component: shows step-by-step guides for studying abroad.
 * Each pathway is an accordion with ordered steps.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Compass } from "lucide-react";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { getLangFromSearchParams } from "@/lib/content";
import { fetchAllPathways, COUNTRY_LABELS } from "@/lib/datasets";
import { CountryFlag } from "@/components/CountryFlag";
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
  const title = fr ? "Parcours · EdLight News" : "Pakou · EdLight News";
  const description = fr
    ? "Guides étape par étape pour étudier à l'étranger depuis Haïti."
    : "Gid etap pa etap pou etidye aletranje depi Ayiti.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/parcours", lang }),
  };
}

export default async function ParcoursPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;
  const fr = lang === "fr";
  const l = (href: string) => withLangParam(href, lang);

  let pathways: Awaited<ReturnType<typeof fetchAllPathways>>;
  try {
    pathways = await fetchAllPathways();
  } catch (err) {
    console.error("[EdLight] /parcours fetch failed:", err);
    pathways = [];
  }

  const countryCount = new Set(pathways.map((pathway) => pathway.country).filter(Boolean)).size;
  const stepCount = pathways.reduce((sum, pathway) => sum + pathway.steps.length, 0);

  return (
    <div className="space-y-8">
      <PageHero
        variant="pathways"
        eyebrow={fr ? "Étudier à l'étranger, pas à pas" : "Etidye aletranje, etap pa etap"}
        title={
          fr
            ? "Choisir un parcours avant de choisir une destination."
            : "Chwazi yon pakou anvan w chwazi yon destinasyon."
        }
        description={
          fr
            ? "Des guides séquencés pour comprendre les étapes, le rythme et les décisions-clés avant de postuler."
            : "Gid ki byen sekans pou konprann etap yo, ritm nan ak desizyon kle yo anvan w aplike."
        }
        icon={<Compass className="h-5 w-5" />}
        actions={[
          { href: l("/universites"), label: fr ? "Voir les universités" : "Wè inivèsite yo" },
          { href: l("/bourses"), label: fr ? "Chercher une bourse" : "Chèche yon bous" },
        ]}
        stats={[
          { value: String(pathways.length), label: fr ? "parcours" : "pakou" },
          { value: String(countryCount), label: fr ? "pays" : "peyi" },
          { value: String(stepCount), label: fr ? "étapes" : "etap" },
        ]}
      />

      {/* Pathway cards */}
      <div className="space-y-6">
        {pathways.map((p) => {
          const cl = p.country ? COUNTRY_LABELS[p.country] : null;
          return (
            <div
              key={p.id}
              className="section-shell p-0"
            >
              {/* Pathway header */}
              <div className="relative overflow-hidden bg-gradient-to-r from-blue-50 to-indigo-50 p-6 dark:from-blue-900/20 dark:to-indigo-900/20">
                <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full bg-white/40 blur-2xl dark:bg-blue-400/10" />
                <div className="flex items-center gap-3">
                  {cl?.flag && <CountryFlag code={cl.flag} size="lg" />}
                  <div>
                    <h2 className="text-xl font-bold tracking-tight dark:text-white">
                      {fr ? p.title_fr : (p.title_ht ?? p.title_fr)}
                    </h2>
                    <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                      {p.steps.length} {fr ? "étapes" : "etap"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Steps */}
              {p.steps && p.steps.length > 0 && (
                <div className="relative divide-y dark:divide-stone-700/80">
                  {/* Vertical connector line behind step numbers */}
                  <div className="absolute left-[1.125rem] top-6 bottom-6 w-px bg-blue-100 dark:bg-blue-900/30 sm:left-[1.375rem]" />

                  {p.steps.map((step, idx) => (
                      <div key={idx} className="relative flex gap-4 p-4 sm:p-5">
                        {/* Step number */}
                        <div className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 ring-4 ring-white dark:bg-blue-900/30 dark:text-blue-300 dark:ring-stone-900">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold tracking-tight dark:text-white">
                            {fr ? step.title_fr : (step.title_ht ?? step.title_fr)}
                          </h3>
                          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
                            {fr ? step.description_fr : (step.description_ht ?? step.description_fr)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Sources */}
              {p.sources && p.sources.length > 0 && (
                <div className="border-t bg-stone-50/80 p-4 dark:border-stone-700/80 dark:bg-stone-900/20">
                  <p className="text-xs font-medium text-stone-400 dark:text-stone-500 uppercase">
                    {fr ? "Sources" : "Sous"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {p.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-stone-200/80 bg-white/80 px-2 py-1 text-xs text-blue-700 hover:border-blue-200 dark:border-stone-700/70 dark:bg-stone-900/40 dark:text-blue-400"
                      >
                        {src.label ?? src.url}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pathways.length === 0 && (
        <div className="section-shell border-2 border-dashed py-24 text-center text-stone-400 dark:text-stone-500">
          <p className="text-lg font-medium">
            {fr ? "Guides en construction…" : "Gid an konstriksyon…"}
          </p>
        </div>
      )}
    </div>
  );
}
