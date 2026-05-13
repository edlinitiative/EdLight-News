import { NextResponse } from "next/server";
import { waChannelSnapshotsRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

interface SnapshotBody {
  dateISO?: string;
  followerCount?: number;
  source?: "manual" | "script" | "api";
  notes?: string;
}

/**
 * POST a new WhatsApp Channel follower-count snapshot.
 *
 * Body: { dateISO, followerCount, source, notes? }
 * - dateISO defaults to today (UTC)
 * - source defaults to "manual"
 * - followerCount is required and must be a non-negative integer.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as SnapshotBody;
    const followerCount = Number(body.followerCount);
    if (!Number.isFinite(followerCount) || followerCount < 0) {
      return NextResponse.json(
        { error: "followerCount must be a non-negative number" },
        { status: 400, ...NO_STORE },
      );
    }
    const dateISO =
      typeof body.dateISO === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dateISO)
        ? body.dateISO
        : new Date().toISOString().slice(0, 10);
    const source: "manual" | "script" | "api" =
      body.source === "script" || body.source === "api" ? body.source : "manual";
    const created = await waChannelSnapshotsRepo.create({
      dateISO,
      followerCount: Math.round(followerCount),
      source,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : undefined,
    });
    return NextResponse.json({ snapshot: created }, NO_STORE);
  } catch (err) {
    console.error("[api/admin/wa-channel/snapshot] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500, ...NO_STORE },
    );
  }
}
