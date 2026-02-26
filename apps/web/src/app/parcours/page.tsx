/**
 * /parcours — Study pathways page.
 *
 * Server component: shows step-by-step guides for studying abroad.
 * Each pathway is an accordion with ordered steps.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { MapPin, Sparkles, Compass, ArrowRight } from "lucide-react";
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
      <section className="section-shell p-0">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-40" />
          <div className="pointer-events-none absolute -right-10 top-0 h-40 w-40 rounded-full bg-brand-200/40 blur-3xl dark:bg-brand-500/15" />
          <div className="relative grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                {fr ? "Guides premium" : "Gid premium"}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
                <MapPin className="mr-1.5 inline h-7 w-7 text-brand-600 dark:text-brand-400" />
                {fr ? "Parcours" : "Pakou"}
              </h1>
              <p className="max-w-2xl text-gray-600 dark:text-slate-300">
                {fr
                  ? "Guides étape par étape pour étudier à l'étranger depuis Haïti, avec sources officielles et séquences claires."
                  : "Gid etap pa etap pou etidye aletranje depi Ayiti, ak sous ofisyèl ak etap ki byen klè."}
              </p>
            </div>
            <div className="premium-glass p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Parcours" : "Pakou"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{pathways.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Étapes totales" : "Etap total"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {pathways.reduce((sum, p) => sum + p.steps.length, 0)}
                  </p>
                </div>
              </div>
              <Link
                href={`/universites${lang === "ht" ? "?lang=ht" : ""}`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200"
              >
                <Compass className="h-4 w-4" />
                {fr ? "Voir les universités associées" : "Wè inivèsite yo"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

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
