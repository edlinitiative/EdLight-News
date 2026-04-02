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
import { Landmark } from "lucide-react";
import { buildOgMetadata } from "@/lib/og";
import {
  fetchAlmanacByMonth,
  fetchAllHolidays,
  getHaitiMonthDay,
} from "@/lib/datasets";
import { HistoireClient } from "./_components/HistoireClient";
import { serializeEntry, serializeHoliday } from "./_components/shared";
import { PageHero } from "@/components/PageHero";

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

  const l = (href: string) => `${href}?lang=${lang}`;

  return (
    <div className="space-y-10 pb-14">
      {/* ─── Hero ────────────────────────────────────────────────── */}
      <PageHero
        variant="history"
        eyebrow={fr ? "Éphéméride haïtienne" : "Efemerid ayisyèn"}
        title={
          fr
            ? "Chaque jour porte une page de l\u2019histoire d\u2019Haïti."
            : "Chak jou gen yon paj nan istwa Ayiti."
        }
        description={
          fr
            ? "Explorez les événements historiques, fêtes nationales et personnalités marquantes, jour par jour, mois par mois."
            : "Eksplore evènman istorik, fèt nasyonal ak pèsonalite enpòtan yo, jou pa jou, mwa pa mwa."
        }
        icon={<Landmark className="h-5 w-5" />}
        actions={[
          { href: l("/haiti"), label: fr ? "Haïti en direct" : "Ayiti dirèk" },
          { href: l("/news"), label: fr ? "Retour aux actualités" : "Retounen nan nouvèl" },
        ]}
        stats={[
          {
            value: monthEntries.length > 0 ? String(monthEntries.length) : "—",
            label: fr ? "événements ce mois" : "evènman mwa sa",
          },
          {
            value: allHolidays.length > 0 ? String(allHolidays.length) : "—",
            label: fr ? "fêtes nationales" : "fèt nasyonal",
          },
          { value: "12", label: fr ? "mois explorés" : "mwa ekspore" },
        ]}
      />

      {/* ─── Interactive content ──────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
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
