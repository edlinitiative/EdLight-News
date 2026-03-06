import { NextResponse } from "next/server";
import { getDb } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const snap = await db
      .collection("ig_queue")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const items = snap.docs.map((doc) => {
      const data = doc.data();

      // Full slides array for visual preview
      const slides = (data.payload?.slides ?? []).map(
        (s: { heading?: string; bullets?: string[]; footer?: string; backgroundImage?: string }) => ({
          heading: s.heading ?? "",
          bullets: s.bullets ?? [],
          footer: s.footer ?? null,
          backgroundImage: s.backgroundImage ?? null,
        }),
      );

      // Meme slide removed — memes are no longer generated

      return {
        id: doc.id,
        sourceContentId: data.sourceContentId,
        igType: data.igType,
        score: data.score,
        status: data.status,
        scheduledFor: data.scheduledFor ?? null,
        reasons: data.reasons ?? [],
        caption: data.payload?.caption ?? null,
        slides,
        slidesCount: slides.length,
        dryRunPath: data.dryRunPath ?? null,
        igPostId: data.igPostId ?? null,
        createdAt: data.createdAt?._seconds
          ? new Date(data.createdAt._seconds * 1000).toISOString()
          : null,
        updatedAt: data.updatedAt?._seconds
          ? new Date(data.updatedAt._seconds * 1000).toISOString()
          : null,
      };
    });

    // Summary counts
    const counts = {
      queued: items.filter((i) => i.status === "queued").length,
      scheduled: items.filter((i) => i.status === "scheduled" || i.status === "scheduled_ready_for_manual").length,
      posted: items.filter((i) => i.status === "posted").length,
      skipped: items.filter((i) => i.status === "skipped").length,
      rendering: items.filter((i) => i.status === "rendering").length,
    };

    return NextResponse.json({ items, counts });
  } catch (err) {
    console.error("[api/admin/ig-queue] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load IG queue" },
      { status: 500 },
    );
  }
}
