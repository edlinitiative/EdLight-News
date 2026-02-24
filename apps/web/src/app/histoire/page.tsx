/**
 * /histoire — Aujourd'hui dans l'histoire d'Haïti
 *
 * Today-first layout:
 *   A) Hero: today's almanac entries + holidays (full long-form)
 *   B) Cette semaine: next 7 days mini-cards
 *   C) Explorer par date: collapsible month/tag archive (client-side, lazy)
 *
 * NOTE: Validation warnings (on HistoryPublishLog) are internal-only
 * and MUST NOT be surfaced here.
 */

import { Suspense } from "react";
import { BookOpen, Calendar, Star } from "lucide-react";
import type { ContentLanguage, AlmanacTag, HaitiHistoryAlmanacEntry, HaitiHoliday } from "@edlight-news/types";
import { MetaBadges } from "@/components/MetaBadges";
import { HistoireArchive } from "@/components/HistoireArchive";
import {
  fetchAlmanacByMonthDay,
  fetchHolidaysByMonthDay,
  getHaitiMonthDay,
} from "@/lib/datasets";

export const revalidate = 900;

export const metadata = {
  title: "Aujourd'hui dans l'histoire d'Haïti · EdLight News",
};

// ── Shared constants ─────────────────────────────────────────────────────────

const TAG_LABELS: Record<AlmanacTag, { fr: string; ht: string; color: string }> = {
  independence:  { fr: "Indépendance",  ht: "Endepandans",  color: "bg-blue-100 text-blue-800" },
  culture:       { fr: "Culture",       ht: "Kilti",        color: "bg-purple-100 text-purple-800" },
  education:     { fr: "Éducation",     ht: "Edikasyon",    color: "bg-green-100 text-green-800" },
  politics:      { fr: "Politique",     ht: "Politik",      color: "bg-red-100 text-red-800" },
  science:       { fr: "Science",       ht: "Syans",        color: "bg-cyan-100 text-cyan-800" },
  military:      { fr: "Militaire",     ht: "Militè",       color: "bg-gray-100 text-gray-800" },
  economy:       { fr: "Économie",      ht: "Ekonomi",      color: "bg-yellow-100 text-yellow-800" },
  literature:    { fr: "Littérature",   ht: "Literati",     color: "bg-indigo-100 text-indigo-800" },
  art:           { fr: "Art",           ht: "La",           color: "bg-pink-100 text-pink-800" },
  religion:      { fr: "Religion",      ht: "Relijyon",     color: "bg-amber-100 text-amber-800" },
  sports:        { fr: "Sports",        ht: "Espò",         color: "bg-emerald-100 text-emerald-800" },
  disaster:      { fr: "Catastrophe",   ht: "Katastwòf",    color: "bg-orange-100 text-orange-800" },
  diplomacy:     { fr: "Diplomatie",    ht: "Diplomasi",    color: "bg-teal-100 text-teal-800" },
  resistance:    { fr: "Résistance",    ht: "Rezistans",    color: "bg-rose-100 text-rose-800" },
  revolution:    { fr: "Révolution",    ht: "Revolisyon",   color: "bg-red-100 text-red-700" },
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

/** Get next N calendar days as MM-DD strings (Haiti timezone). */
function getNextDays(todayMD: string, count: number): string[] {
  const [mm, dd] = todayMD.split("-").map(Number) as [number, number];
  // Use a reference year (2024 = leap year so Feb 29 works)
  const base = new Date(2024, mm - 1, dd);
  const days: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    days.push(`${m}-${day}`);
  }
  return days;
}

