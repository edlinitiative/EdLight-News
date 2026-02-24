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
    <div className="mx-auto max-w-3xl space-y-12">
      {/* ═══════════════════════════════════════════════════════════════════
       *  SECTION A — Aujourd'hui (Hero)
       * ═══════════════════════════════════════════════════════════════════ */}
      <section className="space-y-5">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl flex items-center justify-center gap-2">
            <BookOpen className="h-8 w-8 text-brand-600" />
            {fr ? "Aujourd\u2019hui dans l\u2019histoire d\u2019Haïti" : "Jodi a nan istwa Ayiti"}
          </h1>
          <p className="text-lg text-gray-500">
            {formatMonthDay(todayMD, lang)}
          </p>
        </div>

        {/* Holiday badges */}
        {todayHolidays.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {todayHolidays.map((h) => (
              <div
                key={h.id}
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  <span className="font-bold text-gray-900">
                    {fr ? h.name_fr : h.name_ht}
                  </span>
                  {h.isNationalHoliday && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      🇭🇹 {fr ? "Fête nationale" : "Fèt nasyonal"}
                    </span>
                  )}
                </div>
                {(fr ? h.description_fr : h.description_ht) && (
                  <p className="mt-1 text-sm text-gray-600">
                    {fr ? h.description_fr : h.description_ht}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Today's history entries — full long-form */}
        {todayEntries.length > 0 ? (
          <div className="space-y-6">
            {todayEntries
              .sort((a, b) => {
                if (a.confidence === "high" && b.confidence !== "high") return -1;
                if (a.confidence !== "high" && b.confidence === "high") return 1;
                return 0;
              })
              .map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-6 shadow-sm space-y-4"
                >
                  <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
                    {entry.title_fr}
                    {entry.year != null && (
                      <span className="ml-2 text-base font-normal text-gray-500">
                        ({entry.year})
                      </span>
                    )}
                  </h2>

                  <p className="text-base leading-relaxed text-gray-700">
                    {entry.summary_fr}
                  </p>

                  {entry.student_takeaway_fr && (
                    <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                      💡{" "}
                      <strong>
                        {fr ? "Pour les étudiants" : "Pou etidyan yo"} :
                      </strong>{" "}
                      {entry.student_takeaway_fr}
                    </div>
                  )}

                  {/* Tags + confidence */}
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.tags?.map((tag) => {
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
                    {entry.confidence === "high" && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                        ✓ {fr ? "Vérifié" : "Verifye"}
                      </span>
                    )}
                  </div>

                  <MetaBadges
                    verifiedAt={entry.verifiedAt}
                    updatedAt={entry.updatedAt}
                    lang={lang}
                  />

                  {/* Sources */}
                  {entry.sources.length > 0 && (
                    <div className="text-xs text-gray-500">
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
                </article>
              ))}
          </div>
        ) : todayHolidays.length === 0 ? (
          /* Empty state — no fallback to random data */
          <div className="rounded-lg border-2 border-dashed border-gray-200 py-10 text-center text-gray-400">
            <BookOpen className="mx-auto mb-2 h-8 w-8" />
            <p>
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
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-bold">
            <Calendar className="h-5 w-5 text-gray-600" />
            {fr ? "Cette semaine dans l\u2019histoire" : "Semèn sa a nan istwa"}
          </h2>

          {/* Horizontal scroll on mobile, grid on desktop */}
          <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
            {weekEntries.map(({ monthDay, entry }) => (
              <div
                key={entry.id}
                className="min-w-[260px] shrink-0 rounded-lg border bg-white p-4 shadow-sm sm:min-w-0"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                    {parseInt(monthDay.split("-")[1]!, 10)}
                  </span>
                  <span className="text-sm font-medium text-gray-500">
                    {formatMonthDay(monthDay, lang)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {entry.title_fr}
                  {entry.year != null && (
                    <span className="ml-1 text-xs text-gray-400">
                      ({entry.year})
                    </span>
                  )}
                </h3>
                <p className="mt-1 text-xs text-gray-600 line-clamp-2">
                  {firstSentence(entry.summary_fr)}
                </p>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {entry.tags.slice(0, 2).map((tag) => {
                      const t = TAG_LABELS[tag];
                      return (
                        <span
                          key={tag}
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${t?.color ?? "bg-gray-100 text-gray-700"}`}
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
       *  SECTION C — Explorer par date (collapsible archive)
       * ═══════════════════════════════════════════════════════════════════ */}
      <Suspense
        fallback={
          <div className="h-14 animate-pulse rounded-lg bg-gray-100" />
        }
      >
        <HistoireArchive lang={lang} defaultMonth={todayMonth} />
      </Suspense>
    </div>
  );
}
