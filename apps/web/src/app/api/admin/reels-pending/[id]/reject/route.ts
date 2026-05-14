import { NextResponse, type NextRequest } from "next/server";
import { reelsPendingRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await req.json().catch(() => ({}))) as { reason?: string };
    const reason = body.reason?.trim() || "no-reason-given";
    await reelsPendingRepo.reject(params.id, reason);
    console.log(JSON.stringify({ event: "reelRejected", reelId: params.id, reason }));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/reels-pending/reject] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reject failed" },
      { status: 500 },
    );
  }
}
