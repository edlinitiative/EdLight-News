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
import Image from "next/image";
import { BookOpen, Star } from "lucide-react";
import type { Metadata } from "next";
import type { ContentLanguage, AlmanacTag, HaitiHistoryAlmanacEntry, HaitiHoliday } from "@edlight-news/types";
import { getLangFromSearchParams } from "@/lib/content";
import { MetaBadges } from "@/components/MetaBadges";
import { HistoireArchive } from "@/components/HistoireArchive";
import { buildOgMetadata } from "@/lib/og";
import {
  fetchAlmanacByMonthDay,
  fetchAllHolidays,
  fetchHolidaysByMonthDay,
  getHaitiMonthDay,
} from "@/lib/datasets";
import { MONTH_NAMES_FR_0, MONTH_NAMES_HT_0 } from "@/lib/dates";

export const revalidate = 900;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr
    ? "Aujourd'hui dans l'histoire d'Haïti · EdLight News"
    : "Jodi a nan istwa Ayiti · EdLight News";
  const description = fr
    ? "Éphéméride haïtienne : événements historiques, fêtes et personnalités du jour."
    : "Efemerid ayisyen : evènman istorik, fèt ak pèsonalite jou a.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/histoire", lang }),
  };
}

// ── Shared constants ─────────────────────────────────────────────────────────

