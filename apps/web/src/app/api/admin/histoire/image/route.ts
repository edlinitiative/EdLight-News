/**
 * POST /api/admin/histoire/image — Upload a new illustration for an almanac entry.
 *
 * Accepts a multipart/form-data body with:
 *   - entryId:  Firestore document ID of the almanac entry
 *   - image:    JPG or PNG file
 *   - source:   Source/credit URL for the image
 *
 * Uploads the image to Firebase Storage, then patches the entry's
 * `illustration` field in Firestore.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  haitiHistoryAlmanacRepo,
  uploadImageBuffer,
} from "@edlight-news/firebase";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const entryId = formData.get("entryId") as string | null;
    const source = formData.get("source") as string | null;
    const file = formData.get("image") as File | null;

    // ── Validate inputs ────────────────────────────────────────────────
    if (!entryId || !file || !source) {
      return NextResponse.json(
        { error: "Missing required fields: entryId, image, source" },
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

    // ── Verify entry exists ────────────────────────────────────────────
    const entry = await haitiHistoryAlmanacRepo.get(entryId);
    if (!entry) {
      return NextResponse.json(
        { error: `Almanac entry not found: ${entryId}` },
        { status: 404 },
      );
    }

    // ── Upload to Firebase Storage ─────────────────────────────────────
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const storagePath = `histoire/almanac/${entryId}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const imageUrl = await uploadImageBuffer(storagePath, buffer, file.type);

    // ── Update Firestore entry ─────────────────────────────────────────
    await haitiHistoryAlmanacRepo.update(entryId, {
      illustration: {
        imageUrl,
        pageUrl: source,
        pageTitle: `Manual upload for ${entry.title_fr}`,
        provider: "manual",
        confidence: 1.0,
      },
    });

    // Purge ISR cache so the histoire page picks up the new image
    revalidateTag("almanac");

    return NextResponse.json({
      ok: true,
      entryId,
      imageUrl,
      message: "Image updated successfully",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin/histoire/image] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
