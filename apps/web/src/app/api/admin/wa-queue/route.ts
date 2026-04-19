import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@edlight-news/firebase";
import { waQueueRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

const NO_STORE = { headers: { "Cache-Control": "no-store" } };

/** Map a Firestore doc to our admin API shape. */
function docToItem(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();

  return {
    id: doc.id,
    sourceContentId: data.sourceContentId,
    score: data.score,
    status: data.status,
    scheduledFor: data.scheduledFor ?? null,
    reasons: data.reasons ?? [],
    text: data.payload?.text ?? null,
    imageUrl: data.payload?.imageUrl ?? null,
    linkUrl: data.payload?.linkUrl ?? null,
    waMessageId: data.waMessageId ?? null,
    sendRetries: data.sendRetries ?? 0,
    error: data.error ?? null,
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

    const recentPromise = db
      .collection("wa_queue")
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();

    const activePromise = db
      .collection("wa_queue")
      .where("status", "in", ["scheduled", "sending"])
      .orderBy("scheduledFor", "asc")
      .limit(50)
      .get()
      .catch((e) => {
        console.warn("[api/admin/wa-queue] activeSnap query failed (missing index?):", e);
        return null;
      });

    const countPromise = db.collection("wa_queue").count().get().catch(() => null);

    const [recentSnap, activeSnap, countSnap] = await Promise.all([
      recentPromise,
      activePromise,
      countPromise,
    ]);

    const activeDocs = activeSnap?.docs ?? [];

    // Merge and deduplicate by doc ID
    const seen = new Set<string>();
    const items: ReturnType<typeof docToItem>[] = [];

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
      scheduled: items.filter((i) => i.status === "scheduled").length,
      sending: items.filter((i) => i.status === "sending").length,
      sent: items.filter((i) => i.status === "sent").length,
      failed: items.filter((i) => i.status === "failed").length,
      skipped: items.filter((i) => i.status === "skipped").length,
    };

    const totalDocs = countSnap?.data().count ?? items.length;

    return NextResponse.json({ items, counts: { ...counts, totalDocs } }, NO_STORE);
  } catch (err) {
    console.error("[api/admin/wa-queue] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load WA queue" },
      { status: 500, headers: NO_STORE.headers },
    );
  }
}

/**
 * PATCH /api/admin/wa-queue
 * Actions: skip, requeue, send_now
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; action?: string };
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
    }

    const validActions = ["skip", "requeue", "send_now"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action '${action}'. Must be one of: ${validActions.join(", ")}` },
        { status: 400 },
      );
    }

    if (action === "send_now") {
      const now = new Date().toISOString();
      await waQueueRepo.setScheduled(id, now, { manuallyScheduled: true });
      return NextResponse.json({
        ok: true,
        action,
        scheduledFor: now,
        message: "Scheduled for immediate sending — will be processed on the next tick.",
      });
    }

    if (action === "skip") {
      await waQueueRepo.updateStatus(id, "skipped", {
        reasons: ["Manually skipped via admin"],
      });
      return NextResponse.json({ ok: true, action });
    }

    if (action === "requeue") {
      await waQueueRepo.updateStatus(id, "queued", {
        sendRetries: 0,
        error: null,
      });
      return NextResponse.json({ ok: true, action });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[api/admin/wa-queue] PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to perform action" },
      { status: 500 },
    );
  }
}
