/**
 * Shared staleness logic for IG queue items.
 *
 * Both `scheduleIgPost` and `processIgScheduled` need to decide whether a
 * queued item is too old to post.  This module is the single source of truth
 * for the TTL table and the `isStale()` predicate so the two jobs can never
 * drift out of sync.
 */

import type { IGPostType } from "@edlight-news/types";

// ── Staleness TTLs per IG post type (hours) ─────────────────────────────────
// News goes stale fast; scholarships with deadlines stay relevant longer.
export const STALENESS_TTL_HOURS: Record<IGPostType, number> = {
  news: 48,          // 2 days  — breaking/current events
  taux: 24,          // 1 day   — exchange rates are daily
  utility: 72,       // 3 days  — fait-du-jour, study tips
  histoire: 24,      // 1 day   — must match today's date
  opportunity: 336,  // 14 days — jobs/programs (capped by deadline)
  scholarship: 336,  // 14 days — scholarships (capped by deadline)
  breaking: 12,      // 12 h    — single-slide flash item loses relevance fast
  stat: 72,          // 3 days  — manually curated, treat like utility
};

/** Check if an IG queue item is too old to post. */
export function isStale(item: { igType: IGPostType; createdAt: any }): boolean {
  const ttlHours = STALENESS_TTL_HOURS[item.igType] ?? 72;
  const createdMs =
    item.createdAt && typeof item.createdAt === "object" && "seconds" in item.createdAt
      ? (item.createdAt as { seconds: number }).seconds * 1000
      : item.createdAt instanceof Date
        ? item.createdAt.getTime()
        : 0;
  if (createdMs === 0) {
    console.warn(
      `[igStaleness] createdAt is missing or corrupted for item with igType="${item.igType}" — treating as fresh. ` +
      `Raw value: ${JSON.stringify(item.createdAt)}`,
    );
    return false; // can't determine age — don't expire, but warn
  }
  return Date.now() - createdMs > ttlHours * 60 * 60 * 1000;
}
