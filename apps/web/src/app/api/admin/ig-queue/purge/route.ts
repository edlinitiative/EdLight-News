import { NextResponse } from "next/server";
import { igQueueRepo, deleteCarouselSlides } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // allow up to 5 min for large purge

/**
 * POST /api/admin/ig-queue/purge
 *
 * Deletes ALL ig_queue documents and their associated Storage slides.
 * This is a destructive operation — meant for "start fresh" scenarios.
 */
export async function POST() {
  try {
    // 1. Grab all doc IDs before deleting so we can clean Storage too
    const allItems = await igQueueRepo.listAll(5000);
    const ids = allItems.map((item) => item.id);

    // 2. Delete Storage slides in parallel (best-effort)
    const storageResults = await Promise.allSettled(
      ids.map((id) => deleteCarouselSlides(id)),
    );
    const storageDeleted = storageResults.filter((r) => r.status === "fulfilled").length;
    const storageFailed = storageResults.filter((r) => r.status === "rejected").length;

    // 3. Purge all Firestore docs
    const docsDeleted = await igQueueRepo.purgeAll();

    return NextResponse.json({
      ok: true,
      docsDeleted,
      storageDeleted,
      storageFailed,
      message: `Purged ${docsDeleted} queue items and cleaned ${storageDeleted} storage folders.`,
    });
  } catch (error) {
    console.error("[purge] Error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
