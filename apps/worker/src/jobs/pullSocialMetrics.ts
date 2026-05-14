/**
 * Worker job: pullSocialMetrics (P2)
 *
 * Runs once per day (triggered from the /tick route when the hour matches
 * METRICS_FETCH_HOUR, default 03:00 Haiti time). Fetches engagement metrics
 * for recently sent posts from Facebook Insights, Threads Insights, and the
 * X v2 tweets endpoint, then writes them back onto the queue items so that
 * opportunityScoring and editorial dashboards can use them.
 *
 * Feature-flagged: only runs when SOCIAL_METRICS_FEEDBACK=true.
 *
 * Metrics stored per platform:
 *   FB:      impressions, reach, reactions, comments, shares, clicks
 *   Threads: views, likes, replies, reposts, quotes
 *   X:       impressions, likes, retweets, replies, bookmarks
 */

import { fbQueueRepo, thQueueRepo, xQueueRepo, reelsPendingRepo } from "@edlight-news/firebase";
import type { ReelsMetrics } from "@edlight-news/types";

// ── Feature flag ──────────────────────────────────────────────────────────────
const ENABLED = process.env.SOCIAL_METRICS_FEEDBACK === "true";

/** Fetch metrics for posts sent in the last N hours. */
const LOOKBACK_HOURS = 48;

// ── Facebook ──────────────────────────────────────────────────────────────────

interface FbInsightValue {
  value: number;
}
interface FbInsightItem {
  name: string;
  values?: FbInsightValue[];
  value?: number;
}

async function fetchFbMetrics(
  fbPostId: string,
): Promise<Record<string, number> | null> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) return null;

  const metrics = [
    "post_impressions",
    "post_impressions_unique",
    "post_reactions_by_type_total",
    "post_clicks",
  ].join(",");

  try {
    const url = `https://graph.facebook.com/v19.0/${fbPostId}/insights?metric=${metrics}&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: FbInsightItem[] };
    const result: Record<string, number> = {};
    for (const item of json.data ?? []) {
      const val = item.value ?? item.values?.[0]?.value ?? 0;
      if (typeof val === "number") result[item.name] = val;
    }
    // Also fetch comment / share counts from the post object
    const postRes = await fetch(
      `https://graph.facebook.com/v19.0/${fbPostId}?fields=comments.summary(true),shares&access_token=${token}`,
    );
    if (postRes.ok) {
      const postJson = (await postRes.json()) as {
        comments?: { summary?: { total_count?: number } };
        shares?: { count?: number };
      };
      result.comments = postJson.comments?.summary?.total_count ?? 0;
      result.shares = postJson.shares?.count ?? 0;
    }
    return result;
  } catch {
    return null;
  }
}

// ── Threads ────────────────────────────────────────────────────────────────────

async function fetchThMetrics(
  thPostId: string,
): Promise<Record<string, number> | null> {
  const token = process.env.THREADS_ACCESS_TOKEN;
  if (!token) return null;

  const fields = "views,likes,replies,reposts,quotes";
  try {
    const url = `https://graph.threads.net/v1.0/${thPostId}/insights?metric=${fields}&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ name: string; values?: Array<{ value: number }> }>;
    };
    const result: Record<string, number> = {};
    for (const item of json.data ?? []) {
      result[item.name] = item.values?.[0]?.value ?? 0;
    }
    return result;
  } catch {
    return null;
  }
}

// ── X (Twitter) ───────────────────────────────────────────────────────────────

async function fetchXMetrics(
  xTweetId: string,
): Promise<Record<string, number> | null> {
  const bearer = process.env.X_ACCESS_TOKEN ?? process.env.X_BEARER_TOKEN;
  if (!bearer) return null;

  try {
    const url = `https://api.twitter.com/2/tweets/${xTweetId}?tweet.fields=public_metrics,non_public_metrics,organic_metrics`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        public_metrics?: Record<string, number>;
        non_public_metrics?: Record<string, number>;
        organic_metrics?: Record<string, number>;
      };
    };
    return {
      ...(json.data?.public_metrics ?? {}),
      ...(json.data?.non_public_metrics ?? {}),
      ...(json.data?.organic_metrics ?? {}),
    };
  } catch {
    return null;
  }
}

// ── Main job ───────────────────────────────────────────────────────────────────

export interface PullSocialMetricsResult {
  fb: { fetched: number; errors: number; skipped: number };
  th: { fetched: number; errors: number; skipped: number };
  x: { fetched: number; errors: number; skipped: number };
  reels: { fetched: number; errors: number; skipped: number; resolved: number };
  disabled?: true;
}

