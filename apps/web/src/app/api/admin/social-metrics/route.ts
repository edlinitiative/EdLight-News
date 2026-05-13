import { NextResponse } from "next/server";
import { fbQueueRepo, thQueueRepo, xQueueRepo } from "@edlight-news/firebase";

export const dynamic = "force-dynamic";
const NO_STORE = { headers: { "Cache-Control": "no-store" } };

function safeMerge(
  ...maps: Array<Record<string, number> | undefined>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of maps) {
    if (!m) continue;
    for (const [k, v] of Object.entries(m)) {
      out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

function timestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (
    typeof value === "object" &&
    value !== null &&
    "_seconds" in value &&
    typeof (value as { _seconds: unknown })._seconds === "number"
  ) {
    return new Date((value as { _seconds: number })._seconds * 1000).toISOString();
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export async function GET() {
  try {
    const [fbItems, thItems, xItems] = await Promise.all([
      fbQueueRepo.listRecentSent(72, 100),
      thQueueRepo.listRecentSent(72, 100),
      xQueueRepo.listRecentSent(72, 100),
    ]);

    // ── FB ────────────────────────────────────────────────────────────────
    const fbWithMetrics = fbItems
      .filter((i) => i.socialMetrics && Object.keys(i.socialMetrics).length > 0)
      .map((i) => ({
        id: i.id,
        sourceContentId: i.sourceContentId,
        hookVariant: i.hookVariant ?? null,
        score: i.score,
        fetchedAt: timestampToIso(i.socialMetricsFetchedAt),
        metrics: i.socialMetrics!,
        // computed roll-up
        reach: i.socialMetrics!.post_impressions_unique ?? i.socialMetrics!.post_impressions ?? 0,
        engagement:
          (i.socialMetrics!.comments ?? 0) +
          (i.socialMetrics!.shares ?? 0) +
          Object.entries(i.socialMetrics!)
            .filter(([k]) => k.startsWith("post_reactions_") && k.endsWith("_total"))
            .reduce((s, [, v]) => s + v, 0),
      }))
      .sort((a, b) => b.reach - a.reach);

    const fbTotals = safeMerge(...fbWithMetrics.map((i) => i.metrics));

    // ── Threads ──────────────────────────────────────────────────────────
    const thWithMetrics = thItems
      .filter((i) => i.socialMetrics && Object.keys(i.socialMetrics).length > 0)
      .map((i) => ({
        id: i.id,
        sourceContentId: i.sourceContentId,        hookVariant: i.hookVariant ?? null,        score: i.score,
        fetchedAt: timestampToIso(i.socialMetricsFetchedAt),
        metrics: i.socialMetrics!,
        reach: i.socialMetrics!.views ?? 0,
        engagement:
          (i.socialMetrics!.likes ?? 0) +
          (i.socialMetrics!.replies ?? 0) +
          (i.socialMetrics!.reposts ?? 0),
      }))
      .sort((a, b) => b.reach - a.reach);

    const thTotals = safeMerge(...thWithMetrics.map((i) => i.metrics));

    // ── X ─────────────────────────────────────────────────────────────────
    const xWithMetrics = xItems
      .filter((i) => i.socialMetrics && Object.keys(i.socialMetrics).length > 0)
      .map((i) => ({
        id: i.id,
        sourceContentId: i.sourceContentId,
        hookVariant: i.hookVariant ?? null,
        score: i.score,
        fetchedAt: timestampToIso(i.socialMetricsFetchedAt),
        metrics: i.socialMetrics!,
        reach: i.socialMetrics!.impression_count ?? i.socialMetrics!.impressions ?? 0,
        engagement:
          (i.socialMetrics!.like_count ?? 0) +
          (i.socialMetrics!.reply_count ?? 0) +
          (i.socialMetrics!.retweet_count ?? 0),
      }))
      .sort((a, b) => b.reach - a.reach);

    const xTotals = safeMerge(...xWithMetrics.map((i) => i.metrics));

    // ── A/B hook breakdown (per-platform, min 5 posts per variant) ────────
    type HookRow = { variant: string; count: number; avgReach: number; avgEngagement: number };
    function rollup(
      posts: Array<{ hookVariant: string | null; reach: number; engagement: number }>,
    ): { variants: HookRow[]; totalPosts: number } {
      const breakdown: Record<
        string,
        { count: number; totalReach: number; totalEngagement: number }
      > = {};
      for (const item of posts) {
        const v = item.hookVariant ?? "unknown";
        const existing = breakdown[v] ?? { count: 0, totalReach: 0, totalEngagement: 0 };
        breakdown[v] = {
          count: existing.count + 1,
          totalReach: existing.totalReach + item.reach,
          totalEngagement: existing.totalEngagement + item.engagement,
        };
      }
      const variants = Object.entries(breakdown)
        .filter(([, s]) => s.count >= 5)
        .map(([variant, s]) => ({
          variant,
          count: s.count,
          avgReach: s.count > 0 ? Math.round(s.totalReach / s.count) : 0,
          avgEngagement:
            s.count > 0 ? Math.round((s.totalEngagement / s.count) * 10) / 10 : 0,
        }))
        .sort((a, b) => b.avgEngagement - a.avgEngagement);
      return { variants, totalPosts: posts.length };
    }

    const hookStatsByPlatform = {
      fb: rollup(fbWithMetrics),
      th: rollup(thWithMetrics),
      x: rollup(xWithMetrics),
    };

    // Backwards-compat: keep `hookStats` as the legacy FB-only roll-up.
    const hookBreakdown: Record<
      string,
      { count: number; totalReach: number; totalEngagement: number }
    > = {};
    for (const item of fbWithMetrics) {
      const v = item.hookVariant ?? "unknown";
      const existing = hookBreakdown[v] ?? { count: 0, totalReach: 0, totalEngagement: 0 };
      hookBreakdown[v] = {
        count: existing.count + 1,
        totalReach: existing.totalReach + item.reach,
        totalEngagement: existing.totalEngagement + item.engagement,
      };
    }
    const hookStats = Object.entries(hookBreakdown)
      .map(([variant, s]) => ({
        variant,
        count: s.count,
        avgReach: s.count > 0 ? Math.round(s.totalReach / s.count) : 0,
        avgEngagement: s.count > 0 ? Math.round((s.totalEngagement / s.count) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    return NextResponse.json(
      {
        fb: {
          total: fbItems.length,
          withMetrics: fbWithMetrics.length,
          totals: fbTotals,
          topPosts: fbWithMetrics.slice(0, 20),
        },
        threads: {
          total: thItems.length,
          withMetrics: thWithMetrics.length,
          totals: thTotals,
          topPosts: thWithMetrics.slice(0, 20),
        },
        x: {
          total: xItems.length,
          withMetrics: xWithMetrics.length,
          totals: xTotals,
          topPosts: xWithMetrics.slice(0, 20),
        },
        hookStats,
        hookStatsByPlatform,
        metricsEnabled: process.env.SOCIAL_METRICS_FEEDBACK === "true",
      },
      NO_STORE,
    );
  } catch (err) {
    console.error("[api/admin/social-metrics] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500, ...NO_STORE },
    );
  }
}
