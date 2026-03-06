/**
 * GET /api/admin/histoire/entries?monthDay=03-06
 *
 * Returns all almanac entries for the given MM-DD, used by the admin
 * image editor to list entries for a selected date.
 */

import { NextRequest, NextResponse } from "next/server";
import { haitiHistoryAlmanacRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const monthDay = req.nextUrl.searchParams.get("monthDay");

  if (!monthDay || !/^\d{2}-\d{2}$/.test(monthDay)) {
    return NextResponse.json(
      { error: "Missing or invalid monthDay param (expected MM-DD)" },
      { status: 400 },
    );
  }

  try {
    const entries = await haitiHistoryAlmanacRepo.listByMonthDay(monthDay);

    // Convert Timestamps to ISO strings for JSON serialisation
    const serialized = entries.map((e) => ({
      ...e,
      verifiedAt: e.verifiedAt?.toDate?.().toISOString?.() ?? null,
      updatedAt: e.updatedAt?.toDate?.().toISOString?.() ?? null,
    }));

    return NextResponse.json({ entries: serialized });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
