/**
 * POST /api/feedback — Write a user feedback report to Firestore.
 *
 * Expected body:
 * {
 *   itemId: string,
 *   pageUrl: string,
 *   reason: "date"|"source"|"categorie"|"texte"|"autre",
 *   note?: string
 * }
 */

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

const VALID_REASONS = new Set(["date", "source", "categorie", "texte", "autre"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { itemId, pageUrl, reason, note } = body as {
      itemId?: string;
      pageUrl?: string;
      reason?: string;
      note?: string;
    };

    // Validate required fields
    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "itemId is required" }, { status: 400 });
    }
    if (!reason || !VALID_REASONS.has(reason)) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
    }

    // Sanitise note
    const sanitisedNote = typeof note === "string" ? note.trim().slice(0, 500) : undefined;

    const db = getDb();
    const ref = db.collection("feedback").doc();

    await ref.set({
      itemId,
      pageUrl: typeof pageUrl === "string" ? pageUrl.slice(0, 2000) : "",
      reason,
      ...(sanitisedNote ? { note: sanitisedNote } : {}),
      status: "new",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    console.error("[api/feedback] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
