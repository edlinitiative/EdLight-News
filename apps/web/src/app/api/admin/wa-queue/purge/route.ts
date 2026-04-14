import { NextResponse } from "next/server";
import { waQueueRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/wa-queue/purge
 * Deletes ALL documents in the wa_queue collection.
 */
export async function POST() {
  try {
    const deleted = await waQueueRepo.purgeAll();
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error("[api/admin/wa-queue/purge] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Purge failed" },
      { status: 500 },
    );
  }
}
