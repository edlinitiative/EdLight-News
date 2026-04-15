/**
 * /histoire — Éphéméride haïtienne
 *
 * Premium editorial archive page. Server component handles:
 *   - Metadata generation (SEO, OpenGraph)
 *   - Data fetching (almanac entries, holidays) with ISR
 *   - Serialization for client boundary
 *
 * The HistoirePageShell client component orchestrates all visual
 * sections: hero, date nav, spotlight, related events, themes, footer.
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
import { HistoirePageShell } from "./_components/HistoirePageShell";
import { serializeEntry, serializeHoliday } from "./_components/shared";

// Content changes once per day (~07:10 Haiti time); 3600 s is sufficient
export const revalidate = 3600;

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
    <div className="-mx-4 -mt-8 sm:-mx-6 lg:-mx-8">
      <div className="mx-auto max-w-screen-2xl px-6 pb-0 md:px-8">
        <HistoirePageShell
          todayMD={todayMD}
          monthEntries={monthEntries.map(serializeEntry)}
          allHolidays={allHolidays.map(serializeHoliday)}
          prefetchedMonth={todayMonth}
          lang={lang}
        />
      </div>
    </div>
  );
}