/** First sentence (rough): split on ". " and take the first chunk. */
function firstSentence(text: string): string {
  const idx = text.indexOf(". ");
  if (idx > 0 && idx < 200) return text.slice(0, idx + 1);
  if (text.length > 160) return text.slice(0, 160).trimEnd() + "…";
  return text;
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

  // ── Fetch 7-day lookahead ──────────────────────────────────────────────
  const weekDays = getNextDays(todayMD, 7);
  type WeekEntry = { monthDay: string; entry: HaitiHistoryAlmanacEntry };
  const weekEntries: WeekEntry[] = [];

  try {
    const results = await Promise.all(
      weekDays.map((md) => fetchAlmanacByMonthDay(md)),
    );
    for (let i = 0; i < weekDays.length; i++) {
      const md = weekDays[i]!;
      const dayEntries = results[i] ?? [];
      // Take the highest-confidence entry per day (skip today — shown in hero)
      if (md === todayMD) continue;
      const best = [...dayEntries].sort((a, b) =>
        a.confidence === "high" && b.confidence !== "high" ? -1 : 1,
      )[0];
      if (best) {
        weekEntries.push({ monthDay: md, entry: best });
      }
    }
  } catch (err) {
    console.error("[EdLight] /histoire week fetch failed:", err);
  }

  return (
    <div className="space-y-0">
      {/* ═══════════════════════════════════════════════════════════════════
       *  HERO BANNER — immersive gradient with today's date
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="-mx-4 -mt-8 mb-10 bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-600 px-4 pb-10 pt-12 text-white sm:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur-sm">
            <BookOpen className="h-4 w-4" />
            {fr ? "Histoire & Fèt du jour" : "Istwa & Fèt jou a"}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            {fr ? "Aujourd\u2019hui — " : "Jodi a — "}
            <span className="text-white/90">
              {formatMonthDay(todayMD, lang)}
            </span>
          </h1>
          <p className="mt-3 text-base text-white/70 sm:text-lg">
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
                  <Star className="h-4 w-4 text-amber-300" />
                  {fr ? h.name_fr : h.name_ht}
                  {h.isNationalHoliday && (
                    <span className="ml-1 text-amber-300">🇭🇹</span>
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
      <section className="mx-auto max-w-4xl px-2 sm:px-0">
        {todayEntries.length > 0 ? (
          <div className="relative">
            {/* Timeline connector line */}
            {todayEntries.length > 1 && (
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-300 via-brand-200 to-transparent sm:left-6" />
            )}

            <div className="space-y-8">
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
                    <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-lg ring-4 ring-white sm:h-12 sm:w-12">
                      {entry.year != null
                        ? String(entry.year).slice(-2)
                        : String(idx + 1)}
                    </div>

                    {/* Card */}
                    <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {entry.year != null && (
                          <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                            {entry.year}
                          </span>
                        )}
                        {entry.confidence === "high" && (
                          <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            ✓ {fr ? "Vérifié" : "Verifye"}
                          </span>
                        )}
                      </div>

                      <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
                        {entry.title_fr}
                      </h2>

                      <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
                        {entry.summary_fr}
                      </p>

                      {entry.student_takeaway_fr && (
                        <div className="mt-4 flex gap-3 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
                          <span className="text-lg">💡</span>
                          <div className="text-sm text-blue-800">
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
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${t?.color ?? "bg-gray-100 text-gray-700"}`}
                            >
                              {fr ? t?.fr : t?.ht}
                            </span>
                          );
                        })}
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                        <MetaBadges
                          verifiedAt={entry.verifiedAt}
                          updatedAt={entry.updatedAt}
                          lang={lang}
                        />

                        {/* Sources */}
                        {entry.sources.length > 0 && (
                          <div className="text-xs text-gray-400">
                            📚{" "}
                            {entry.sources.map((s, i) => (
                              <span key={i}>
                                {i > 0 && " · "}
                                <a
                                  href={s.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-600 hover:underline"
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
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center text-gray-400">
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
       *  SECTION B — Cette semaine dans l'histoire
       * ═══════════════════════════════════════════════════════════════════ */}
      {weekEntries.length > 0 && (
        <section className="mx-auto mt-14 max-w-4xl">
          <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-gray-900">
            <Calendar className="h-5 w-5 text-brand-600" />
            {fr ? "Cette semaine dans l\u2019histoire" : "Semèn sa a nan istwa"}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {weekEntries.map(({ monthDay, entry }) => (
              <div
                key={entry.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
              >
                {/* Date accent stripe */}
                <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-brand-500 to-indigo-400 opacity-0 transition group-hover:opacity-100" />

                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 flex-col items-center justify-center rounded-lg bg-gray-100 text-brand-700 group-hover:bg-brand-50">
                    <span className="text-lg font-bold leading-tight">
                      {parseInt(monthDay.split("-")[1]!, 10)}
                    </span>
                    <span className="text-[9px] font-medium uppercase text-gray-400">
                      {(fr ? MONTH_NAMES_FR : MONTH_NAMES_HT)[parseInt(monthDay.split("-")[0]!, 10) - 1]?.slice(0, 3)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-gray-900 leading-snug">
                      {entry.title_fr}
                    </h3>
                    {entry.year != null && (
                      <span className="text-xs text-gray-400">
                        {entry.year}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-gray-500 line-clamp-2">
                  {firstSentence(entry.summary_fr)}
                </p>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {entry.tags.slice(0, 2).map((tag) => {
                      const t = TAG_LABELS[tag];
                      return (
                        <span
                          key={tag}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t?.color ?? "bg-gray-100 text-gray-700"}`}
                        >
                          {fr ? t?.fr : t?.ht}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
       *  SECTION C — Parcourir par mois (always-visible archive)
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="mx-auto mt-14 max-w-4xl">
        <Suspense
          fallback={
            <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
          }
        >
          <HistoireArchive lang={lang} defaultMonth={todayMonth} />
        </Suspense>
      </section>
    </div>
  );
}
