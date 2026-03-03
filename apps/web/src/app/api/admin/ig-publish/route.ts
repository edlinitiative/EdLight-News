import { NextResponse } from "next/server";
import { getDb, getApp } from "@edlight-news/firebase";
import { getStorage } from "firebase-admin/storage";

export const dynamic = "force-dynamic";

/**
 * Build public download URLs for all slides of an IG queue item.
 * The slides are stored at ig_posts/{queueItemId}/slide_N.png and each
 * file contains a Firebase download-token in its metadata.
 */
async function getSlideUrls(queueItemId: string, slideCount: number): Promise<string[]> {
  try {
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? undefined;
    const bucket = getStorage(getApp()).bucket(bucketName);
    const urls: string[] = [];

    for (let i = 1; i <= slideCount; i++) {
      const filePath = `ig_posts/${queueItemId}/slide_${i}.png`;
      const file = bucket.file(filePath);

      // Get signed URL valid for 1 hour
      const [signedUrl] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
      });
      urls.push(signedUrl);
    }

    return urls;
  } catch (err) {
    console.warn(`[ig-publish] Failed to get slide URLs for ${queueItemId}:`, err);
    return [];
  }
}

/**
 * GET — List IG posts ready for manual posting.
 * Returns items with status "scheduled_ready_for_manual" or "scheduled"
 * that have payloads, ordered by scheduledFor.
 */
export async function GET() {
  try {
    const db = getDb();

    // Fetch items ready for manual posting
    const readySnap = await db
      .collection("ig_queue")
      .where("status", "in", ["scheduled_ready_for_manual", "scheduled", "rendering"])
      .orderBy("scheduledFor", "asc")
      .limit(20)
      .get();

    // Also fetch recently posted items (last 7 days) for history
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const postedSnap = await db
      .collection("ig_queue")
      .where("status", "==", "posted")
      .orderBy("updatedAt", "desc")
      .limit(10)
      .get();

    const toItem = async (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data();
      const slideCount = data.payload?.slides?.length ?? 0;
      const slideUrls = slideCount > 0 ? await getSlideUrls(doc.id, slideCount) : [];

      return {
        id: doc.id,
        sourceContentId: data.sourceContentId,
        igType: data.igType,
        score: data.score,
        status: data.status,
        scheduledFor: data.scheduledFor ?? null,
        caption: data.payload?.caption ?? null,
        slides: (data.payload?.slides ?? []).map(
          (s: { heading: string; bullets: string[]; footer?: string }) => ({
            heading: s.heading,
            bullets: s.bullets,
            footer: s.footer ?? null,
          }),
        ),
        slideUrls,
        slideCount,
        memeSlide: data.payload?.memeSlide ?? null,
        dryRunPath: data.dryRunPath ?? null,
        igPostId: data.igPostId ?? null,
        reasons: data.reasons ?? [],
        createdAt: data.createdAt?._seconds
          ? new Date(data.createdAt._seconds * 1000).toISOString()
          : null,
        updatedAt: data.updatedAt?._seconds
          ? new Date(data.updatedAt._seconds * 1000).toISOString()
          : null,
      };
    };

    const readyItems = await Promise.all(readySnap.docs.map(toItem));
    const postedItems = await Promise.all(postedSnap.docs.map(toItem));

    return NextResponse.json({ ready: readyItems, posted: postedItems });
  } catch (err) {
    console.error("[api/admin/ig-publish] GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load IG posts" },
      { status: 500 },
    );
  }
}

/**
 * PATCH — Mark an IG queue item as posted after manual publishing.
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id: string; igPostId?: string };
    if (!body.id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const db = getDb();
    const ref = db.collection("ig_queue").doc(body.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const update: Record<string, unknown> = {
      status: "posted",
      updatedAt: new Date(),
    };
    if (body.igPostId) {
      update.igPostId = body.igPostId;
    }

    await ref.update(update);

    return NextResponse.json({ success: true, id: body.id });
  } catch (err) {
    console.error("[api/admin/ig-publish] PATCH error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 },
    );
  }
}
