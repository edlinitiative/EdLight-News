/**
 * /histoire — Fait du Jour · Aujourd'hui dans l'histoire d'Haïti
 *
 * Refactored "Fait du Jour" layout:
 *   1) Light header (title + subtitle)
 *   2) HistoryHero — today's top facts
 *   3) WeekStrip — 7-day browse strip
 *   4) ExplorePanel — deeper navigation (collapsed)
 *   5) HistoryList — selected date's facts with "Voir plus"
 *
 * All data comes from existing fetchers; no backend changes.
 */

import { CalendarDays } from "lucide-react";
import type { Metadata } from "next";
import type { ContentLanguage } from "@edlight-news/types";
import { getLangFromSearchParams } from "@/lib/content";
import { buildOgMetadata } from "@/lib/og";
import {
  fetchAlmanacByMonth,
  fetchAllHolidays,
  getHaitiMonthDay,
} from "@/lib/datasets";
import { HistoireClient } from "./_components/HistoireClient";

export const revalidate = 900;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr
    ? "Fait du Jour — Histoire d'Haïti · EdLight News"
    : "Reyalite Jounen an — Istwa Ayiti · EdLight News";
  const description = fr
    ? "Éphéméride haïtienne : événements historiques, fêtes et personnalités du jour."
    : "Efemerid ayisyen : evènman istorik, fèt ak pèsonalite jou a.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/histoire", lang }),
  };
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

  // ── Fetch current month's entries + all holidays (existing fetchers) ──
  let monthEntries: Awaited<ReturnType<typeof fetchAlmanacByMonth>> = [];
  let allHolidays: Awaited<ReturnType<typeof fetchAllHolidays>> = [];
  try {
    [monthEntries, allHolidays] = await Promise.all([
      fetchAlmanacByMonth(todayMonth),
      fetchAllHolidays(),
    ]);
  } catch (err) {
    console.error("[EdLight] /histoire fetch failed:", err);
  }

  return (
    <div className="pb-14">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-4 pt-2 sm:px-6">
        <div className="section-rule" />

        <div className="mt-4 flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-stone-900 dark:text-white">
            {fr ? "Fait du Jour" : "Reyalite Jounen an"}
          </p>
        </div>

        <h1 className="headline-lead mt-3">
          {fr ? "Aujourd\u2019hui dans l\u2019histoire d\u2019Haïti" : "Jodi a nan istwa Ayiti"}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500 dark:text-stone-400 sm:text-base">
          {fr
            ? "Éphéméride haïtienne — parcourez les événements historiques, fêtes et personnalités jour par jour."
            : "Efemerid ayisyen — navige nan evènman istorik, fèt ak pèsonalite jou pa jou."}
        </p>
      </section>

      {/* ─── Interactive content (client component) ───────────────── */}
      <section className="mx-auto mt-8 max-w-4xl px-4 sm:px-6">
        <HistoireClient
          todayMD={todayMD}
          monthEntries={monthEntries}
          allHolidays={allHolidays}
          prefetchedMonth={todayMonth}
          lang={lang}
        />
      </section>
    </div>
  );
}
