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

/**
 * Per-visitor view de-duplication (cookie-only, no extra Firestore reads).
 *
 * Firestore's free tier caps writes at ~20K/day and each view was one write.
 * To cut that, we remember which items a visitor already counted in an
 * httpOnly cookie and skip the increment if the item was counted within the
 * window. The cookie stores a small { itemId: lastCountedEpochMs } map; we
 * prune expired entries and cap the size so the cookie can't grow unbounded.
 */
const VIEW_DEDUPE_COOKIE = "edl_vv";
const VIEW_WINDOW_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_TRACKED_ITEMS = 60;

function parseViewed(cookieHeader: string | null): Record<string, number> {
  if (!cookieHeader) return {};
  const entry = cookieHeader
    .split(/;\s*/)
    .find((c) => c.startsWith(`${VIEW_DEDUPE_COOKIE}=`));
  if (!entry) return {};
  try {
    const raw = decodeURIComponent(entry.slice(VIEW_DEDUPE_COOKIE.length + 1));
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const itemId = (body?.itemId ?? "").trim();

    if (!itemId || typeof itemId !== "string") {
      return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
    }

    // Cookie-only de-dupe: prune expired entries, then skip the write if this
    // visitor already counted this item within the window.
    const now = Date.now();
    const viewed = parseViewed(req.headers.get("cookie"));
    for (const [id, ts] of Object.entries(viewed)) {
      if (typeof ts !== "number" || now - ts > VIEW_WINDOW_MS) {
        delete viewed[id];
      }
    }

    if (typeof viewed[itemId] === "number" && now - viewed[itemId] <= VIEW_WINDOW_MS) {
      // Already counted in-window for this visitor — no Firestore write.
      return NextResponse.json({ ok: true });
    }

    const db = await getAdminFirestore();
    const itemRef = db.collection("items").doc(itemId);

    // Atomic increment — creates the field if missing
    await itemRef.update({
      viewCount: FieldValue.increment(1),
    });

    // Record this item as counted, cap the map to the most-recent entries, and
    // persist it in the httpOnly cookie for the dedupe window.
    viewed[itemId] = now;
    const trimmed = Object.entries(viewed)
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TRACKED_ITEMS);

    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: VIEW_DEDUPE_COOKIE,
      value: JSON.stringify(Object.fromEntries(trimmed)),
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Math.floor(VIEW_WINDOW_MS / 1000),
    });
    return res;
  } catch (err: any) {
    // Don't crash on missing docs — item may have been deleted
    if (err?.code === 5 || err?.message?.includes("NOT_FOUND")) {
      return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
    }
    console.error("[api/views] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
