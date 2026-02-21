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
