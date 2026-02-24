/**
 * GET /api/histoire/archive?month=03&tag=culture
 *
 * Returns almanac entries + holidays for a given month.
 * Used by the client-side archive component so we don't have to
 * fetch all 365 entries on initial page load.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchAlmanacByMonth, fetchAllHolidays } from "@/lib/datasets";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const month = searchParams.get("month");
  const tag = searchParams.get("tag");

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

  // Filter entries by tag if provided
  const filtered = tag
    ? entries.filter((e) => e.tags?.includes(tag as never))
    : entries;

  // Filter holidays to this month
  const monthHolidays = allHolidays.filter((h) =>
    h.monthDay.startsWith(month + "-"),
  );

  return NextResponse.json({ entries: filtered, holidays: monthHolidays });
}
