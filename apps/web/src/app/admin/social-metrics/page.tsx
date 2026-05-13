"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart2,
  RefreshCw,
  TrendingUp,
  MessageSquare,
  Repeat2,
  Heart,
  Eye,
  Zap,
  Sticker,
  Phone,
  AlertTriangle,
} from "lucide-react";

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

interface BoostMetrics {
  windowHours: number;
  itemsBoosted: number;
  uniqueItems: number;
  avgBoost: number;
  boostedAtCap: number;
  repeatBoostedItems: number;
  topBoostedItems: Array<{
    itemId: string;
    boost: number;
    boostedScore: number;
    topic: string;
    platformsContributed: string[];
    capped: boolean;
    appliedAt: string | null;
  }>;
}

interface StoryStickers {
  windowDays: number;
  storiesConsidered: number;
  storiesWithAttempts: number;
  linkSticker: { attached: number; skipped: number; successRate: number | null };
  poll: { attached: number; skipped: number; successRate: number | null };
  recentSkips: Array<{ storyId: string; feature: string; reason: string }>;
}

interface WaChannelSummary {
  latest: { followerCount: number; dateISO: string; source: string };
  delta7d: number | null;
  delta7dPct: number | null;
  count: number;
}

interface MetricsData {
  fb: PlatformData;
  threads: PlatformData;
  x: PlatformData;
  hookStats: HookStat[];
  hookStatsByPlatform?: {
    fb: { variants: HookStat[]; totalPosts: number };
    th: { variants: HookStat[]; totalPosts: number };
    x: { variants: HookStat[]; totalPosts: number };
  };
  boostMetrics?: BoostMetrics | null;
  storyStickers?: StoryStickers | null;
  waChannel?: WaChannelSummary | null;
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

function BoostHealthPanel({ m }: { m: BoostMetrics | null }) {
  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700">
      <div className="flex items-center gap-2 rounded-t-xl bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
        <Zap className="h-4 w-4 text-amber-600" />
        <h2 className="font-semibold">Boost health</h2>
        <span className="ml-auto text-xs opacity-70">last 7 days</span>
      </div>
      {!m ? (
        <p className="px-4 py-6 text-center text-sm text-stone-400">
          No boosts logged yet — need <code>SOCIAL_METRICS_FEEDBACK=true</code> + ≥1 day of metrics.
        </p>
      ) : (
        <div className="space-y-3 px-4 py-4 text-sm">
          <div className="grid grid-cols-2 gap-2 tabular-nums">
            <Stat label="Items boosted" value={m.itemsBoosted} />
            <Stat label="Unique items" value={m.uniqueItems} />
            <Stat label="Avg boost" value={`+${m.avgBoost}`} />
            <Stat
              label="At cap (+20)"
              value={m.boostedAtCap}
              warn={m.boostedAtCap > 10}
            />
            <Stat label="Repeat boosted" value={m.repeatBoostedItems} />
          </div>
          {m.boostedAtCap > 10 && (
            <p className="flex items-center gap-1 rounded bg-amber-100 px-2 py-1 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              <AlertTriangle className="h-3 w-3" /> Cap saturation — consider
              raising the +20 ceiling.
            </p>
          )}
          {m.topBoostedItems.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-stone-400">
                Top boosted
              </div>
              <ul className="space-y-1 text-xs">
                {m.topBoostedItems.slice(0, 5).map((t) => (
                  <li key={`${t.itemId}-${t.appliedAt}`} className="flex items-center gap-2">
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-mono text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                      +{t.boost}
                    </span>
                    <span className="text-stone-400">{t.topic}</span>
                    <span className="truncate text-[10px] text-stone-400">{t.itemId.slice(0, 14)}…</span>
                    <span className="ml-auto text-[10px] text-stone-400">
                      {t.platformsContributed.join("/")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StoryStickersPanel({ s }: { s: StoryStickers | null }) {
  const collapsed =
    s !== null &&
    s.linkSticker.successRate !== null &&
    s.linkSticker.successRate < 50 &&
    s.linkSticker.attached + s.linkSticker.skipped >= 5;
  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700">
      <div className="flex items-center gap-2 rounded-t-xl bg-pink-50 px-4 py-3 dark:bg-pink-900/20">
        <Sticker className="h-4 w-4 text-pink-600" />
        <h2 className="font-semibold">Story stickers</h2>
        {collapsed && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" /> Sticker collapse
          </span>
        )}
        <span className="ml-auto text-xs opacity-70">last 7 days</span>
      </div>
      {!s ? (
        <p className="px-4 py-6 text-center text-sm text-stone-400">No sticker data yet.</p>
      ) : (
        <div className="space-y-3 px-4 py-4 text-sm">
          <div className="grid grid-cols-2 gap-2 tabular-nums">
            <Stat label="Stories" value={s.storiesConsidered} />
            <Stat label="With attempts" value={s.storiesWithAttempts} />
          </div>
          <StickerRow
            label="Link sticker"
            attached={s.linkSticker.attached}
            skipped={s.linkSticker.skipped}
            rate={s.linkSticker.successRate}
            warn={
              s.linkSticker.successRate !== null &&
              s.linkSticker.successRate < 50 &&
              s.linkSticker.attached + s.linkSticker.skipped >= 5
            }
          />
          <StickerRow
            label="Poll"
            attached={s.poll.attached}
            skipped={s.poll.skipped}
            rate={s.poll.successRate}
          />
          {s.recentSkips.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-stone-400">
                Recent skips
              </div>
              <ul className="space-y-1 text-xs">
                {s.recentSkips.slice(0, 5).map((r, i) => (
                  <li key={`${r.storyId}-${i}`} className="text-[11px]">
                    <span className="font-mono text-stone-500">{r.feature}</span>{" "}
                    <span className="text-stone-400">·</span>{" "}
                    <span className="text-stone-500">{r.reason.slice(0, 60)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StickerRow({
  label,
  attached,
  skipped,
  rate,
  warn,
}: {
  label: string;
  attached: number;
  skipped: number;
  rate: number | null;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 text-stone-500">{label}</span>
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        ✓ {attached}
      </span>
      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-500 dark:bg-stone-800">
        ✗ {skipped}
      </span>
      <span
        className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold ${
          warn
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
            : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
        }`}
      >
        {rate === null ? "—" : `${rate.toFixed(1)}%`}
      </span>
    </div>
  );
}

function WaChannelPanel({ w }: { w: WaChannelSummary | null }) {
  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700">
      <div className="flex items-center gap-2 rounded-t-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-900/20">
        <Phone className="h-4 w-4 text-emerald-600" />
        <h2 className="font-semibold">WhatsApp Channel</h2>
        <Link
          href="/admin/wa-channel"
          className="ml-auto text-[10px] uppercase tracking-wider text-emerald-700 hover:underline dark:text-emerald-300"
        >
          Manage →
        </Link>
      </div>
      {!w ? (
        <p className="px-4 py-6 text-center text-sm text-stone-400">
          No snapshots yet — record one in <Link className="underline" href="/admin/wa-channel">/admin/wa-channel</Link>.
        </p>
      ) : (
        <div className="space-y-3 px-4 py-4 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-400">
              Latest count
            </div>
            <div className="text-3xl font-bold tabular-nums">
              {w.latest.followerCount.toLocaleString()}
            </div>
            <div className="text-[10px] text-stone-400">{w.latest.dateISO} · {w.latest.source}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-stone-400">7-day delta</div>
            <div
              className={`text-xl font-semibold tabular-nums ${
                w.delta7d === null
                  ? "text-stone-400"
                  : w.delta7d >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
              }`}
            >
              {w.delta7d === null
                ? "—"
                : `${w.delta7d >= 0 ? "+" : ""}${w.delta7d.toLocaleString()}${
                    w.delta7dPct !== null ? `  (${w.delta7dPct >= 0 ? "+" : ""}${w.delta7dPct.toFixed(1)}%)` : ""
                  }`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded p-2 ${warn ? "bg-amber-50 dark:bg-amber-900/30" : "bg-stone-50 dark:bg-stone-800/40"}`}
    >
      <div className="text-[10px] uppercase tracking-wider text-stone-400">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${warn ? "text-amber-700 dark:text-amber-300" : ""}`}>
        {value}
      </div>
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
          {/* Rollout PR — Boost / Stickers / WA panels */}
          <div className="grid gap-6 lg:grid-cols-3">
            <BoostHealthPanel m={data.boostMetrics ?? null} />
            <StoryStickersPanel s={data.storyStickers ?? null} />
            <WaChannelPanel w={data.waChannel ?? null} />
          </div>

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
              <TrendingUp className="h-4 w-4" /> A/B Hook Performance (per platform)
            </h2>
            <p className="mb-4 text-xs text-stone-400">
              Variants with fewer than 5 posts are hidden. Ranked by average engagement per post.
            </p>
            <div className="space-y-6">
              {(
                [
                  { key: "fb" as const, label: "Facebook" },
                  { key: "th" as const, label: "Threads" },
                  { key: "x" as const, label: "X / Twitter" },
                ]
              ).map(({ key, label }) => {
                const panel =
                  data.hookStatsByPlatform?.[key] ??
                  (key === "fb"
                    ? { variants: data.hookStats, totalPosts: data.fb.withMetrics }
                    : { variants: [], totalPosts: 0 });
                return (
                  <div key={key}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
                      {label}{" "}
                      <span className="text-stone-400">
                        ({panel.totalPosts} posts with metrics, {panel.variants.length} qualifying variants)
                      </span>
                    </h3>
                    <HookABTable stats={panel.variants} />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
