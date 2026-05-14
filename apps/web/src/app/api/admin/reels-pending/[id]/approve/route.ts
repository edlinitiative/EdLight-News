import { NextResponse, type NextRequest } from "next/server";
import { reelsPendingRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = (await req.json().catch(() => ({}))) as { approvedBy?: string };
    const approvedBy = body.approvedBy?.trim() || "admin";
    await reelsPendingRepo.approve(params.id, approvedBy);
    console.log(JSON.stringify({ event: "reelApproved", reelId: params.id, approvedBy }));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/admin/reels-pending/approve] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Approve failed" },
      { status: 500 },
    );
  }
}
