/**
 * Firebase Storage helpers.
 *
 * Uploads image buffers to Cloud Storage and returns public URLs.
 * Uses the project's default storage bucket.
 */

import { randomUUID } from "node:crypto";
import { getStorage } from "firebase-admin/storage";
import { getApp } from "./admin.js";

/**
 * Upload a buffer to Firebase Storage and return a download URL.
 *
 * Works with buckets that have uniform bucket-level access enabled
 * by embedding a Firebase download token in the object metadata
 * instead of setting per-object ACLs.
 *
 * @param path        - Object path within the bucket, e.g. "images/items/abc.png"
 * @param buffer      - The file content
 * @param contentType - MIME type (default: "image/png")
 * @returns           - Token-based download URL
 */
export async function uploadImageBuffer(
  path: string,
  buffer: Buffer,
  contentType = "image/png",
): Promise<string> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? undefined;
  const bucket = getStorage(getApp()).bucket(bucketName);
  const file = bucket.file(path);

  // Generate a download token so we can build a stable public URL
  // without requiring per-object ACLs (uniform bucket-level access).
  const downloadToken = randomUUID();

  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
      },
    },
  });

  // Build the Firebase Storage download URL.
  const encodedPath = encodeURIComponent(path);
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;
}

/**
 * Upload an array of local image files to Firebase Storage and return their
 * public download URLs.  Designed for IG carousel slides.
 *
 * @param localPaths - Absolute paths to local PNG files
 * @param queueItemId - IG queue item ID (used to namespace the upload path)
 * @returns Array of public download URLs in the same order
 */
export async function uploadCarouselSlides(
  localPaths: string[],
  queueItemId: string,
): Promise<string[]> {
  const { readFileSync } = await import("node:fs");
  const urls: string[] = [];

  for (let i = 0; i < localPaths.length; i++) {
    const localPath = localPaths[i]!;
    const buffer = readFileSync(localPath);
    const storagePath = `ig_posts/${queueItemId}/slide_${i + 1}.png`;
    const url = await uploadImageBuffer(storagePath, buffer, "image/png");
    urls.push(url);
  }

  console.log(
    `[storage] Uploaded ${urls.length} carousel slides for IG queue item ${queueItemId}`,
  );
  return urls;
}

/**
 * Upload a single story frame PNG to Firebase Storage and return its
 * public download URL.
 *
 * @param localPath    - Absolute path to the local PNG file
 * @param storyId      - IG story queue item ID
 * @param frameIndex   - 0-based frame index
 * @returns            - Public download URL
 */
export async function uploadStorySlide(
  localPath: string,
  storyId: string,
  frameIndex: number,
): Promise<string> {
  const { readFileSync } = await import("node:fs");
  const buffer = readFileSync(localPath);
  const storagePath = `ig_stories/${storyId}/frame_${frameIndex + 1}.png`;
  const url = await uploadImageBuffer(storagePath, buffer, "image/png");
  console.log(`[storage] Uploaded story frame ${frameIndex + 1} for ${storyId}`);
  return url;
}
