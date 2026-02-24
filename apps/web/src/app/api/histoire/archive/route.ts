/**
 * GET /api/histoire/archive
 *
 * Week view:  ?view=week&weekOffset=0&lang=fr&tag=culture
 * Month view: ?month=03&tag=culture
 *
 * Returns almanac entries + holidays for the requested range.
 * Used by the client-side HistoireArchive component.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  fetchAlmanacByMonth,
  fetchAlmanacByMonthDayRange,
  fetchAllHolidays,
} from "@/lib/datasets";
import { getHaitiWeekBounds } from "@/lib/week";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const view = searchParams.get("view");
  const tag = searchParams.get("tag");

  // ── Week view ──────────────────────────────────────────────────────────
  if (view === "week") {
    const weekOffset =
      parseInt(searchParams.get("weekOffset") ?? "0", 10) || 0;
    const lang = searchParams.get("lang") === "ht" ? "ht" : "fr";
    const bounds = getHaitiWeekBounds(weekOffset, lang);

    const [entries, allHolidays] = await Promise.all([
      fetchAlmanacByMonthDayRange(bounds.start, bounds.end),
      fetchAllHolidays(),
    ]);

    const filtered = tag
      ? entries.filter((e) => e.tags?.includes(tag as never))
      : entries;

    const weekHolidays = allHolidays.filter((h) =>
      bounds.days.includes(h.monthDay),
    );

    return NextResponse.json({
      entries: filtered,
      holidays: weekHolidays,
      weekLabel: bounds.label,
      days: bounds.days,
      dayLabels: bounds.dayLabels,
    });
  }

  // ── Month view (existing) ─────────────────────────────────────────────
  const month = searchParams.get("month");

  if (!month || !/^\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "Missing or invalid 'month' param (expected MM)" },
      { status: 400 },
    );
  }

  const [entries, allHolidays] = await Promise.all([
    fetchAlmanacByMonth(month),
    fetchAllHolidays(),
  ]);

  const filtered = tag
    ? entries.filter((e) => e.tags?.includes(tag as never))
    : entries;

  const monthHolidays = allHolidays.filter((h) =>
    h.monthDay.startsWith(month + "-"),
  );

  return NextResponse.json({ entries: filtered, holidays: monthHolidays });
}
