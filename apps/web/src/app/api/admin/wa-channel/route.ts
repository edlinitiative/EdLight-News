import { NextResponse } from "next/server";
import { waChannelSnapshotsRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

export async function GET() {
  try {
    const summary = await waChannelSnapshotsRepo.summarize();
    return NextResponse.json({ summary }, NO_STORE);
  } catch (err) {
    console.error("[api/admin/wa-channel] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500, ...NO_STORE },
    );
  }
}
