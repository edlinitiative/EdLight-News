/**
 * Firestore repo for the `reels_pending_review` collection.
 *
 * Lifecycle:
 *   pending  → buildReelsQueue tick step writes here after `buildReel()` succeeds.
 *   approved → human reviewer accepts the Reel via /admin/reels-pending,
 *              downloads the .mp4, and posts manually from the IG app
 *              (so trending audio can be picked at post time).
 *   posted   → human pastes the IG post URL back into the dashboard;
 *              `igMediaId` is parsed from it for the metrics worker.
 *   rejected → human discards the Reel; daily slot opens for regeneration.
 *
 * Direct API publishing is intentionally deferred until IG ≥ 5k followers.
 */

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getDb } from "../admin.js";
import type {
  ReelsPendingItem,
  ReelsPendingStatus,
  ReelsMetrics,
  ReelsCostBreakdown,
  ReelsTopic,
  ReelsTemplate,
} from "@edlight-news/types";
import {
  createReelsPendingItemSchema,
  type CreateReelsPendingItem,
} from "@edlight-news/types";

const COLLECTION = "reels_pending_review";

function collection() {
  return getDb().collection(COLLECTION);
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value) {
    const t = value as { toDate?: unknown };
    if (typeof t.toDate === "function") {
      const parsed = t.toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const seconds = (value as { seconds?: unknown }).seconds;
    if (typeof seconds === "number") return new Date(seconds * 1000);
  }
  return null;
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createReelsPendingItem(
  data: CreateReelsPendingItem,
): Promise<ReelsPendingItem> {
  const validated = createReelsPendingItemSchema.parse(data);
  const clean = Object.fromEntries(
    Object.entries(validated).filter(([, v]) => v !== undefined),
  );
  const ref = collection().doc();
  const now = FieldValue.serverTimestamp();
  await ref.set({ ...clean, createdAt: now, updatedAt: now });
  const snap = await ref.get();
  return { id: ref.id, ...snap.data() } as ReelsPendingItem;
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getReelsPendingItem(
  id: string,
): Promise<ReelsPendingItem | null> {
  const snap = await collection().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as ReelsPendingItem;
}

export async function listByStatus(
  status: ReelsPendingStatus,
  limit = 50,
): Promise<ReelsPendingItem[]> {
  // Avoid composite-index dependency by sorting in-memory.
  const snap = await collection()
    .where("status", "==", status)
    .limit(Math.max(limit * 4, 80))
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ReelsPendingItem)
    .sort((a, b) => {
      const at = toDate(a.generatedAt)?.getTime() ?? 0;
      const bt = toDate(b.generatedAt)?.getTime() ?? 0;
      return bt - at;
    })
    .slice(0, limit);
}

/** Pending OR approved items generated today (Haiti tz). Used by the queue
 *  builder to enforce the 1-Reel-per-day cold-start ceiling. */
export async function listOpenSlotsForDay(
  haitiDateKey: string,
): Promise<ReelsPendingItem[]> {
  const [pending, approved] = await Promise.all([
    listByStatus("pending", 50),
    listByStatus("approved", 50),
  ]);
  return [...pending, ...approved].filter((item) => {
    const generated = toDate(item.generatedAt);
    if (!generated) return false;
    const key = haitiDateKeyOf(generated);
    return key === haitiDateKey;
  });
}

function haitiDateKeyOf(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Port-au-Prince",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Posted items in the last `days` days, newest first. Used by:
 *   - the admin "posted" panel,
 *   - the reelVariant leaderboard,
 *   - the metrics worker (filtered further by lastSyncedAt cadence). */
export async function listPostedSince(
  days = 60,
  limit = 200,
): Promise<ReelsPendingItem[]> {
  const since = Date.now() - days * 24 * 3600 * 1000;
  const snap = await collection()
    .where("status", "==", "posted")
    .limit(Math.max(limit * 2, 200))
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ReelsPendingItem)
    .filter((item) => {
      const posted = toDate(item.postedAt);
      return posted ? posted.getTime() >= since : false;
    })
    .sort((a, b) => {
      const at = toDate(a.postedAt)?.getTime() ?? 0;
      const bt = toDate(b.postedAt)?.getTime() ?? 0;
      return bt - at;
    })
    .slice(0, limit);
}

/**
 * Find the most-recent posted Reel that was generated from a given source
 * content item. Used by the editorial scorer to apply `reelEngagementBoost`
 * to articles whose Reel performed well. Returns null if no posted Reel
 * exists for that source.
 */
export async function findLatestPostedBySourceItemId(
  sourceItemId: string,
): Promise<ReelsPendingItem | null> {
  const snap = await collection()
    .where("sourceItemId", "==", sourceItemId)
    .where("status", "==", "posted")
    .limit(20)
    .get();
  if (snap.empty) return null;
  const items = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ReelsPendingItem)
    .sort((a, b) => {
      const at = toDate(a.postedAt)?.getTime() ?? 0;
      const bt = toDate(b.postedAt)?.getTime() ?? 0;
      return bt - at;
    });
  return items[0] ?? null;
}

