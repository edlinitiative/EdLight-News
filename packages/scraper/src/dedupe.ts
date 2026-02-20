import { createHash } from "node:crypto";

/**
 * Generate a SHA-256 hash from url + title for deduplication.
 */
export function computeHash(url: string, title: string): string {
  return createHash("sha256")
    .update(`${url}::${title}`)
    .digest("hex");
}
