/**
 * /succes — Success & Inspiration feed.
 *
 * Strict gating: only items with successTag === true
 * OR utilityMeta.series === "HaitianOfTheWeek" are shown.
 * No fallback to generic news.
 */

import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { Sparkles, Award, Heart } from "lucide-react";
import { fetchEnrichedFeed, getLangFromSearchParams, isSuccessArticle } from "@/lib/content";
import { rankAndDeduplicate } from "@/lib/ranking";
import { SectionFeed } from "@/components/SectionFeed";
import { buildOgMetadata } from "@/lib/og";

export const revalidate = 300;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr ? "Succès & Inspiration · EdLight News" : "Siksè & Enspirasyon · EdLight News";
  const description = fr
    ? "Des histoires de réussite qui inspirent la communauté haïtienne."
    : "Istwa siksè ki enspire kominote ayisyèn nan.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/succes", lang }),
  };
}

export default async function SuccesPage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang = getLangFromSearchParams(searchParams) as ContentLanguage;

  let allArticles: Awaited<ReturnType<typeof fetchEnrichedFeed>>;
  try {
    allArticles = await fetchEnrichedFeed(lang, 200);
  } catch (err) {
    console.error("[EdLight] /succes fetch failed:", err);
    allArticles = [];
  }

  // Strict gating — no keyword fallback
  const successPool = allArticles.filter(isSuccessArticle);

  // Deduplicate + rank (same pipeline as other pages)
  const articles = rankAndDeduplicate(successPool, {
    audienceFitThreshold: 0.5,
    publisherCap: 4,
    topN: 12,
  });

  const fr = lang === "fr";

  return (
    <div className="space-y-8">
      <section className="section-shell p-0">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-grid-soft opacity-35" />
          <div className="pointer-events-none absolute -right-10 top-0 h-44 w-44 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-500/12" />
          <div className="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                <Sparkles className="h-3.5 w-3.5" />
                {fr ? "Inspiration premium" : "Enspirasyon premium"}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight dark:text-white sm:text-4xl">
                <Award className="mr-1.5 inline h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                {fr ? "Succès & Inspiration" : "Siksè & Enspirasyon"}
              </h1>
              <p className="text-gray-600 dark:text-slate-300">
                {fr
                  ? "Histoires de réussite et profils inspirants pour la communauté haïtienne."
                  : "Istwa siksè ak pwofil ki enspire kominote ayisyèn nan."}
              </p>
            </div>
            <aside className="premium-glass p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Profils" : "Pwofil"}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{articles.length}</p>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white/80 p-3 dark:border-slate-700/70 dark:bg-slate-900/60">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-slate-400">{fr ? "Sélection" : "Seleksyon"}</p>
                  <p className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900 dark:text-white"><Heart className="h-3.5 w-3.5 text-rose-500" />{fr ? "Strictement filtrée" : "Byen filtre"}</p>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {articles.length > 0 ? (
        <SectionFeed
          articles={articles}
          lang={lang}
          defaultSort="relevance"
        />
      ) : (
        <div className="section-shell border-2 border-dashed py-24 text-center text-gray-400 dark:text-slate-500">
          <p className="text-lg font-medium">
            {fr ? "Aucun profil publié récemment." : "Pa gen pwofil pibliye dènyèman."}
          </p>
        </div>
      )}
    </div>
  );
}
