import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@edlight-news/firebase";
import { igQueueRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

/** Map a Firestore doc to our admin API shape. */
function docToItem(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();

  const slides = (data.payload?.slides ?? []).map(
    (s: { heading?: string; bullets?: string[]; footer?: string; backgroundImage?: string; layout?: string; meta?: string[] }) => ({
      heading: s.heading ?? "",
      bullets: s.bullets ?? [],
      footer: s.footer ?? null,
      backgroundImage: s.backgroundImage ?? null,
      layout: s.layout ?? null,
      meta: s.meta ?? null,
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
    renderedBy: data.renderedBy ?? null,
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

    // Total doc count — 1 cheap read; used as a collection-health proxy in the UI
    let totalDocs = items.length;
    try {
      const countSnap = await db.collection("ig_queue").count().get();
      totalDocs = countSnap.data().count;
    } catch {
      // Non-critical — fall back to the in-view count
    }

    return NextResponse.json({ items, counts: { ...counts, totalDocs } });
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
 * Actions: push (schedule next slot), skip, requeue, publish_now
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; action?: string };
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
    }

    const validActions = ["push", "skip", "requeue", "publish_now"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action '${action}'. Must be one of: ${validActions.join(", ")}` },
        { status: 400 },
      );
    }

    if (action === "push") {
      // Gather already-taken slots so we don't double-book
      const takenSlots = await getTakenSlotISOs();
      const nextSlot = getNextAvailableSlot(takenSlots);
      if (!nextSlot) {
        return NextResponse.json(
          { error: "No available slots — all time-slots for today and tomorrow are taken." },
          { status: 409 },
        );
      }
      await igQueueRepo.setScheduled(id, nextSlot, { manuallyScheduled: true });
      return NextResponse.json({ ok: true, action, scheduledFor: nextSlot });
    }

    if (action === "publish_now") {
      // Schedule for immediate processing and trigger the worker right away.
      // manuallyScheduled bypasses staleness checks so the item won't be
      // expired before it's processed.
      const now = new Date().toISOString();
      await igQueueRepo.setScheduled(id, now, { manuallyScheduled: true });

      // Fire-and-forget: trigger the worker so it processes immediately
      // instead of waiting up to 15 min for the next Cloud Scheduler tick.
      const workerUrl = process.env.WORKER_URL;
      if (workerUrl) {
        fetch(`${workerUrl}/tick`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(5_000),
        }).catch((err) => {
          console.warn("[api/admin/ig-queue] publish_now: failed to trigger worker tick:", err);
        });
      }

      return NextResponse.json({
        ok: true,
        action,
        scheduledFor: now,
        message: workerUrl
          ? "Publishing now — worker triggered. The post will appear on Instagram within 1–2 minutes."
          : "Scheduled for immediate publishing — will be processed on the next tick (within 15 minutes). Set WORKER_URL for instant publishing.",
      });
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

// ─── Slot helpers ────────────────────────────────────────────────────────────

const HAITI_TZ = "America/Port-au-Prince";

/**
 * IG posting slots (Haiti local time).
 * ⚠️  Must stay in sync with the worker's SLOTS in scheduleIgPost.ts.
 */
const SLOTS = [
  { hour: 6, minute: 30 },    // Pinned: taux du jour
  { hour: 6, minute: 50 },    // Pinned: fait du jour / utility
  { hour: 7, minute: 0 },     // Pinned: histoire
  { hour: 8, minute: 30 },    // Morning — general slot
  { hour: 10, minute: 0 },    // Mid-morning
  { hour: 11, minute: 30 },   // Late morning
  { hour: 14, minute: 0 },    // Early afternoon
  { hour: 16, minute: 0 },    // After school
  { hour: 18, minute: 0 },    // Evening
  { hour: 20, minute: 0 },    // Late evening
];

/** Extract Haiti wall-clock parts from a JS Date (DST-safe). */
function haitiParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HAITI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    year: Number(get("year")),
    month: Number(get("month")) - 1, // JS month is 0-based
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/** Compute Haiti→UTC offset in hours (handles DST). */
function getHaitiOffsetHours(now: Date): number {
  const h = haitiParts(now);
  const haitiLocal = new Date(
    Date.UTC(h.year, h.month, h.day, h.hour, h.minute, 0, 0),
  );
  const utcParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const getU = (t: string) => utcParts.find((p) => p.type === t)!.value;
  const utcLocal = new Date(
    `${getU("year")}-${getU("month")}-${getU("day")}T${getU("hour")}:${getU("minute")}:${getU("second")}`,
  );
  return Math.round(
    (utcLocal.getTime() - haitiLocal.getTime()) / (60 * 60 * 1000),
  );
}

/** Collect scheduledFor values from all currently scheduled/rendering items. */
async function getTakenSlotISOs(): Promise<Set<string>> {
  const db = getDb();
  const snap = await db
    .collection("ig_queue")
    .where("status", "in", ["scheduled", "rendering"])
    .select("scheduledFor")
    .get();
  const taken = new Set<string>();
  for (const doc of snap.docs) {
    const sf = doc.data().scheduledFor;
    if (sf) taken.add(sf);
  }
  return taken;
}

/**
 * Compute the next available IG posting slot (Haiti local → UTC ISO).
 * Aligned with the worker's slot table so admin-pushed items sit in the
 * same grid and don't collide with auto-scheduled content.
 */
function getNextAvailableSlot(takenSlots: Set<string>): string | null {
  const now = new Date();
  const h = haitiParts(now);
  const offsetHours = getHaitiOffsetHours(now);

  for (let dayOff = 0; dayOff <= 1; dayOff++) {
    for (const slot of SLOTS) {
      // Skip past slots if looking at today
      if (
        dayOff === 0 &&
        (h.hour > slot.hour || (h.hour === slot.hour && h.minute >= slot.minute))
      ) {
        continue;
      }

      const slotDate = new Date(
        Date.UTC(h.year, h.month, h.day + dayOff, slot.hour + offsetHours, slot.minute, 0, 0),
      );
      const iso = slotDate.toISOString();

      if (takenSlots.has(iso)) continue;

      // Safety: skip if within 30 min of any taken slot
      let conflict = false;
      for (const taken of takenSlots) {
        if (Math.abs(new Date(taken).getTime() - slotDate.getTime()) < 30 * 60 * 1000) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      return iso;
    }
  }

  return null; // all slots taken
}
