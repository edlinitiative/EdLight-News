import { NextResponse } from "next/server";

/**
 * POST /api/bookmarks — fetch metadata for bookmarked articles.
 *
 * Body: { ids: string[], lang: "fr" | "ht" }
 *
 * Returns minimal article data for the saved page.
 */

async function getAdminFirestore() {
  const { getDb } = await import("@edlight-news/firebase");
  return getDb();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const ids: string[] = Array.isArray(body?.ids) ? body.ids.slice(0, 50) : [];

    if (ids.length === 0) {
      return NextResponse.json({ articles: [] });
    }

    const db = await getAdminFirestore();

    // Fetch content_versions by ID
    const articles: {
      id: string;
      title: string;
      summary: string;
      imageUrl: string | null;
      sourceName: string | null;
      publishedAt: string | null;
    }[] = [];

    // Batch fetch (Firestore limit: 30 per getAll)
    for (let i = 0; i < ids.length; i += 30) {
      const batch = ids.slice(i, i + 30);
      const refs = batch.map((id) => db.collection("content_versions").doc(id));
      const docs = await db.getAll(...refs);

      for (const doc of docs) {
        if (!doc.exists) continue;
        const d = doc.data()!;

        // Get parent item for image + source info
        let imageUrl: string | null = null;
        let sourceName: string | null = null;
        try {
          const itemDoc = await db.collection("items").doc(d.itemId).get();
          if (itemDoc.exists) {
            const item = itemDoc.data()!;
            imageUrl = item.imageUrl ?? null;
            sourceName = item.source?.name ?? d.citations?.[0]?.sourceName ?? null;
          }
        } catch {
          /* skip */
        }

        const createdAt = d.createdAt as { seconds?: number; _seconds?: number } | undefined;
        const secs = createdAt?.seconds ?? (createdAt as any)?._seconds;

        articles.push({
          id: doc.id,
          title: d.title ?? "",
          summary: d.summary ?? "",
          imageUrl,
          sourceName,
          publishedAt: secs ? new Date(secs * 1000).toISOString() : null,
        });
      }
    }

    // Preserve order from request
    const orderMap = new Map(ids.map((id, i) => [id, i]));
    articles.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    return NextResponse.json({ articles });
  } catch (err) {
    console.error("[api/bookmarks] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
