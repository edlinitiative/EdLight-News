/**
 * /parcours — Study pathways page.
 *
 * Server component: shows step-by-step guides for studying abroad.
 * Each pathway is an accordion with ordered steps.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { MapPin } from "lucide-react";
import { getLangFromSearchParams } from "@/lib/content";
import { fetchAllPathways, COUNTRY_LABELS } from "@/lib/datasets";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Parcours | EdLight News",
  description: "Guides étape par étape pour étudier à l'étranger depuis Haïti",
};

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
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">
          <MapPin className="mr-1.5 inline h-7 w-7 text-brand-600" /> {fr ? "Parcours" : "Pakou"}
        </h1>
        <p className="text-gray-500">
          {fr
            ? "Guides étape par étape pour étudier à l'étranger depuis Haïti."
            : "Gid etap pa etap pou etidye aletranje depi Ayiti."}
        </p>
      </div>

      {/* Pathway cards */}
      <div className="space-y-6">
        {pathways.map((p) => {
          const cl = p.country ? COUNTRY_LABELS[p.country] : null;
          return (
            <div
              key={p.id}
              className="overflow-hidden rounded-lg border bg-white shadow-sm"
            >
              {/* Pathway header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
                <div className="flex items-center gap-3">
                  {cl && <span className="text-3xl">{cl.flag}</span>}
                  <div>
                    <h2 className="text-xl font-bold">
                      {fr ? p.title_fr : (p.title_ht ?? p.title_fr)}
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {p.steps.length} {fr ? "étapes" : "etap"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Steps */}
              {p.steps && p.steps.length > 0 && (
                <div className="divide-y">
                  {p.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-4 p-4">
                        {/* Step number */}
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold">
                            {fr ? step.title_fr : (step.title_ht ?? step.title_fr)}
                          </h3>
                          <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                            {fr ? step.description_fr : (step.description_ht ?? step.description_fr)}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Sources */}
              {p.sources && p.sources.length > 0 && (
                <div className="border-t bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-400 uppercase">
                    {fr ? "Sources" : "Sous"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {p.sources.map((src, i) => (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline"
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
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-24 text-center text-gray-400">
          <p className="text-lg font-medium">
            {fr ? "Guides en construction…" : "Gid an konstriksyon…"}
          </p>
        </div>
      )}
    </div>
  );
}
