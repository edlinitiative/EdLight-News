"use client";

/**
 * HistoirePageShell — client-side orchestrator for the /histoire page.
 *
 * Assembles all editorial sections into a cohesive, museum-like experience:
 *   ① HistoryHero — immersive serif headline + stats + cinematic image
 *   ② DateNavigator — sticky horizontal date strip
 *   ③ FeaturedSpotlight — editorial card for the day's featured event
 *   ④ RelatedEventsSection — "Aussi ce jour-là" grid
 *   ⑤ ThemeCollections — thematic archive exploration
 *   ⑥ HistoryFooter — editorial footer
 *
 * Also renders the existing data-driven HistoireClient for the dynamic
 * almanac content (WeekStrip, HeroFact, HistoryList, ExplorePanel).
 *
 * This shell preserves the premium visual direction while integrating
 * real data from the server-side page component.
 */

import { useState } from "react";
import { HistoryHero } from "./HistoryHero";
import { DateNavigator } from "./DateNavigator";
import { FeaturedSpotlight } from "./FeaturedSpotlight";
import { RelatedEventsSection } from "./RelatedEventsSection";
import { ThemeCollections } from "./ThemeCollections";
import { HistoryFooter } from "./HistoryFooter";
import {
  heroContent,
  historyStats,
  dateNavItems,
  featuredSpotlight,
  relatedEvents,
  themeCollections,
  footerSections,
} from "./data";

/* ── Existing dynamic components ──────────────────────────── */
import type { ContentLanguage } from "@edlight-news/types";
import { HistoireClient } from "./HistoireClient";
import type { SerializableAlmanacEntry, SerializableHoliday } from "./shared";

interface HistoirePageShellProps {
  /** Server-fetched data for the dynamic almanac section */
  todayMD: string;
  monthEntries: SerializableAlmanacEntry[];
  allHolidays: SerializableHoliday[];
  prefetchedMonth: string;
  lang: ContentLanguage;
}

export function HistoirePageShell({
  todayMD,
  monthEntries,
  allHolidays,
  prefetchedMonth,
  lang,
}: HistoirePageShellProps) {
  const [selectedDate, setSelectedDate] = useState(
    dateNavItems.find((d) => d.isToday)?.monthDay ?? "01-01",
  );

  return (
    <div className="space-y-0">
      {/* ── ① Hero: serif headline + stats + cinematic image ── */}
      <HistoryHero content={heroContent} stats={historyStats} />

      {/* ── ② Sticky date navigator ──────────────────────────── */}
      <div className="mt-16 md:mt-20">
        <DateNavigator
          items={dateNavItems}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />
      </div>

      {/* ── ③ Dynamic almanac content (data-driven) ──────────── */}
      <section className="pt-8">
        <HistoireClient
          todayMD={todayMD}
          monthEntries={monthEntries}
          allHolidays={allHolidays}
          prefetchedMonth={prefetchedMonth}
          lang={lang}
        />
      </section>

      {/* ── ④ Featured spotlight (editorial) ──────────────────── */}
      <div className="pt-16 md:pt-24">
        <FeaturedSpotlight event={featuredSpotlight} />
      </div>

      {/* ── ⑤ Related events: "Aussi ce jour-là" ─────────────── */}
      <RelatedEventsSection events={relatedEvents} />

      {/* ── ⑥ Thematic exploration ────────────────────────────── */}
      <ThemeCollections themes={themeCollections} />

      {/* ── ⑦ Editorial footer ────────────────────────────────── */}
      <HistoryFooter sections={footerSections} />
    </div>
  );
}
