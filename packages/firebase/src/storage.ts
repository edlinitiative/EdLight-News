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
 * Return an existing Firebase Storage file's download URL by reading its
 * stored `firebaseStorageDownloadTokens` custom metadata.  If the file does
 * not yet exist, call {@link bufferFn} to produce the content, upload it,
 * and return the resulting URL.
 *
 * This is intentionally idempotent: running it a second time for the same
 * path returns the same URL as the first run without re-uploading.
 *
 * @param storagePath  - Object path within the bucket (e.g. "ig_assets/cta/news-cta.jpg")
 * @param bufferFn     - Async factory that produces the file content (only
 *                       called when the file is absent from Storage)
 * @param contentType  - MIME type (default: "image/jpeg")
 * @returns            - Stable token-based download URL
 */
export async function getOrUploadImageBuffer(
  storagePath: string,
  bufferFn: () => Promise<Buffer>,
  contentType = "image/jpeg",
): Promise<string> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? undefined;
  const bucket = getStorage(getApp()).bucket(bucketName);
  const file = bucket.file(storagePath);

  const [exists] = await file.exists();
  if (exists) {
    const [metadata] = await file.getMetadata();
    const token: string | undefined =
      metadata.metadata?.firebaseStorageDownloadTokens as string | undefined;
    if (token) {
      const encodedPath = encodeURIComponent(storagePath);
      return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;
    }
    // Token missing in metadata — fall through to re-upload with a fresh token.
    console.warn(`[storage] ${storagePath} exists but has no download token — re-uploading.`);
  }

  const buffer = await bufferFn();
  return uploadImageBuffer(storagePath, buffer, contentType);
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
 * Delete all slide files for an IG queue item from Firebase Storage.
 * Called after successful posting for ephemeral post types (news, taux)
 * to keep storage usage low.
 *
 * @param queueItemId - IG queue item ID whose ig_posts/{id}/ folder to delete
 */
export async function deleteCarouselSlides(queueItemId: string): Promise<void> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? undefined;
  const bucket = getStorage(getApp()).bucket(bucketName);
  const prefix = `ig_posts/${queueItemId}/`;
  const [files] = await bucket.getFiles({ prefix });
  if (files.length === 0) return;
  await Promise.all(files.map((f) => f.delete()));
  console.log(`[storage] Deleted ${files.length} slide(s) for ${queueItemId}`);
}

/**
 * Delete all slide files for an IG story item from Firebase Storage.
 *
 * @param storyId - IG story queue item ID whose ig_stories/{id}/ folder to delete
 */
export async function deleteStorySlides(storyId: string): Promise<void> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? undefined;
  const bucket = getStorage(getApp()).bucket(bucketName);
  const prefix = `ig_stories/${storyId}/`;
  const [files] = await bucket.getFiles({ prefix });
  if (files.length === 0) return;
  await Promise.all(files.map((f) => f.delete()));
  console.log(`[storage] Deleted ${files.length} story frame(s) for ${storyId}`);
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
