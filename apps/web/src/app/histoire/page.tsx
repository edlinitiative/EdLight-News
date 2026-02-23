/**
 * /histoire — Haiti History & Holidays of the Day
 *
 * Displays today's history entries + holiday for the current MM-DD,
 * plus a monthly archive browser.
 */

import Link from "next/link";
import { BookOpen, Calendar, Star, ArrowLeft, Tag } from "lucide-react";
import type { ContentLanguage, AlmanacTag } from "@edlight-news/types";
import { MetaBadges } from "@/components/MetaBadges";
import {
  fetchAlmanacByMonthDay,
  fetchHolidaysByMonthDay,
  fetchAlmanacByMonth,
  fetchAllHolidays,
  getHaitiMonthDay,
} from "@/lib/datasets";

export const revalidate = 900;

// ── Tag display ──────────────────────────────────────────────────────────────

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
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTH_NAMES_HT = [
  "Janvye", "Fevriye", "Mas", "Avril", "Me", "Jen",
  "Jiyè", "Out", "Septanm", "Oktòb", "Novanm", "Desanm",
];

export default async function HistoirePage({
  searchParams,
}: {
  searchParams: { lang?: string; month?: string };
}) {
  const lang: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";
  const fr = lang === "fr";
  const langQ = lang === "ht" ? "?lang=ht" : "";
  const lq = (path: string) => path + langQ;

  const todayMD = getHaitiMonthDay();
  const selectedMonth = searchParams.month ?? todayMD.split("-")[0]!;

  // Fetch data in parallel
  let todayEntries: Awaited<ReturnType<typeof fetchAlmanacByMonthDay>>;
  let todayHolidays: Awaited<ReturnType<typeof fetchHolidaysByMonthDay>>;
  let monthEntries: Awaited<ReturnType<typeof fetchAlmanacByMonth>>;
  let allHolidays: Awaited<ReturnType<typeof fetchAllHolidays>>;
  try {
    [todayEntries, todayHolidays, monthEntries, allHolidays] = await Promise.all([
      fetchAlmanacByMonthDay(todayMD),
      fetchHolidaysByMonthDay(todayMD),
      fetchAlmanacByMonth(selectedMonth),
      fetchAllHolidays(),
    ]);
  } catch (err) {
    console.error("[EdLight] /histoire fetch failed:", err);
    todayEntries = [];
    todayHolidays = [];
    monthEntries = [];
    allHolidays = [];
  }

  const [, todayDay] = todayMD.split("-");
  const monthIndex = parseInt(selectedMonth, 10) - 1;
  const monthName = fr ? MONTH_NAMES_FR[monthIndex] : MONTH_NAMES_HT[monthIndex];

  // Holidays in the selected month
  const monthHolidays = allHolidays.filter((h) => h.monthDay.startsWith(selectedMonth + "-"));

  return (
    <div className="space-y-10">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="text-center space-y-3">
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center justify-center gap-2">
          <BookOpen className="h-8 w-8 text-brand-600" />
          {fr ? "Histoire & Fèt du jour" : "Istwa & Fèt jou a"}
        </h1>
        <p className="text-gray-600 max-w-xl mx-auto">
          {fr
            ? "Découvrez chaque jour ce qui s'est passé dans l'histoire d'Haïti — événements, héros, et fêtes nationales."
            : "Dekouvri chak jou sa ki te pase nan istwa Ayiti — evènman, ewo, ak fèt nasyonal."}
        </p>
      </section>

      {/* ── Today's Card ────────────────────────────────────────────────── */}
      {(todayEntries.length > 0 || todayHolidays.length > 0) && (
        <section className="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-amber-600" />
            <h2 className="text-xl font-bold">
              {fr ? `Aujourd'hui — ${todayDay}/${selectedMonth}` : `Jodi a — ${todayDay}/${selectedMonth}`}
            </h2>
          </div>

          {/* Holiday badges */}
          {todayHolidays.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {todayHolidays.map((h) => (
                <div
                  key={h.id}
                  className="rounded-lg border border-amber-200 bg-white px-4 py-3 shadow-sm"
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

          {/* Today's history entries */}
          <div className="space-y-4">
            {todayEntries
              .sort((a, b) => {
                if (a.confidence === "high" && b.confidence !== "high") return -1;
                if (a.confidence !== "high" && b.confidence === "high") return 1;
                return 0;
              })
              .map((entry) => (
                <div key={entry.id} className="rounded-lg border border-amber-100 bg-white p-4 shadow-sm">
                  <h3 className="font-bold text-gray-900">
                    {entry.title_fr}
                    {entry.year && <span className="ml-1 text-sm font-normal text-gray-500">({entry.year})</span>}
                  </h3>
                  <p className="mt-2 text-sm text-gray-700 leading-relaxed">
                    {entry.summary_fr}
                  </p>
                  {entry.student_takeaway_fr && (
                    <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                      💡 <strong>{fr ? "Pour les étudiants" : "Pou etidyan yo"} :</strong>{" "}
                      {entry.student_takeaway_fr}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
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
                  <div className="mt-1">
                    <MetaBadges
                      verifiedAt={entry.verifiedAt}
                      updatedAt={entry.updatedAt}
                      lang={lang}
                    />
                  </div>
                  {entry.sources.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
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
              ))}
          </div>
        </section>
      )}

      {/* If no content today */}
      {todayEntries.length === 0 && todayHolidays.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-gray-200 py-10 text-center text-gray-400">
          <BookOpen className="mx-auto h-8 w-8 mb-2" />
          <p>{fr
            ? `Pas encore de contenu pour le ${todayDay}/${selectedMonth}. Revenez bientôt !`
            : `Pa gen konteni pou ${todayDay}/${selectedMonth} ankò. Retounen byento!`}
          </p>
        </div>
      )}

      {/* ── Month selector ──────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          {fr ? "Parcourir par mois" : "Navige pa mwa"}
        </h2>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }, (_, i) => {
            const mm = String(i + 1).padStart(2, "0");
            const isActive = mm === selectedMonth;
            const name = fr ? MONTH_NAMES_FR[i] : MONTH_NAMES_HT[i];
            return (
              <Link
                key={mm}
                href={`/histoire?month=${mm}${lang === "ht" ? "&lang=ht" : ""}`}
                className={[
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                  isActive
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-brand-100 hover:text-brand-700",
                ].join(" ")}
              >
                {name}
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Month archive ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold">
          {monthName} — {fr ? "Événements historiques" : "Evènman istorik"}
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({monthEntries.length} {fr ? "entrées" : "antre"})
          </span>
        </h2>

        {/* Holidays this month */}
        {monthHolidays.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-amber-700 flex items-center gap-1">
              <Star className="h-4 w-4" />
              {fr ? "Fêtes ce mois" : "Fèt mwa sa a"}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {monthHolidays.map((h) => {
                const [, dd] = h.monthDay.split("-");
                return (
                  <div key={h.id} className="flex items-center gap-3 rounded-lg border bg-amber-50/50 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white font-bold text-sm">
                      {dd}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">
                        {fr ? h.name_fr : h.name_ht}
                      </p>
                      {h.isNationalHoliday && (
                        <span className="text-[10px] text-amber-600">🇭🇹 {fr ? "Fête nationale" : "Fèt nasyonal"}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* History entries for the month */}
        {monthEntries.length > 0 ? (
          <div className="space-y-3">
            {monthEntries
              .sort((a, b) => a.monthDay.localeCompare(b.monthDay))
              .map((entry) => {
                const [, dd] = entry.monthDay.split("-");
                return (
                  <div key={entry.id} className="flex gap-4 rounded-lg border bg-white p-4 shadow-sm">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-600 text-white">
                      <span className="text-lg font-bold leading-tight">{dd}</span>
                      <span className="text-[9px] uppercase">
                        {(fr ? MONTH_NAMES_FR[monthIndex] : MONTH_NAMES_HT[monthIndex])?.slice(0, 3)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-sm">
                        {entry.title_fr}
                        {entry.year && <span className="ml-1 text-xs text-gray-400">({entry.year})</span>}
                      </h3>
                      <p className="mt-1 text-xs text-gray-600 line-clamp-2">{entry.summary_fr}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.tags?.slice(0, 3).map((tag) => {
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
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-gray-200 py-8 text-center text-gray-400">
            <p>{fr ? "Aucune entrée pour ce mois." : "Pa gen antre pou mwa sa a."}</p>
          </div>
        )}
      </section>
    </div>
  );
}
