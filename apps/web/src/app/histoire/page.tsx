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
    <div className="space-y-0">
      {/* ═══════════════════════════════════════════════════════════════════
       *  HERO BANNER — immersive gradient with today's date
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative -mx-4 -mt-8 mb-10 overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-600 px-4 pb-10 pt-12 text-white sm:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-grid-soft opacity-10" />
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <Sparkles className="h-4 w-4" />
            {fr ? "Histoire & Fèt du jour" : "Istwa & Fèt jou a"}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            {fr ? "Aujourd\u2019hui — " : "Jodi a — "}
            <span className="text-white/90">
              {formatMonthDay(todayMD, lang)}
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-relaxed text-white/80 sm:text-lg">
            {fr
              ? "Découvrez chaque jour ce qui s\u2019est passé dans l\u2019histoire d\u2019Haïti — événements, héros, et fêtes nationales."
              : "Dekouvri chak jou sa k te pase nan istwa Ayiti — evènman, ewo, ak fèt nasyonal."}
          </p>

          {/* Holiday badges — inside the hero for visual impact */}
          {todayHolidays.length > 0 && (
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {todayHolidays.map((h) => (
                <div
                  key={h.id}
                  className="inline-flex items-center gap-2 rounded-full bg-white/20 px-5 py-2 text-sm font-semibold backdrop-blur-sm"
                >
                  <Star className="h-4 w-4 text-brand-300" />
                  {fr ? h.name_fr : h.name_ht}
                  {h.isNationalHoliday && (
                    <span className="ml-1 text-brand-300">🇭🇹</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
       *  SECTION A — Today's entries — timeline style
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-5xl px-2 sm:px-0">
        {todayEntries.length > 0 ? (
          <div className="relative">
            {/* Timeline connector line */}
            {todayEntries.length > 1 && (
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-300 via-brand-200 to-transparent sm:left-6" />
            )}

            <div className="space-y-10">
              {todayEntries
                .sort((a, b) => {
                  if (a.confidence === "high" && b.confidence !== "high") return -1;
                  if (a.confidence !== "high" && b.confidence === "high") return 1;
                  return 0;
                })
                .map((entry, idx) => (
                  <article
                    key={entry.id}
                    className="relative flex gap-4 sm:gap-6"
                  >
                    {/* Timeline dot */}
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-lg ring-4 ring-white dark:ring-slate-900 sm:h-12 sm:w-12">
                      {entry.year != null
                        ? String(entry.year).slice(-2)
                        : String(idx + 1)}
                    </div>

                    {/* Card */}
                    <div className="premium-card min-w-0 flex-1 p-6 sm:p-7">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {entry.year != null && (
                          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                            {entry.year}
                          </span>
                        )}
                        {entry.confidence === "high" && (
                          <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/20 dark:text-green-300">
                            ✓ {fr ? "Vérifié" : "Verifye"}
                          </span>
                        )}
                      </div>

                      <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
                        {entry.title_fr}
                      </h2>

                      <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-slate-300 sm:text-base">
                        {entry.summary_fr}
                      </p>

                      {entry.student_takeaway_fr && (
                        <div className="mt-4 flex gap-3 rounded-lg border border-brand-100 bg-brand-50/60 dark:border-brand-800/40 dark:bg-brand-900/20 p-4">
                          <span className="text-lg">💡</span>
                          <div className="text-sm text-brand-800 dark:text-brand-300">
                            <strong>
                              {fr ? "Pour les étudiants" : "Pou etidyan yo"} :
                            </strong>{" "}
                            {entry.student_takeaway_fr}
                          </div>
                        </div>
                      )}

                      {/* Tags */}
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

                        {/* Sources */}
                        {entry.sources.length > 0 && (
                          <div className="text-xs text-gray-400 dark:text-slate-500">
                            📚{" "}
                            {entry.sources.map((s, i) => (
                              <span key={i}>
                                {i > 0 && " · "}
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-600 dark:text-brand-400 hover:underline"
                                >
                                  {s.label}
                                </a>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
            </div>
          </div>
        ) : todayHolidays.length === 0 ? (
          <div className="section-shell border-2 border-dashed py-12 text-center text-gray-400 dark:text-slate-500">
            <BookOpen className="mx-auto mb-3 h-10 w-10" />
            <p className="text-sm">
              {fr
                ? "Aucune entrée publiée aujourd\u2019hui."
                : "Pa gen antre pibliye jodi a."}
            </p>
          </div>
        ) : null}
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
       *  SECTION B — Explorer l'histoire (weekly/monthly archive)
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto mt-14 max-w-6xl">
        <div className="section-shell">
        <Suspense
          fallback={
            <div className="h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
          }
        >
          <HistoireArchive lang={lang} defaultMonth={todayMonth} />
        </Suspense>
        </div>
      </section>
    </div>
  );
}
