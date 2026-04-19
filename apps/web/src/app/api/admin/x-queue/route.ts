import { NextResponse, type NextRequest } from "next/server";
import { xQueueRepo, getDb } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

type ArticleContext = {
  itemId: string;
  title: string | null;
  summary: string | null;
  category: string | null;
  vertical: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
};

function timestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object" && "_seconds" in value && typeof value._seconds === "number") {
    return new Date(value._seconds * 1000).toISOString();
  }
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return (value as { toDate(): Date }).toDate().toISOString();
  }
  return null;
}

function docToArticle(doc: FirebaseFirestore.DocumentSnapshot): ArticleContext | null {
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  const firstCitation = Array.isArray(data.citations) ? data.citations[0] : null;
  return {
    itemId: doc.id,
    title: data.title ?? null,
    summary: data.summary ?? null,
    category: data.category ?? null,
    vertical: data.vertical ?? null,
    sourceName: data.source?.name ?? firstCitation?.sourceName ?? data.sourceId ?? null,
    sourceUrl: data.source?.originalUrl ?? firstCitation?.sourceUrl ?? data.canonicalUrl ?? null,
    canonicalUrl: data.canonicalUrl ?? null,
    imageUrl: data.imageUrl ?? null,
    publishedAt: timestampToIso(data.publishedAt) ?? data.effectiveDate ?? null,
  };
}

async function loadArticleContexts(
  db: FirebaseFirestore.Firestore,
  itemIds: string[],
): Promise<Map<string, ArticleContext>> {
  const uniqueIds = [...new Set(itemIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const refs = uniqueIds.map((id) => db.collection("items").doc(id));
  const snaps = await db.getAll(...refs);
  const articles = new Map<string, ArticleContext>();
  for (const snap of snaps) {
    const article = docToArticle(snap);
    if (article) articles.set(snap.id, article);
  }
  return articles;
}

function docToItem(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data();
  return {
    id: doc.id,
    sourceContentId: data.sourceContentId as string,
    article: null as ArticleContext | null,
    score: data.score as number,
    status: data.status as string,
    scheduledFor: (data.scheduledFor as string | null) ?? null,
    reasons: (data.reasons as string[]) ?? [],
    text: data.payload?.text ?? null,
    imageUrl: data.payload?.imageUrl ?? null,
    linkUrl: data.payload?.linkUrl ?? null,
    xTweetId: (data.xTweetId as string | null) ?? null,
    sendRetries: (data.sendRetries as number) ?? 0,
    error: (data.error as string | null) ?? null,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export async function GET() {
  try {
    const db = getDb();

    const recentSnap = await db
      .collection("x_queue")
      .orderBy("createdAt", "desc")
      .limit(250)
      .get();

    let activeDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    try {
      const activeSnap = await db
        .collection("x_queue")
        .where("status", "in", ["scheduled", "sending"])
        .orderBy("scheduledFor", "asc")
        .limit(50)
        .get();
      activeDocs = activeSnap.docs;
    } catch (err) {
      console.warn("[api/admin/x-queue] activeSnap query failed (missing index?):", err);
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
      const countSnap = await db.collection("x_queue").count().get();
      totalDocs = countSnap.data().count;
    } catch {
      // Non-critical.
    }

    const articleById = await loadArticleContexts(
      db,
      items.map((item) => item.sourceContentId),
    );
    const enrichedItems = items.map((item) => ({
      ...item,
      article: articleById.get(item.sourceContentId) ?? null,
    }));

    return NextResponse.json({ items: enrichedItems, counts: { ...counts, totalDocs } });
  } catch (err) {
    console.error("[api/admin/x-queue] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load X queue" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/x-queue
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
      await xQueueRepo.setScheduled(id, now);
      return NextResponse.json({
        ok: true,
        action,
        scheduledFor: now,
        message: "Scheduled for immediate X publishing on the next tick.",
      });
    }

    if (action === "skip") {
      await xQueueRepo.updateStatus(id, "skipped", {
        reasons: ["Manually skipped via admin"],
      });
      return NextResponse.json({ ok: true, action });
    }

    if (action === "requeue") {
      await xQueueRepo.updateStatus(id, "queued", {
        sendRetries: 0,
        error: null,
      });
      return NextResponse.json({ ok: true, action });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[api/admin/x-queue] PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to perform action" },
      { status: 500 },
    );
  }
}
