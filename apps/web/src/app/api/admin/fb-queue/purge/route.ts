import { NextResponse } from "next/server";
import { fbQueueRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/fb-queue/purge
 * Deletes ALL documents in the fb_queue collection.
 */
export async function POST() {
  try {
    const deleted = await fbQueueRepo.purgeAll();
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error("[api/admin/fb-queue/purge] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Purge failed" },
      { status: 500 },
    );
  }
}