export async function pullSocialMetrics(): Promise<PullSocialMetricsResult> {
  const empty = { fetched: 0, errors: 0, skipped: 0 };
  const emptyReels = { ...empty, resolved: 0 };
  if (!ENABLED) {
    console.log("[pullSocialMetrics] Disabled (SOCIAL_METRICS_FEEDBACK != true)");
    return { fb: empty, th: empty, x: empty, reels: emptyReels, disabled: true };
  }

  const result: PullSocialMetricsResult = {
    fb: { ...empty },
    th: { ...empty },
    x: { ...empty },
    reels: { ...emptyReels },
  };

  // ── FB ──────────────────────────────────────────────────────────────────
  try {
    const fbItems = await fbQueueRepo.listRecentSent(LOOKBACK_HOURS, 50);
    for (const item of fbItems) {
      if (!item.fbPostId) { result.fb.skipped++; continue; }
      // Skip if metrics were already fetched recently (within 12h)
      const fetchedAt = (item as any).socialMetricsFetchedAt?.toDate?.() as Date | undefined;
      if (fetchedAt && Date.now() - fetchedAt.getTime() < 12 * 3600 * 1000) {
        result.fb.skipped++;
        continue;
      }
      try {
        const metrics = await fetchFbMetrics(item.fbPostId);
        if (metrics) {
          await fbQueueRepo.patchSocialMetrics(item.id, metrics);
          result.fb.fetched++;
          console.log(`[pullSocialMetrics] FB metrics for ${item.id}:`, metrics);
        } else {
          result.fb.errors++;
        }
      } catch (err) {
        console.error(`[pullSocialMetrics] FB error for ${item.id}:`, err instanceof Error ? err.message : err);
        result.fb.errors++;
      }
    }
  } catch (err) {
    console.error("[pullSocialMetrics] FB list error:", err);
  }

  // ── Threads ─────────────────────────────────────────────────────────────
  try {
    const thItems = await thQueueRepo.listSentToday(50);
    for (const item of thItems) {
      if (!item.thPostId) { result.th.skipped++; continue; }
      const fetchedAt = (item as any).socialMetricsFetchedAt?.toDate?.() as Date | undefined;
      if (fetchedAt && Date.now() - fetchedAt.getTime() < 12 * 3600 * 1000) {
        result.th.skipped++;
        continue;
      }
      try {
        const metrics = await fetchThMetrics(item.thPostId);
        if (metrics) {
          await thQueueRepo.patchSocialMetrics(item.id, metrics);
          result.th.fetched++;
          console.log(`[pullSocialMetrics] TH metrics for ${item.id}:`, metrics);
        } else {
          result.th.errors++;
        }
      } catch (err) {
        console.error(`[pullSocialMetrics] TH error for ${item.id}:`, err instanceof Error ? err.message : err);
        result.th.errors++;
      }
    }
  } catch (err) {
    console.error("[pullSocialMetrics] TH list error:", err);
  }

  // ── X ────────────────────────────────────────────────────────────────────
  try {
    const xItems = await xQueueRepo.listSentToday(50);
    for (const item of xItems) {
      if (!item.xTweetId) { result.x.skipped++; continue; }
      const fetchedAt = (item as any).socialMetricsFetchedAt?.toDate?.() as Date | undefined;
      if (fetchedAt && Date.now() - fetchedAt.getTime() < 12 * 3600 * 1000) {
        result.x.skipped++;
        continue;
      }
      try {
        const metrics = await fetchXMetrics(item.xTweetId);
        if (metrics) {
          await xQueueRepo.patchSocialMetrics(item.id, metrics);
          result.x.fetched++;
          console.log(`[pullSocialMetrics] X metrics for ${item.id}:`, metrics);
        } else {
          result.x.errors++;
        }
      } catch (err) {
        console.error(`[pullSocialMetrics] X error for ${item.id}:`, err instanceof Error ? err.message : err);
        result.x.errors++;
      }
    }
  } catch (err) {
    console.error("[pullSocialMetrics] X list error:", err);
  }

  // ── Reels (Instagram Graph API) ──────────────────────────────────────────
  // Cadence per-Reel based on age:
  //   < 24h posted → refresh every 2h
  //   2–7 d         → refresh every 12h
  //   8–60 d        → refresh once per day
  // Reels older than 60d are dropped — IG metrics stabilize well before then.
  try {
    const igUserId = process.env.IG_USER_ID;
    const igToken =
      process.env.IG_ACCESS_TOKEN ?? process.env.FB_PAGE_ACCESS_TOKEN;
    const reelItems = await reelsPendingRepo.listPostedSince(60, 200);

    // Resolve shortcode → IG numeric media id, cache in-tick to amortize the
    // /{ig-user-id}/media call across all stale Reels in this run.
    let mediaIdCache: Map<string, string> | null = null;
    const resolveMediaId = async (shortcode: string): Promise<string | null> => {
      if (/^\d+$/.test(shortcode)) return shortcode; // already numeric
      if (!igUserId || !igToken) return null;
      if (!mediaIdCache) {
        mediaIdCache = new Map();
        try {
          const url = `https://graph.facebook.com/v19.0/${igUserId}/media?fields=id,shortcode&limit=100&access_token=${igToken}`;
          const res = await fetch(url);
          if (res.ok) {
            const json = (await res.json()) as {
              data?: Array<{ id: string; shortcode: string }>;
            };
            for (const m of json.data ?? []) {
              if (m.id && m.shortcode) mediaIdCache.set(m.shortcode, m.id);
            }
            result.reels.resolved = mediaIdCache.size;
          }
        } catch (err) {
          console.warn("[pullSocialMetrics] IG media resolve failed:", err);
        }
      }
      return mediaIdCache.get(shortcode) ?? null;
    };

    for (const item of reelItems) {
      if (!item.igMediaId) {
        result.reels.skipped++;
        continue;
      }
      // Cadence gate
      const postedAt = (item.postedAt as { toDate?: () => Date } | undefined)?.toDate?.();
      const lastSyncedAt = (
        item.socialMetrics as { lastSyncedAt?: { toDate?: () => Date } } | undefined
      )?.lastSyncedAt?.toDate?.();
      const ageMs = postedAt ? Date.now() - postedAt.getTime() : Infinity;
      const sinceSyncMs = lastSyncedAt
        ? Date.now() - lastSyncedAt.getTime()
        : Infinity;
      const cadenceMs =
        ageMs < 24 * 3600 * 1000
          ? 2 * 3600 * 1000
          : ageMs < 7 * 24 * 3600 * 1000
            ? 12 * 3600 * 1000
            : 24 * 3600 * 1000;
      if (sinceSyncMs < cadenceMs) {
        result.reels.skipped++;
        continue;
      }

      try {
        const mediaId = await resolveMediaId(item.igMediaId);
        if (!mediaId) {
          result.reels.errors++;
          continue;
        }
        const metrics = await fetchReelMetrics(mediaId, item.durationSec, igToken);
        if (metrics) {
          await reelsPendingRepo.patchSocialMetrics(item.id, metrics);
          result.reels.fetched++;
          console.log(
            JSON.stringify({
              event: "reelMetricsSynced",
              reelId: item.id,
              igMediaId: item.igMediaId,
              plays: metrics.plays ?? 0,
              watchCompletionRate: metrics.watchCompletionRate ?? 0,
            }),
          );
        } else {
          result.reels.errors++;
        }
      } catch (err) {
        console.error(
          `[pullSocialMetrics] Reel error for ${item.id}:`,
          err instanceof Error ? err.message : err,
        );
        result.reels.errors++;
      }
    }
  } catch (err) {
    console.error("[pullSocialMetrics] Reels list error:", err);
  }

  console.log("[pullSocialMetrics] Done:", result);
  return result;
}

