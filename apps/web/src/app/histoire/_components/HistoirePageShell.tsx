"use client";

/**
 * HistoirePageShell — client-side orchestrator for the /histoire page.
 *
 * Assembles all editorial sections into a cohesive, museum-like experience:
 *   ① HistoryHero — immersive serif headline + stats + cinematic image
 *   ② DateNavigator — sticky horizontal date strip
 *   ③ HistoireClient — dynamic almanac content (WeekStrip, HeroFact, HistoryList, ExplorePanel)
 *   ④ FeaturedSpotlight — editorial card for the day's featured event
 *   ⑤ RelatedEventsSection — "Aussi ce jour-là" grid
 *   ⑥ ThemeCollections — thematic archive exploration
 *   ⑦ HistoryFooter — editorial footer
 *
 * Fully data-driven — all editorial sections consume real almanac data
 * from the server-side page component (no static mock data).
 */

import { useState, useMemo } from "react";
import { HistoryHero } from "./HistoryHero";
import { DateNavigator } from "./DateNavigator";
import { FeaturedSpotlight } from "./FeaturedSpotlight";
import { RelatedEventsSection } from "./RelatedEventsSection";
import { ThemeCollections } from "./ThemeCollections";
import {
  getWeekAroundDate,
  formatMonthDay,
  pickHeroEntry,
} from "./shared";

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
  const [selectedDate, setSelectedDate] = useState(todayMD);

  // ── Derived data ──────────────────────────────────────────
  const days = useMemo(
    () => getWeekAroundDate(selectedDate),
    [selectedDate],
  );

  const todayEntries = useMemo(
    () => monthEntries.filter((e) => e.monthDay === selectedDate),
    [monthEntries, selectedDate],
  );

  const heroEntry = useMemo(
    () => pickHeroEntry(todayEntries),
    [todayEntries],
  );

  const secondaryEntries = useMemo(
    () =>
      heroEntry
        ? todayEntries.filter((e) => e.id !== heroEntry.id)
        : todayEntries,
    [todayEntries, heroEntry],
  );

  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const md of days) {
      counts[md] = monthEntries.filter((e) => e.monthDay === md).length;
    }
    return counts;
  }, [days, monthEntries]);

  const todayLabel = formatMonthDay(todayMD, lang);
  const dateLabel = formatMonthDay(selectedDate, lang);

  return (
    <div className="space-y-0">
      {/* ── ① Hero: serif headline + stats + cinematic image ── */}
      <HistoryHero
        lang={lang}
        totalEvents={monthEntries.length}
        totalHolidays={allHolidays.length}
        heroEntry={heroEntry}
        todayLabel={todayLabel}
      />

      {/* ── ② Sticky date navigator ──────────────────────────── */}
      <div className="mt-16 md:mt-20">
        <DateNavigator
          days={days}
          selectedDate={selectedDate}
          todayDate={todayMD}
          onSelect={setSelectedDate}
          lang={lang}
          entryCounts={entryCounts}
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
      {heroEntry && (
        <div className="pt-16 md:pt-24">
          <FeaturedSpotlight entry={heroEntry} lang={lang} />
        </div>
      )}

      {/* ── ⑤ Related events: "Aussi ce jour-là" ─────────────── */}
      {secondaryEntries.length > 0 && (
        <RelatedEventsSection
          entries={secondaryEntries}
          lang={lang}
          dateLabel={dateLabel}
        />
      )}

      {/* ── ⑥ Thematic exploration ────────────────────────────── */}
      <ThemeCollections lang={lang} />
    </div>
  );
}
