/**
 * Firebase Storage helpers.
 *
 * Uploads image buffers to Cloud Storage and returns public URLs.
 * Uses the project's default storage bucket.
 */
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
export declare function uploadImageBuffer(path: string, buffer: Buffer, contentType?: string): Promise<string>;
/**
 * Upload an array of local image files to Firebase Storage and return their
 * public download URLs.  Designed for IG carousel slides.
 *
 * @param localPaths - Absolute paths to local PNG files
 * @param queueItemId - IG queue item ID (used to namespace the upload path)
 * @returns Array of public download URLs in the same order
 */
export declare function uploadCarouselSlides(localPaths: string[], queueItemId: string): Promise<string[]>;
//# sourceMappingURL=storage.d.ts.map