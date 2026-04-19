import { NextResponse } from "next/server";
import { xQueueRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/x-queue/purge
 * Deletes ALL documents in the x_queue collection.
 */
export async function POST() {
  try {
    const deleted = await xQueueRepo.purgeAll();
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error("[api/admin/x-queue/purge] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Purge failed" },
      { status: 500 },
    );
  }
}
