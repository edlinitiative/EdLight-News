import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/views — increment view count on an item.
 *
 * Body: { itemId: string }
 *
 * Uses Firestore FieldValue.increment(1) for atomic, cheap counting.
 * No auth required — anonymous page-view tracking (v1).
 */

async function getAdminFirestore() {
  const { getDb } = await import("@edlight-news/firebase");
  return getDb();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const itemId = (body?.itemId ?? "").trim();

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    }

    const db = await getAdminFirestore();
    const itemRef = db.collection("items").doc(itemId);

    // Atomic increment — creates the field if missing
    await itemRef.update({
      viewCount: FieldValue.increment(1),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    // Don't crash on missing docs — item may have been deleted
    if (err?.code === 5 || err?.message?.includes("NOT_FOUND")) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    console.error("[api/views] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
