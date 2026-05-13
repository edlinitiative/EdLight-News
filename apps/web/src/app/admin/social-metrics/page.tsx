"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart2, RefreshCw, TrendingUp, MessageSquare, Repeat2, Heart, Eye } from "lucide-react";

interface PostMetric {
  id: string;
  sourceContentId: string;
  hookVariant?: string | null;
  score: number;
  fetchedAt: string | null;
  metrics: Record<string, number>;
  reach: number;
  engagement: number;
}

interface PlatformData {
  total: number;
  withMetrics: number;
  totals: Record<string, number>;
  topPosts: PostMetric[];
}

interface HookStat {
  variant: string;
  count: number;
  avgReach: number;
  avgEngagement: number;
}

interface MetricsData {
  fb: PlatformData;
  threads: PlatformData;
  x: PlatformData;
  hookStats: HookStat[];
  metricsEnabled: boolean;
}

function MetricPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
      {label} <strong>{value.toLocaleString()}</strong>
    </span>
  );
}

function PlatformCard({
  title,
  color,
  icon,
  data,
  reachLabel,
  engagementLabel,
}: {
  title: string;
  color: string;
  icon: React.ReactNode;
  data: PlatformData;
  reachLabel: string;
  engagementLabel: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700">
      <div className={`flex items-center gap-2 rounded-t-xl px-4 py-3 ${color}`}>
        {icon}
        <h2 className="font-semibold">{title}</h2>
        <span className="ml-auto text-xs opacity-70">
          {data.withMetrics} / {data.total} posts have metrics
        </span>
      </div>

      {/* Summary totals */}
      <div className="flex flex-wrap gap-2 border-b border-stone-100 px-4 py-3 dark:border-stone-800">
        <MetricPill label={reachLabel} value={Object.values(data.totals).reduce((s, v) => s + v, 0) > 0 ? (data.totals[reachLabel.toLowerCase().replace(/ /g, "_")] ?? data.topPosts.reduce((s, p) => s + p.reach, 0)) : 0} />
        <MetricPill label="Total engagement" value={data.topPosts.reduce((s, p) => s + p.engagement, 0)} />
        {Object.entries(data.totals)
          .filter(([k]) => !k.includes("impression") && !k.includes("views"))
          .slice(0, 4)
          .map(([k, v]) => (
            <MetricPill key={k} label={k.replace(/_/g, " ")} value={v} />
          ))}
      </div>

      {/* Top posts */}
      {data.topPosts.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-stone-400">
          No metrics collected yet. Enable <code className="rounded bg-stone-100 px-1 text-xs dark:bg-stone-800">SOCIAL_METRICS_FEEDBACK=true</code> on the worker.
        </p>
      ) : (
        <div className="divide-y divide-stone-50 dark:divide-stone-800">
          {data.topPosts.map((post) => (
            <div key={post.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {post.hookVariant && (
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                      {post.hookVariant}
                    </span>
                  )}
                  <span className="text-[10px] text-stone-400 truncate">{post.sourceContentId.slice(0, 14)}…</span>
                  {post.fetchedAt && (
                    <span className="text-[10px] text-stone-300 dark:text-stone-600">
                      {new Date(post.fetchedAt).toLocaleDateString("fr-FR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm tabular-nums">
                <span className="flex items-center gap-1 text-stone-500">
                  <Eye className="h-3 w-3" />
                  <span className="text-xs">{post.reach.toLocaleString()}</span>
                </span>
                <span className="flex items-center gap-1 text-stone-500">
                  <Heart className="h-3 w-3" />
                  <span className="text-xs">{post.engagement.toLocaleString()}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HookABTable({ stats }: { stats: HookStat[] }) {
  if (stats.length === 0) {
    return (
      <p className="text-sm text-stone-400">No hook variant data yet — metrics needed first.</p>
    );
  }
  const best = stats[0]!;
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-100 dark:border-stone-800 text-left text-xs uppercase tracking-wide text-stone-400">
            <th className="px-4 py-2">Hook Variant</th>
            <th className="px-4 py-2 text-right">Posts</th>
            <th className="px-4 py-2 text-right">Avg Reach</th>
            <th className="px-4 py-2 text-right">Avg Engagement</th>
            <th className="px-4 py-2 text-right">Winner?</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50 dark:divide-stone-800">
          {stats.map((s) => (
            <tr key={s.variant} className={s.variant === best.variant ? "bg-green-50/50 dark:bg-green-900/10" : ""}>
              <td className="px-4 py-2 font-mono text-[11px]">{s.variant}</td>
              <td className="px-4 py-2 text-right tabular-nums text-stone-500">{s.count}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.avgReach.toLocaleString()}</td>
              <td className="px-4 py-2 text-right tabular-nums">{s.avgEngagement.toFixed(1)}</td>
              <td className="px-4 py-2 text-right">
                {s.variant === best.variant && s.count >= 3 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    <TrendingUp className="h-3 w-3" /> Best
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SocialMetricsPage() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/social-metrics");
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed");
      setData(json as MetricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart2 className="h-6 w-6 text-indigo-500" />
            Social Metrics
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Engagement data from FB Insights, Threads, and X — last 72 hours.
            {data && !data.metricsEnabled && (
              <span className="ml-2 font-medium text-amber-600">
                ⚠ SOCIAL_METRICS_FEEDBACK is off — set to <code className="rounded bg-amber-50 px-1 text-xs dark:bg-amber-900/30">true</code> to collect data.
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-500 transition hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-stone-400">Loading…</p>}

      {data && !loading && (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <PlatformCard
              title="Facebook"
              color="bg-blue-50 dark:bg-blue-900/20"
              icon={<BarChart2 className="h-4 w-4 text-blue-600" />}
              data={data.fb}
              reachLabel="Reach"
              engagementLabel="Engagement"
            />
            <PlatformCard
              title="Threads"
              color="bg-purple-50 dark:bg-purple-900/20"
              icon={<MessageSquare className="h-4 w-4 text-purple-600" />}
              data={data.threads}
              reachLabel="Views"
              engagementLabel="Engagement"
            />
            <PlatformCard
              title="X / Twitter"
              color="bg-stone-100 dark:bg-stone-700/30"
              icon={<Repeat2 className="h-4 w-4 text-stone-600" />}
              data={data.x}
              reachLabel="Impressions"
              engagementLabel="Engagement"
            />
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-stone-400">
              <TrendingUp className="h-4 w-4" /> A/B Hook Performance (Facebook)
            </h2>
            <HookABTable stats={data.hookStats} />
            <p className="mt-2 text-xs text-stone-400">
              Ranked by average engagement per post. Needs ≥ 3 posts per variant to be considered significant.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
