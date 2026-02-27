/**
 * /histoire — Aujourd'hui dans l'histoire d'Haïti
 *
 * Layout (server component):
 *   Header: title + subtitle
 *   HistoireClient: hero date block → sticky WeekStrip → tabs → list → explore
 *
 * Data: existing fetchers only — no backend changes.
 */

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
import { serializeEntry, serializeHoliday } from "./_components/shared";

export const revalidate = 900;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const lang = getLangFromSearchParams(searchParams);
  const fr = lang === "fr";
  const title = fr
    ? "Aujourd'hui dans l'histoire — Haïti · EdLight News"
    : "Jodi a nan istwa — Ayiti · EdLight News";
  const description = fr
    ? "Éphéméride haïtienne : événements historiques, fêtes et personnalités du jour."
    : "Efemerid ayisyen : evènman istorik, fèt ak pèsonalite jou a.";
  return {
    title,
    description,
    ...buildOgMetadata({ title, description, path: "/histoire", lang }),
  };
}

export default async function HistoirePage({
  searchParams,
}: {
  searchParams: { lang?: string };
}) {
  const lang: ContentLanguage = searchParams.lang === "ht" ? "ht" : "fr";
  const fr = lang === "fr";

  const todayMD = getHaitiMonthDay();
  const todayMonth = todayMD.split("-")[0]!;

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
      {/* ─── Header ─────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <h1 className="headline-lead">
          {fr ? "Aujourd\u2019hui dans l\u2019histoire" : "Jodi a nan istwa"}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-500 dark:text-stone-400 sm:text-base">
          {fr
            ? "Parcourez les événements historiques, fêtes et personnalités d\u2019Haïti, jour par jour."
            : "Navige nan evènman istorik, fèt ak pèsonalite Ayiti, jou pa jou."}
        </p>
      </section>

      {/* ─── Interactive content ──────────────────────────────────── */}
      <section className="mx-auto mt-6 max-w-6xl px-4 sm:px-6">
        <HistoireClient
          todayMD={todayMD}
          monthEntries={monthEntries.map(serializeEntry)}
          allHolidays={allHolidays.map(serializeHoliday)}
          prefetchedMonth={todayMonth}
          lang={lang}
        />
      </section>
    </div>
  );
}
