import { NextResponse } from "next/server";
import { thQueueRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/th-queue/purge
 * Deletes ALL documents in the th_queue collection.
 */
export async function POST() {
  try {
    const deleted = await thQueueRepo.purgeAll();
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error("[api/admin/th-queue/purge] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Purge failed" },
      { status: 500 },
    );
  }
}