/** Today's cumulative cost across all generated Reels. Drives the ceiling. */
export async function sumCostForDay(haitiDateKey: string): Promise<number> {
  const snap = await collection()
    .where("status", "in", ["pending", "approved", "posted", "rejected"])
    .limit(500)
    .get();
  let total = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as ReelsPendingItem;
    const generated = toDate(data.generatedAt);
    if (!generated) continue;
    if (haitiDateKeyOf(generated) !== haitiDateKey) continue;
    if (typeof data.costEstimateUsd === "number") total += data.costEstimateUsd;
  }
  return total;
}

// ── Update ──────────────────────────────────────────────────────────────────

export async function approve(id: string, approvedBy: string): Promise<void> {
  await collection().doc(id).update({
    status: "approved" satisfies ReelsPendingStatus,
    approvedAt: FieldValue.serverTimestamp(),
    approvedBy,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function reject(id: string, reason: string): Promise<void> {
  await collection().doc(id).update({
    status: "rejected" satisfies ReelsPendingStatus,
    rejectionReason: reason,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Mark as posted. Caller is responsible for parsing `igMediaId` from the URL
 *  via `parseIgMediaIdFromUrl()` before calling. */
export async function markPosted(
  id: string,
  args: { igMediaId: string; igPostUrl: string },
): Promise<void> {
  await collection().doc(id).update({
    status: "posted" satisfies ReelsPendingStatus,
    postedAt: FieldValue.serverTimestamp(),
    igMediaId: args.igMediaId,
    igPostUrl: args.igPostUrl,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Patch insights metrics from the IG Graph API onto a posted Reel. */
export async function patchSocialMetrics(
  id: string,
  metrics: ReelsMetrics,
): Promise<void> {
  await collection().doc(id).update({
    socialMetrics: {
      ...metrics,
      lastSyncedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse an IG post URL and return the shortcode portion. We store the
 * shortcode (e.g. "C1aBcD2eFgH") under `igMediaId` because the public URL
 * gives us no other stable handle. The metrics worker then exchanges the
 * shortcode for a full IG Graph media id via the API.
 *
 * Accepts:
 *   https://www.instagram.com/reel/C1aBcD2eFgH/
 *   https://www.instagram.com/reels/C1aBcD2eFgH/?utm=...
 *   https://instagram.com/p/C1aBcD2eFgH
 */
export function parseIgMediaIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url.trim());
    if (!/instagram\.com$/i.test(u.hostname.replace(/^www\./, ""))) return null;
    const segments = u.pathname.split("/").filter(Boolean);
    const types = new Set(["reel", "reels", "p", "tv"]);
    for (let i = 0; i < segments.length - 1; i++) {
      if (types.has(segments[i]!.toLowerCase())) {
        const candidate = segments[i + 1]!;
        if (/^[A-Za-z0-9_-]{6,}$/.test(candidate)) return candidate;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── Aggregation ─────────────────────────────────────────────────────────────

export interface ReelVariantStats {
  reelVariant: string;
  topic: ReelsTopic;
  template: ReelsTemplate;
  posts: number;
  avgWatchCompletionRate: number;
  avgPlays: number;
  avgTotalInteractions: number;
}

/**
 * Compute leaderboard of reelVariants by avg watchCompletionRate over the
 * last `days` days. Variants with fewer than `minPosts` posts are excluded
 * so a single lucky Reel doesn't dominate.
 */
export async function computeVariantLeaderboard(args: {
  days?: number;
  minPosts?: number;
}): Promise<ReelVariantStats[]> {
  const days = args.days ?? 30;
  const minPosts = args.minPosts ?? 3;
  const items = await listPostedSince(days, 500);

  const groups = new Map<string, ReelsPendingItem[]>();
  for (const item of items) {
    const key = item.reelVariant;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  const stats: ReelVariantStats[] = [];
  for (const [variant, group] of groups) {
    if (group.length < minPosts) continue;
    const withMetrics = group.filter(
      (i) => typeof i.socialMetrics?.watchCompletionRate === "number",
    );
    if (withMetrics.length === 0) continue;
    const avg = (sel: (i: ReelsPendingItem) => number | undefined) => {
      const vals = group
        .map(sel)
        .filter((v): v is number => typeof v === "number");
      return vals.length === 0
        ? 0
        : vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    stats.push({
      reelVariant: variant,
      topic: group[0]!.topic,
      template: group[0]!.template,
      posts: group.length,
      avgWatchCompletionRate: avg((i) => i.socialMetrics?.watchCompletionRate),
      avgPlays: avg((i) => i.socialMetrics?.plays),
      avgTotalInteractions: avg((i) => i.socialMetrics?.totalInteractions),
    });
  }

  return stats.sort(
    (a, b) => b.avgWatchCompletionRate - a.avgWatchCompletionRate,
  );
}
