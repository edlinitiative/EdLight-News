import { NextResponse, type NextRequest } from "next/server";
import { fbQueueRepo, getDb } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

function timestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && "_seconds" in value && typeof value._seconds === "number") {
    return new Date(value._seconds * 1000).toISOString();
  }
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

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
    fbPostId: data.fbPostId ?? null,
    sendRetries: data.sendRetries ?? 0,
    error: data.error ?? null,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export async function GET() {
  try {
    const db = getDb();

    const recentSnap = await db
      .collection("fb_queue")
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();

    let activeDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    try {
      const activeSnap = await db
        .collection("fb_queue")
        .where("status", "in", ["scheduled", "sending"])
        .orderBy("scheduledFor", "asc")
        .limit(50)
        .get();
      activeDocs = activeSnap.docs;
    } catch (err) {
      console.warn("[api/admin/fb-queue] activeSnap query failed (missing index?):", err);
    }

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

    const counts = {
      queued: items.filter((i) => i.status === "queued").length,
      scheduled: items.filter((i) => i.status === "scheduled").length,
      sending: items.filter((i) => i.status === "sending").length,
      sent: items.filter((i) => i.status === "sent").length,
      failed: items.filter((i) => i.status === "failed").length,
      skipped: items.filter((i) => i.status === "skipped").length,
    };

    let totalDocs = items.length;
    try {
      const countSnap = await db.collection("fb_queue").count().get();
      totalDocs = countSnap.data().count;
    } catch {
      // Non-critical.
    }

    return NextResponse.json({ items, counts: { ...counts, totalDocs } });
  } catch (err) {
    console.error("[api/admin/fb-queue] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load Facebook queue" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/fb-queue
 * Actions: skip, requeue, publish_now
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; action?: string };
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
    }

    const validActions = ["skip", "requeue", "publish_now"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action '${action}'. Must be one of: ${validActions.join(", ")}` },
        { status: 400 },
      );
    }

    if (action === "publish_now") {
      const now = new Date().toISOString();
      await fbQueueRepo.setScheduled(id, now);
      return NextResponse.json({
        ok: true,
        action,
        scheduledFor: now,
        message: "Scheduled for immediate Facebook publishing on the next tick.",
      });
    }

    if (action === "skip") {
      await fbQueueRepo.updateStatus(id, "skipped", {
        reasons: ["Manually skipped via admin"],
      });
      return NextResponse.json({ ok: true, action });
    }

    if (action === "requeue") {
      await fbQueueRepo.updateStatus(id, "queued", {
        sendRetries: 0,
        error: null,
      });
      return NextResponse.json({ ok: true, action });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[api/admin/fb-queue] PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to perform action" },
      { status: 500 },
    );
  }
}