/**
 * Fetch IG Reel insights for one media id and compute `watchCompletionRate`
 * locally from `ig_reels_avg_watch_time` / `durationSec`.
 *
 * Docs: https://developers.facebook.com/docs/instagram-api/guides/insights
 * Returns a partial ReelsMetrics shape suitable for `patchSocialMetrics`.
 */
async function fetchReelMetrics(
  mediaId: string,
  durationSec: number,
  token: string | undefined,
): Promise<ReelsMetrics | null> {
  if (!token) return null;
  const metricList = [
    "plays",
    "reach",
    "likes",
    "comments",
    "shares",
    "saved",
    "total_interactions",
    "ig_reels_avg_watch_time",
    "ig_reels_video_view_total_time",
  ].join(",");
  try {
    const url = `https://graph.facebook.com/v19.0/${mediaId}/insights?metric=${metricList}&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Array<{ name: string; values?: Array<{ value: number }> }>;
    };
    const raw: Record<string, number> = {};
    for (const item of json.data ?? []) {
      raw[item.name] = item.values?.[0]?.value ?? 0;
    }
    // IG returns watch-time in **milliseconds**; convert to seconds.
    const avgWatchTimeSec = (raw.ig_reels_avg_watch_time ?? 0) / 1000;
    const totalWatchTimeSec = (raw.ig_reels_video_view_total_time ?? 0) / 1000;
    const watchCompletionRate =
      durationSec > 0 ? Math.min(avgWatchTimeSec / durationSec, 1) : 0;

    return {
      plays: raw.plays ?? 0,
      reach: raw.reach ?? 0,
      likes: raw.likes ?? 0,
      comments: raw.comments ?? 0,
      shares: raw.shares ?? 0,
      saves: raw.saved ?? 0,
      totalInteractions: raw.total_interactions ?? 0,
      avgWatchTimeSec,
      totalWatchTimeSec,
      watchCompletionRate,
    };
  } catch {
    return null;
  }
}
