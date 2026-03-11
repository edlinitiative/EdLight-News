import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@edlight-news/firebase";
import { igQueueRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

/** Map a Firestore doc to our admin API shape. */
function docToItem(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();

  const slides = (data.payload?.slides ?? []).map(
    (s: { heading?: string; bullets?: string[]; footer?: string; backgroundImage?: string }) => ({
      heading: s.heading ?? "",
      bullets: s.bullets ?? [],
      footer: s.footer ?? null,
      backgroundImage: s.backgroundImage ?? null,
    }),
  );

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
}

export async function GET() {
  try {
    const db = getDb();

    // Main query: most recent 250 items by createdAt
    const recentSnap = await db
      .collection("ig_queue")
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();

    // Second query: scheduled/rendering items (may not be in the 250-item window)
    let activeDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    try {
      const activeSnap = await db
        .collection("ig_queue")
        .where("status", "in", ["scheduled", "scheduled_ready_for_manual", "rendering"])
        .orderBy("scheduledFor", "asc")
        .limit(50)
        .get();
      activeDocs = activeSnap.docs;
    } catch (e) {
      // Index may not be deployed yet — fall back gracefully
      console.warn("[api/admin/ig-queue] activeSnap query failed (missing index?):", e);
    }

    // Merge and deduplicate by doc ID
    const seen = new Set<string>();
    const items: ReturnType<typeof docToItem>[] = [];

    // Active items first (scheduled/rendering) so they appear prominently
    for (const doc of activeDocs) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        items.push(docToItem(doc));
      }
    }
    for (const doc of recentSnap.docs) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        items.push(docToItem(doc));
      }
    }

    // Summary counts
    const counts = {
      queued: items.filter((i) => i.status === "queued").length,
      scheduled: items.filter((i) => i.status === "scheduled" || i.status === "scheduled_ready_for_manual").length,
      posted: items.filter((i) => i.status === "posted").length,
      skipped: items.filter((i) => i.status === "skipped").length,
      rendering: items.filter((i) => i.status === "rendering").length,
      expired: items.filter((i) => i.status === "expired").length,
    };

    return NextResponse.json({ items, counts });
  } catch (err) {
    console.error("[api/admin/ig-queue] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load IG queue" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/ig-queue
 * Actions: push (schedule next slot), skip, requeue
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; action?: string };
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
    }

    const validActions = ["push", "skip", "requeue"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action '${action}'. Must be one of: ${validActions.join(", ")}` },
        { status: 400 },
      );
    }

    if (action === "push") {
      // Schedule for the next available slot
      const nextSlot = getNextAvailableSlot();
      await igQueueRepo.setScheduled(id, nextSlot);
      return NextResponse.json({ ok: true, action, scheduledFor: nextSlot });
    }

    if (action === "skip") {
      await igQueueRepo.updateStatus(id, "skipped", {
        reasons: ["Manually skipped via admin"],
      });
      return NextResponse.json({ ok: true, action });
    }

    if (action === "requeue") {
      await igQueueRepo.updateStatus(id, "queued");
      return NextResponse.json({ ok: true, action });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[api/admin/ig-queue] PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to perform action" },
      { status: 500 },
    );
  }
}

/** Compute the next available IG posting slot (Haiti local → UTC). */
function getNextAvailableSlot(): string {
  const HAITI_TZ = "America/Port-au-Prince";
  const now = new Date();
  const haitiStr = now.toLocaleString("en-US", { timeZone: HAITI_TZ });
  const haitiNow = new Date(haitiStr);
  const haitiHour = haitiNow.getHours();
  const haitiMinute = haitiNow.getMinutes();

  const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
  const diffMs = new Date(utcStr).getTime() - new Date(haitiStr).getTime();
  const offsetHours = Math.round(diffMs / (60 * 60 * 1000));

  const SLOTS = [
    { hour: 8, minute: 0 },
    { hour: 10, minute: 30 },
    { hour: 12, minute: 30 },
    { hour: 15, minute: 0 },
    { hour: 17, minute: 30 },
    { hour: 19, minute: 0 },
    { hour: 21, minute: 0 },
  ];

  const y = haitiNow.getFullYear();
  const m = haitiNow.getMonth();
  const d = haitiNow.getDate();

  for (let dayOff = 0; dayOff <= 1; dayOff++) {
    for (const slot of SLOTS) {
      if (dayOff === 0 && (haitiHour > slot.hour || (haitiHour === slot.hour && haitiMinute >= slot.minute))) {
        continue;
      }
      return new Date(Date.UTC(y, m, d + dayOff, slot.hour + offsetHours, slot.minute, 0, 0)).toISOString();
    }
  }

  return new Date(Date.UTC(y, m, d + 1, 8 + offsetHours, 0, 0, 0)).toISOString();
}
