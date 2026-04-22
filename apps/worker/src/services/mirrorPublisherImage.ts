/**
 * Mirror a remote publisher image into our own Firebase Storage bucket.
 *
 * Why: publisher CDNs go down (e.g. ayibopost.com), hot-link block, change
 * URLs, or rate-limit. When they do, every article that points at their
 * original URL renders a broken image. By rehosting on Firebase Storage at
 * ingest time, the article display becomes independent of publisher uptime.
 *
 * The original URL is preserved in `imageMeta.originalImageUrl` for
 * attribution/debugging.
 */

import { createHash } from "node:crypto";
import { getOrUploadImageBuffer } from "@edlight-news/firebase";

/** Hosts whose images we already serve directly — no need to mirror. */
const ALREADY_HOSTED_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "storage.googleapis.com",
  "commons.wikimedia.org",
  "upload.wikimedia.org",
]);

/** Hard cap on remote image size (bytes). Skips banner-ad-style giants. */
const MAX_IMAGE_BYTES = 12 * 1024 * 1024; // 12 MB

/** Network timeout for the remote fetch. */
const FETCH_TIMEOUT_MS = 10_000;

/** Browser-like UA — many publisher CDNs reject default fetch UAs. */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CONTENT_TYPE_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export interface MirrorResult {
  url: string;
  contentType: string;
  bytes: number;
}

/**
 * Returns `true` if the URL is already hosted somewhere we serve directly,
 * so re-mirroring would be wasteful.
 */
export function isAlreadyMirrored(url: string): boolean {
  try {
    const host = new URL(url).host.toLowerCase();
    return ALREADY_HOSTED_HOSTS.has(host);
  } catch {
    return false;
  }
}

/**
 * Download a remote image and upload it to Firebase Storage.
 *
 * Idempotent and content-addressed by SHA-256 of the source URL: subsequent
 * calls for the same `srcUrl` return the cached URL without re-downloading,
 * and syndicated copies of the same image (shared across multiple items)
 * are stored once.
 *
 * Returns `null` on any failure (network, timeout, non-image content,
 * oversized payload). Callers should fall back to the original URL.
 */
export async function mirrorPublisherImage(
  srcUrl: string,
): Promise<MirrorResult | null> {
  if (!srcUrl) return null;
  if (isAlreadyMirrored(srcUrl)) return null;

  const urlHash = createHash("sha256").update(srcUrl).digest("hex").slice(0, 32);

  let result: MirrorResult | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(srcUrl, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          // No Referer — some CDNs hot-link block based on it.
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      console.warn(
        `[mirrorImage] HTTP ${response.status} for ${srcUrl}`,
      );
      return null;
    }

    const rawContentType = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (!rawContentType.startsWith("image/")) {
      console.warn(
        `[mirrorImage] non-image content-type "${rawContentType}" for ${srcUrl}`,
      );
      return null;
    }

    const contentType = rawContentType;
    const ext = CONTENT_TYPE_TO_EXT[contentType] ?? "jpg";

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      console.warn(`[mirrorImage] empty body for ${srcUrl}`);
      return null;
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      console.warn(
        `[mirrorImage] oversized (${buffer.length} bytes) for ${srcUrl}`,
      );
      return null;
    }

    // Content-addressed by URL hash so syndicated copies share storage.
    const storagePath = `mirrored/by-url/${urlHash}.${ext}`;

    // getOrUploadImageBuffer is idempotent: if the object already exists it
    // returns the existing URL without re-uploading.
    const url = await getOrUploadImageBuffer(
      storagePath,
      async () => buffer,
      contentType,
    );

    result = { url, contentType, bytes: buffer.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[mirrorImage] failed for ${srcUrl}: ${msg}`);
    return null;
  }

  return result;
}