const TAG_LABELS: Record<AlmanacTag, { fr: string; ht: string; color: string }> = {
  independence:  { fr: "Indépendance",  ht: "Endepandans",  color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  culture:       { fr: "Culture",       ht: "Kilti",        color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  education:     { fr: "Éducation",     ht: "Edikasyon",    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  politics:      { fr: "Politique",     ht: "Politik",      color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  science:       { fr: "Science",       ht: "Syans",        color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300" },
  military:      { fr: "Militaire",     ht: "Militè",       color: "bg-stone-100 text-stone-800 dark:bg-stone-700 dark:text-stone-300" },
  economy:       { fr: "Économie",      ht: "Ekonomi",      color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  literature:    { fr: "Littérature",   ht: "Literati",     color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  art:           { fr: "Art",           ht: "La",           color: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300" },
  religion:      { fr: "Religion",      ht: "Relijyon",     color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  sports:        { fr: "Sports",        ht: "Espò",         color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  disaster:      { fr: "Catastrophe",   ht: "Katastwòf",    color: "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-300" },
  diplomacy:     { fr: "Diplomatie",    ht: "Diplomasi",    color: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
  resistance:    { fr: "Résistance",    ht: "Rezistans",    color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  revolution:    { fr: "Révolution",    ht: "Revolisyon",   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

// Month names from shared utility (0-indexed for use with Date.getMonth())
const MONTH_NAMES_FR = [...MONTH_NAMES_FR_0];
const MONTH_NAMES_HT = [...MONTH_NAMES_HT_0];

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

function monthDayToOrdinal(monthDay: string): number {
  const [mm, dd] = monthDay.split("-");
  const date = new Date(Date.UTC(2024, parseInt(mm!, 10) - 1, parseInt(dd!, 10)));
  const start = new Date(Date.UTC(2024, 0, 1));
  return Math.floor((date.getTime() - start.getTime()) / 86400000);
}

function getUpcomingHolidays(
  allHolidays: HaitiHoliday[],
  todayMonthDay: string,
  limit: number,
): HaitiHoliday[] {
  const todayOrdinal = monthDayToOrdinal(todayMonthDay);
  return [...allHolidays]
    .sort((a, b) => {
      const aDelta = (monthDayToOrdinal(a.monthDay) - todayOrdinal + 366) % 366;
      const bDelta = (monthDayToOrdinal(b.monthDay) - todayOrdinal + 366) % 366;
      if (aDelta !== bDelta) return aDelta - bDelta;
      return Number(b.isNationalHoliday) - Number(a.isNationalHoliday);
    })
    .slice(0, limit);
}

const HISTORY_ILLUSTRATION_MIN_CONFIDENCE = 0.55;

function shouldShowIllustration(entry: HaitiHistoryAlmanacEntry): boolean {
  if (!entry.illustration?.imageUrl) return false;
  const confidence = entry.illustration.confidence;
  // Backward compatibility: if confidence is missing, allow display.
  if (typeof confidence !== "number") return true;
  return confidence >= HISTORY_ILLUSTRATION_MIN_CONFIDENCE;
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
  let allHolidays: HaitiHoliday[];
  try {
    [todayEntries, todayHolidays, allHolidays] = await Promise.all([
      fetchAlmanacByMonthDay(todayMD),
      fetchHolidaysByMonthDay(todayMD),
      fetchAllHolidays(),
    ]);
  } catch (err) {
    console.error("[EdLight] /histoire today fetch failed:", err);
    todayEntries = [];
    todayHolidays = [];
    allHolidays = [];
  }

  const fallbackHolidays = todayHolidays.length === 0
    ? getUpcomingHolidays(allHolidays, todayMD, 3)
    : [];
  const heroHolidays = todayHolidays.length > 0 ? todayHolidays : fallbackHolidays;

  return (
    <div className="space-y-14 pb-12">
      {/* ═══════════════════════════════════════════════════════════════════
       *  HERO — calmer editorial layout
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto max-w-6xl px-2 sm:px-0">
        <div className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white/95 shadow-sm dark:border-stone-700 dark:bg-stone-900/80">

          <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.3fr,0.9fr] lg:p-10">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">
                {fr ? "Aujourd'hui dans l'histoire" : "Jodi a nan istwa"}
              </p>

              <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900 dark:text-white sm:text-4xl">
                {fr ? "Chronique du " : "Kwonik pou "}
                <span className="text-blue-700 dark:text-blue-300">
                  {formatMonthDay(todayMD, lang)}
                </span>
              </h1>

              <p className="mt-4 max-w-3xl text-base leading-relaxed text-stone-600 dark:text-stone-300 sm:text-lg">
                {fr
                  ? "Une lecture claire des faits marquants d’Haïti : événements, personnalités et fêtes du jour."
                  : "Yon lekti klè sou moman enpòtan nan istwa Ayiti: evènman, pèsonalite ak fèt jounen an."}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-800">
                  <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    {fr ? "Événements" : "Evènman"}
                  </p>
                  <p className="text-xl font-bold text-stone-900 dark:text-white">
                    {todayEntries.length}
                  </p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm dark:border-stone-700 dark:bg-stone-800">
                  <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
                    {todayHolidays.length > 0
                      ? (fr ? "Fêtes du jour" : "Fèt jodi a")
                      : (fr ? "Prochaines fêtes" : "Pwochen fèt")}
                  </p>
                  <p className="text-xl font-bold text-stone-900 dark:text-white">
                    {heroHolidays.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white/85 p-5 backdrop-blur-sm dark:border-stone-700 dark:bg-stone-800/90 sm:p-6">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                <Star className="h-4 w-4 text-blue-500" />
                {todayHolidays.length > 0
                  ? (fr ? "Fêtes du jour" : "Fèt jounen an")
                  : (fr ? "Prochaines fêtes" : "Pwochen fèt")}
              </h2>

              {heroHolidays.length > 0 ? (
                <div className="space-y-2.5">
                  {heroHolidays.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-sm text-blue-900 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-200"
                    >
                      <div className="min-w-0">
                        <span className="font-medium">
                          {fr ? h.name_fr : h.name_ht}
                        </span>
                        {todayHolidays.length === 0 && (
                          <p className="text-[11px] text-blue-700/80 dark:text-blue-300/80">
                            {formatMonthDay(h.monthDay, lang)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {h.isNationalHoliday && (
                          <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                            {fr ? "National" : "Nasyonal"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-stone-200 px-3 py-4 text-sm text-stone-500 dark:border-stone-700 dark:text-stone-400">
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
            <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white sm:text-3xl">
              {fr ? "Les faits du jour" : "Reyalite jounen an"}
            </h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              {fr
                ? "Un format plus lisible pour parcourir l’actualité historique du jour."
                : "Yon prezantasyon pi klè pou li istwa jounen an."}
            </p>
          </div>
        </div>

        {todayEntries.length > 0 ? (
          <div className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            {todayEntries
              .sort((a, b) => {
                if (a.confidence === "high" && b.confidence !== "high") return -1;
                if (a.confidence !== "high" && b.confidence === "high") return 1;
                return 0;
              })
              .map((entry, idx) => (
                (() => {
                  const displayIllustration = shouldShowIllustration(entry)
                    ? entry.illustration
                    : null;

                  return (
                <article
                  key={entry.id}
                  className="group flex flex-col rounded-xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md dark:border-stone-700 dark:bg-stone-800"
                >
                  {/* Top row: optional thumbnail + header */}
                  <div className={displayIllustration ? "flex gap-0" : ""}>
                    {displayIllustration && (
                      <div className="relative hidden w-36 shrink-0 overflow-hidden rounded-tl-xl sm:block sm:w-44">
                        <Image
                          src={displayIllustration.imageUrl}
                          alt={entry.title_fr}
                          fill
                          sizes="180px"
                          className="object-cover"
                        />
                      </div>
                    )}

                    <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {entry.year != null && (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              {entry.year}
                            </span>
                          )}
                          {entry.confidence === "high" && (
                            <span className="rounded-md bg-green-50 px-1.5 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/20 dark:text-green-300">
                              {fr ? "Vérifié" : "Verifye"}
                            </span>
                          )}
                        </div>
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-stone-200 bg-stone-50 px-1.5 text-[11px] font-semibold text-stone-500 dark:border-stone-700 dark:bg-stone-700 dark:text-stone-300">
                          {entry.year != null ? String(entry.year).slice(-2) : String(idx + 1)}
                        </span>
                      </div>

                      <h3 className="text-base font-bold leading-snug tracking-tight text-stone-900 dark:text-white sm:text-lg">
                        {entry.title_fr}
                      </h3>

                      <p className="line-clamp-3 text-sm leading-relaxed text-stone-600 dark:text-stone-300">
                        {entry.summary_fr}
                      </p>
                    </div>
                  </div>

                  {/* Bottom section */}
                  <div className="flex flex-col gap-3 border-t border-stone-100 px-4 pb-4 pt-3 dark:border-stone-700/60 sm:px-5">
                    {entry.student_takeaway_fr && (
                      <div className="flex gap-2 rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2.5 dark:border-blue-800/40 dark:bg-blue-900/20">
                        <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-700 dark:text-blue-300" />
                        <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-300">
                          <strong>{fr ? "Étudiants" : "Etidyan"}:</strong>{" "}
                          {entry.student_takeaway_fr}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5">
                      {entry.tags?.map((tag) => {
                        const t = TAG_LABELS[tag];
                        return (
                          <span
                            key={tag}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t?.color ?? "bg-stone-100 text-stone-700 dark:bg-stone-700 dark:text-stone-300"}`}
                          >
                            {fr ? t?.fr : t?.ht}
                          </span>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <MetaBadges
                        verifiedAt={entry.verifiedAt}
                        updatedAt={entry.updatedAt}
                        lang={lang}
                      />
                      {entry.sources.length > 0 && (
                        <span className="text-stone-500 dark:text-stone-400">
                          {fr ? "Sources : " : "Sous : "}
                          {entry.sources.map((s, i) => (
                            <span key={i}>
                              {i > 0 && " · "}
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline dark:text-blue-400"
                              >
                                {s.label}
                              </a>
                            </span>
                          ))}
                        </span>
                      )}
                    </div>

                    {displayIllustration && (
                      <div className="flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500">
                        <span>{fr ? "Illustration historique" : "Ilistrasyon istorik"}</span>
                        <a
                          href={displayIllustration.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-blue-500 hover:underline dark:text-blue-400"
                        >
                          Wikimedia Commons
                        </a>
                      </div>
                    )}
                  </div>
                </article>
                  );
                })()
              ))}
          </div>
        ) : todayHolidays.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-stone-200 bg-white py-12 text-center text-stone-500 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
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
            <div className="h-48 animate-pulse rounded-xl border border-stone-200 bg-stone-100 dark:border-stone-700 dark:bg-stone-800" />
          }
        >
          <HistoireArchive lang={lang} defaultMonth={todayMonth} />
        </Suspense>
      </section>
    </div>
  );
}
