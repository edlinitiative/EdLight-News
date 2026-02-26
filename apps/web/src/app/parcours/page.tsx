/**
 * /parcours — Study pathways page.
 *
 * Server component: shows step-by-step guides for studying abroad.
 * Each pathway is an accordion with ordered steps.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { MapPin, Compass, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getLangFromSearchParams } from "@/lib/content";
import { fetchAllPathways, COUNTRY_LABELS } from "@/lib/datasets";
import { buildOgMetadata } from "@/lib/og";

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

  let pathways: Awaited<ReturnType<typeof fetchAllPathways>>;
  try {
    pathways = await fetchAllPathways();
  } catch (err) {
    console.error("[EdLight] /parcours fetch failed:", err);
    pathways = [];
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
          {fr ? "Parcours" : "Pakou"}
        </h1>
        <p className="max-w-2xl text-gray-600 dark:text-slate-300">
          {fr
            ? "Guides étape par étape pour étudier à l'étranger depuis Haïti."
            : "Gid etap pa etap pou etidye aletranje depi Ayiti."}
        </p>
      </header>

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
              <div className="relative overflow-hidden bg-gradient-to-r from-brand-50 to-indigo-50 p-6 dark:from-brand-900/20 dark:to-indigo-900/20">
                <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full bg-white/40 blur-2xl dark:bg-brand-400/10" />
                <div className="flex items-center gap-3">
                  {cl && <span className="text-3xl">{cl.flag}</span>}
                  <div>
                    <h2 className="text-xl font-bold tracking-tight dark:text-white">
                      {fr ? p.title_fr : (p.title_ht ?? p.title_fr)}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                      {p.steps.length} {fr ? "étapes" : "etap"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Steps */}
              {p.steps && p.steps.length > 0 && (
                <div className="divide-y dark:divide-slate-700/80">
                  {p.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-4 p-4 sm:p-5">
                        {/* Step number */}
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 ring-4 ring-brand-50 dark:bg-brand-900/30 dark:text-brand-300 dark:ring-brand-900/20">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold tracking-tight dark:text-white">
                            {fr ? step.title_fr : (step.title_ht ?? step.title_fr)}
                          </h3>
                          <p className="mt-1 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                            {fr ? step.description_fr : (step.description_ht ?? step.description_fr)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Sources */}
              {p.sources && p.sources.length > 0 && (
                <div className="border-t bg-gray-50/80 p-4 dark:border-slate-700/80 dark:bg-slate-900/20">
                  <p className="text-xs font-medium text-gray-400 dark:text-slate-500 uppercase">
                    {fr ? "Sources" : "Sous"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {p.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-gray-200/80 bg-white/80 px-2 py-1 text-xs text-brand-700 hover:border-brand-200 dark:border-slate-700/70 dark:bg-slate-900/40 dark:text-brand-400"
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
        <div className="section-shell border-2 border-dashed py-24 text-center text-gray-400 dark:text-slate-500">
          <p className="text-lg font-medium">
            {fr ? "Guides en construction…" : "Gid an konstriksyon…"}
          </p>
        </div>
      )}
    </div>
  );
}
