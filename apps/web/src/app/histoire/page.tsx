/**
 * /histoire — Aujourd'hui dans l'histoire d'Haïti
 *
 * Today-first layout:
 *   A) Hero: today's almanac entries + holidays (full long-form)
 *   B) Explorer l'histoire: weekly/monthly archive (client-side, lazy)
 *
 * NOTE: Validation warnings (on HistoryPublishLog) are internal-only
 * and MUST NOT be surfaced here.
 */

import { Suspense } from "react";
import { BookOpen, Star, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import type { ContentLanguage, AlmanacTag, HaitiHistoryAlmanacEntry, HaitiHoliday } from "@edlight-news/types";
import { getLangFromSearchParams } from "@/lib/content";
import { MetaBadges } from "@/components/MetaBadges";
import { HistoireArchive } from "@/components/HistoireArchive";
import {
  fetchAlmanacByMonthDay,
  fetchHolidaysByMonthDay,
  getHaitiMonthDay,
} from "@/lib/datasets";

export const revalidate = 900;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  return {
    title: fr
      ? "Aujourd'hui dans l'histoire d'Haïti · EdLight News"
      : "Jodi a nan istwa Ayiti · EdLight News",
    description: fr
      ? "Éphéméride haïtienne : événements historiques, fêtes et personnalités du jour."
      : "Efemerid ayisyen : evènman istorik, fèt ak pèsonalite jou a.",
  };
}

// ── Shared constants ─────────────────────────────────────────────────────────

