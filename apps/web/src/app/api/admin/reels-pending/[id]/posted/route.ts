import { NextResponse, type NextRequest } from "next/server";
import { reelsPendingRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await req.json().catch(() => ({}))) as { igPostUrl?: string };
    const url = body.igPostUrl?.trim();
    if (!url) {
      return NextResponse.json(
        { error: "Missing igPostUrl" },
        { status: 400 },
      );
    }
    const igMediaId = reelsPendingRepo.parseIgMediaIdFromUrl(url);
    if (!igMediaId) {
      return NextResponse.json(
        { error: "Could not parse Instagram shortcode from the URL." },
        { status: 400 },
      );
    }
    await reelsPendingRepo.markPosted(params.id, {
      igMediaId,
      igPostUrl: url,
    });
    console.log(
      JSON.stringify({
        event: "reelPosted",
        reelId: params.id,
        igMediaId,
        igPostUrl: url,
      }),
    );
    return NextResponse.json({ ok: true, igMediaId });
  } catch (err) {
    console.error("[api/admin/reels-pending/posted] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Mark-posted failed" },
      { status: 500 },
    );
  }
}
