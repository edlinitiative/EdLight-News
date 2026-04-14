/**
 * POST /api/admin/ig-queue/replace-image — Replace the cover image on an IG queue item.
 *
 * Accepts a multipart/form-data body with:
 *   - queueItemId:  Firestore document ID of the ig_queue entry
 *   - image:        JPG, PNG, or WebP file (max 10 MB)
 *
 * Uploads the image to Firebase Storage, patches the queue item's payload
 * to set the new image as slides[0].backgroundImage (and propagates to
 * content slides), then resets the status to "queued" so the item can be
 * re-scheduled and re-rendered with the new image.
 *
 * Follows the same pattern as /api/admin/histoire/image.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  igQueueRepo,
  uploadImageBuffer,
} from "@edlight-news/firebase";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const queueItemId = formData.get("queueItemId") as string | null;
    const file = formData.get("image") as File | null;

    // ── Validate inputs ────────────────────────────────────────────────
    if (!queueItemId || !file) {
      return NextResponse.json(
        { error: "Missing required fields: queueItemId, image" },
        { status: 400 },
      );
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${file.type}. Use JPG, PNG, or WebP.` },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Image too large. Max 10 MB." },
        { status: 400 },
      );
    }

    // ── Verify queue item exists ───────────────────────────────────────
    const queueItem = await igQueueRepo.getIGQueueItem(queueItemId);
    if (!queueItem) {
      return NextResponse.json(
        { error: `IG queue item not found: ${queueItemId}` },
        { status: 404 },
      );
    }

    if (!queueItem.payload?.slides?.length) {
      return NextResponse.json(
        { error: "Queue item has no slides payload — cannot replace image." },
        { status: 400 },
      );
    }

    // ── Upload to Firebase Storage ─────────────────────────────────────
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const storagePath = `ig_posts/${queueItemId}/cover_override.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageUrl = await uploadImageBuffer(storagePath, buffer, file.type);

    // ── Update payload: set backgroundImage on all slides ──────────────
    // The cover slide (index 0) always gets the new image. Content slides
    // that previously shared the same background (propagated from the old
    // cover) also get updated. CTA slides are left untouched.
    const updatedPayload = { ...queueItem.payload };
    const oldCoverImage = updatedPayload.slides[0]?.backgroundImage;

    for (const slide of updatedPayload.slides) {
      // Always update the cover
      if (slide === updatedPayload.slides[0]) {
        slide.backgroundImage = imageUrl;
        continue;
      }

      // Update content slides that shared the old cover image
      // or had no image at all (they'll get the new one)
      if (slide.layout !== "cta") {
        if (!slide.backgroundImage || slide.backgroundImage === oldCoverImage) {
          slide.backgroundImage = imageUrl;
        }
      }
    }

    // ── Persist updated payload and reset status ───────────────────────
    // Setting status to "queued" lets the admin use Push/Publish Now to
    // re-schedule and re-render with the new image.
    await igQueueRepo.setPayload(queueItemId, updatedPayload);
    await igQueueRepo.updateStatus(queueItemId, "queued", {
      reasons: [
        ...(queueItem.reasons ?? []),
        "Cover image replaced via admin — re-queued for re-rendering",
      ],
    });

    return NextResponse.json({
      ok: true,
      queueItemId,
      imageUrl,
      message: "Cover image replaced. Use Push or Publish Now to re-render.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/ig-queue/replace-image] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