const TAG_LABELS: Record<AlmanacTag, { fr: string; ht: string; color: string }> = {
  independence:  { fr: "Indépendance",  ht: "Endepandans",  color: "bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300" },
  culture:       { fr: "Culture",       ht: "Kilti",        color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  education:     { fr: "Éducation",     ht: "Edikasyon",    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  politics:      { fr: "Politique",     ht: "Politik",      color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  science:       { fr: "Science",       ht: "Syans",        color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  military:      { fr: "Militaire",     ht: "Militè",       color: "bg-gray-100 text-gray-800 dark:bg-slate-700 dark:text-slate-300" },
  economy:       { fr: "Économie",      ht: "Ekonomi",      color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  literature:    { fr: "Littérature",   ht: "Literati",     color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  art:           { fr: "Art",           ht: "La",           color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  religion:      { fr: "Religion",      ht: "Relijyon",     color: "bg-brand-100 text-brand-800 dark:bg-brand-900/30 dark:text-brand-300" },
  sports:        { fr: "Sports",        ht: "Espò",         color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  disaster:      { fr: "Catastrophe",   ht: "Katastwòf",    color: "bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-slate-300" },
  diplomacy:     { fr: "Diplomatie",    ht: "Diplomasi",    color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
  resistance:    { fr: "Résistance",    ht: "Rezistans",    color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  revolution:    { fr: "Révolution",    ht: "Revolisyon",   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

const MONTH_NAMES_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
const MONTH_NAMES_HT = [
  "janvye", "fevriye", "mas", "avril", "me", "jen",
  "jiyè", "out", "septanm", "oktòb", "novanm", "desanm",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format MM-DD → "23 février" */
function formatMonthDay(
  monthDay: string,
  lang: ContentLanguage,
): string {
  const [mm, dd] = monthDay.split("-");
  const monthIdx = parseInt(mm!, 10) - 1;
  const name = lang === "fr" ? MONTH_NAMES_FR[monthIdx] : MONTH_NAMES_HT[monthIdx];
  return `${parseInt(dd!, 10)} ${name ?? mm}`;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HistoirePage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";
  const fr = lang === "fr";

  const todayMD = getHaitiMonthDay();
  const todayMonth = todayMD.split("-")[0]!;

  // ── Fetch today's entries + holidays ────────────────────────────────────
  let todayEntries: HaitiHistoryAlmanacEntry[];
  let todayHolidays: HaitiHoliday[];
  try {
    [todayEntries, todayHolidays] = await Promise.all([
      fetchAlmanacByMonthDay(todayMD),
      fetchHolidaysByMonthDay(todayMD),
    ]);
  } catch (err) {
    console.error("[EdLight] /histoire today fetch failed:", err);
    todayEntries = [];
    todayHolidays = [];
  }

  return (
    <div className="space-y-14 pb-12">
      {/* ═══════════════════════════════════════════════════════════════════
       *  HERO — calmer editorial layout
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-2 sm:px-0">
        <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white/95 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-brand-100/80 blur-2xl dark:bg-brand-900/30" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-indigo-100/70 blur-2xl dark:bg-indigo-900/30" />

          <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.3fr,0.9fr] lg:p-10">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 dark:border-brand-700/40 dark:bg-brand-900/20 dark:text-brand-300">
                <Sparkles className="h-4 w-4" />
                {fr ? "Aujourd’hui dans l’histoire" : "Jodi a nan istwa"}
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                {fr ? "Chronique du " : "Kwonik pou "}
                <span className="text-brand-700 dark:text-brand-300">
                  {formatMonthDay(todayMD, lang)}
                </span>
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-relaxed text-gray-600 dark:text-slate-300 sm:text-lg">
                {fr
                  ? "Une lecture claire des faits marquants d’Haïti : événements, personnalités et fêtes du jour."
                  : "Yon lekti klè sou moman enpòtan nan istwa Ayiti: evènman, pèsonalite ak fèt jounen an."}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    {fr ? "Événements" : "Evènman"}
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {todayEntries.length}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
                    {fr ? "Fêtes" : "Fèt"}
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {todayHolidays.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white/85 p-5 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/90 sm:p-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                <Star className="h-4 w-4 text-brand-500" />
                {fr ? "Fêtes du jour" : "Fèt jounen an"}
              </h2>

              {todayHolidays.length > 0 ? (
                <div className="space-y-2.5">
                  {todayHolidays.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-brand-100 bg-brand-50/70 px-3 py-2.5 text-sm text-brand-900 dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-brand-200"
                    >
                      <span className="font-medium">
                        {fr ? h.name_fr : h.name_ht}
                      </span>
                      {h.isNationalHoliday && (
                        <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
                          {fr ? "National" : "Nasyonal"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-500 dark:border-slate-700 dark:text-slate-400">
                  {fr ? "Aucune fête enregistrée aujourd’hui." : "Pa gen fèt ki anrejistre jodi a."}
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
       *  SECTION A — Today's entries
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-2 sm:px-0">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
              {fr ? "Les faits du jour" : "Reyalite jounen an"}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              {fr
                ? "Un format plus lisible pour parcourir l’actualité historique du jour."
                : "Yon prezantasyon pi klè pou li istwa jounen an."}
            </p>
          </div>
        </div>

        {todayEntries.length > 0 ? (
          <div className="space-y-4 sm:space-y-5">
            {todayEntries
              .sort((a, b) => {
                if (a.confidence === "high" && b.confidence !== "high") return -1;
                if (a.confidence !== "high" && b.confidence === "high") return 1;
                return 0;
              })
              .map((entry, idx) => (
                <article
                  key={entry.id}
                  className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {entry.year != null && (
                        <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                          {entry.year}
                        </span>
                      )}
                      {entry.confidence === "high" && (
                        <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-300">
                          {fr ? "Vérifié" : "Verifye"}
                        </span>
                      )}
                    </div>

                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 px-2 text-xs font-semibold text-gray-600 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300">
                      {entry.year != null ? String(entry.year).slice(-2) : String(idx + 1)}
                    </span>
                  </div>

                  <h3 className="mt-3 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                    {entry.title_fr}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-slate-300 sm:text-base">
                    {entry.summary_fr}
                  </p>

                  {entry.student_takeaway_fr && (
                    <div className="mt-4 flex gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4 dark:border-brand-800/40 dark:bg-brand-900/20">
                      <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" />
                      <div className="text-sm text-brand-800 dark:text-brand-300">
                        <strong>{fr ? "Pour les étudiants" : "Pou etidyan yo"}:</strong>{" "}
                        {entry.student_takeaway_fr}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {entry.tags?.map((tag) => {
                      const t = TAG_LABELS[tag];
                      return (
                        <span
                          key={tag}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${t?.color ?? "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300"}`}
                        >
                          {fr ? t?.fr : t?.ht}
                        </span>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-slate-700/80">
                    <MetaBadges
                      verifiedAt={entry.verifiedAt}
                      updatedAt={entry.updatedAt}
                      lang={lang}
                    />

                    {entry.sources.length > 0 && (
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {fr ? "Sources : " : "Sous : "}
                        {entry.sources.map((s, i) => (
                          <span key={i}>
                            {i > 0 && " · "}
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-600 hover:underline dark:text-brand-400"
                            >
                              {s.label}
                            </a>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              ))}
          </div>
        ) : todayHolidays.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-12 text-center text-gray-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <BookOpen className="mx-auto mb-3 h-10 w-10" />
            <p className="text-sm">
              {fr
                ? "Aucune entrée publiée aujourd’hui."
                : "Pa gen antre pibliye jodi a."}
            </p>
          </div>
        ) : null}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
       *  SECTION B — Explorer l'histoire (weekly/monthly archive)
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-2 sm:px-0">
        <Suspense
          fallback={
            <div className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-slate-700 dark:bg-slate-800" />
          }
        >
          <HistoireArchive lang={lang} defaultMonth={todayMonth} />
        </Suspense>
      </section>
    </div>
  );
}
