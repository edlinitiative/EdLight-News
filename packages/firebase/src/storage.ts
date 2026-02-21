/**
 * Firebase Storage helpers.
 *
 * Uploads image buffers to Cloud Storage and returns public URLs.
 * Uses the project's default storage bucket.
 */

import { getStorage } from "firebase-admin/storage";
import { getApp } from "./admin.js";

/**
 * Upload a buffer to Firebase Storage and return its public URL.
 *
 * @param path      - Object path within the bucket, e.g. "images/items/abc.png"
 * @param buffer    - The file content
 * @param contentType - MIME type (default: "image/png")
 * @returns         - Public https URL of the uploaded file
 */
export async function uploadImageBuffer(
  path: string,
  buffer: Buffer,
  contentType = "image/png",
): Promise<string> {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? undefined;
  const bucket = getStorage(getApp()).bucket(bucketName);
  const file = bucket.file(path);

  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: {
      cacheControl: "public, max-age=31536000, immutable",
    },
  });

  // Make the file publicly readable
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}
