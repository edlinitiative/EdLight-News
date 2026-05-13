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

import { fbQueueRepo, thQueueRepo, xQueueRepo } from "@edlight-news/firebase";

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
  disabled?: true;
}

export async function pullSocialMetrics(): Promise<PullSocialMetricsResult> {
  const empty = { fetched: 0, errors: 0, skipped: 0 };
  if (!ENABLED) {
    console.log("[pullSocialMetrics] Disabled (SOCIAL_METRICS_FEEDBACK != true)");
    return { fb: empty, th: empty, x: empty, disabled: true };
  }

  const result: PullSocialMetricsResult = {
    fb: { ...empty },
    th: { ...empty },
    x: { ...empty },
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

  console.log("[pullSocialMetrics] Done:", result);
  return result;
}
