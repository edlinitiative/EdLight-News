/**
 * Firebase Storage helpers.
 *
 * Uploads image buffers to Cloud Storage and returns public URLs.
 * Uses the project's default storage bucket.
 */
/**
 * Upload a buffer to Firebase Storage and return its public URL.
 *
 * @param path      - Object path within the bucket, e.g. "images/items/abc.png"
 * @param buffer    - The file content
 * @param contentType - MIME type (default: "image/png")
 * @returns         - Public https URL of the uploaded file
 */
export declare function uploadImageBuffer(path: string, buffer: Buffer, contentType?: string): Promise<string>;
//# sourceMappingURL=storage.d.ts.map