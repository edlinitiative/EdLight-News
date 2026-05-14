"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Film,
  Play,
  RefreshCw,
  Send,
  Trophy,
  XCircle,
} from "lucide-react";
import type {
  ReelsPendingEntry,
  ReelsPendingResponse,
  ReelsLeaderboardEntry,
} from "@/types/admin";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  posted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-stone-200 text-stone-600 dark:bg-stone-800 dark:text-stone-400",
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors}`}>
      {status}
    </span>
  );
}

function formatSec(s: number): string {
  if (!Number.isFinite(s)) return "–";
  return `${s.toFixed(1)}s`;
}
function formatPct(p: number | undefined): string {
  if (typeof p !== "number") return "–";
  return `${(p * 100).toFixed(1)}%`;
}
function formatNum(n: number | undefined): string {
  if (typeof n !== "number") return "–";
  return n.toLocaleString("en-US");
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600 transition hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {label ?? (copied ? "Copied" : "Copy")}
    </button>
  );
}

function CostCard({ costToday, ceilingUsd }: { costToday: number; ceilingUsd: number }) {
  const pct = ceilingUsd > 0 ? Math.min(1, costToday / ceilingUsd) : 0;
  const barColor = pct < 0.6 ? "bg-green-500" : pct < 0.9 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
      <p className="text-xs text-stone-500 dark:text-stone-400">Today's cost</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">${costToday.toFixed(4)}</p>
      <p className="mt-1 text-[11px] text-stone-400">ceiling ${ceilingUsd.toFixed(2)}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
        <div className={`h-full ${barColor}`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function ReelCard({
  entry,
  onAction,
}: {
  entry: ReelsPendingEntry;
  onAction: (id: string, action: "approve" | "reject" | "posted", payload?: unknown) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [igUrl, setIgUrl] = useState("");
  const [reason, setReason] = useState("");

  const handle = async (action: "approve" | "reject" | "posted", payload?: unknown) => {
    setBusy(true);
    try {
      await onAction(entry.id, action, payload);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border-t-4 border-fuchsia-500 bg-white shadow-sm transition hover:shadow-md dark:bg-stone-900">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Film className="h-4 w-4 text-fuchsia-500" />
        <StatusBadge status={entry.status} />
        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-600 dark:bg-stone-800 dark:text-stone-300">
          {entry.topic}
        </span>
        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-500 dark:bg-stone-800 dark:text-stone-400">
          {entry.template}
        </span>
        <span className="text-[10px] text-stone-400">{formatSec(entry.durationSec)}</span>
        {typeof entry.costEstimateUsd === "number" && (
          <span className="text-[10px] text-stone-400">
            ${entry.costEstimateUsd.toFixed(4)}
          </span>
        )}
        {entry.igPostUrl && (
          <a
            href={entry.igPostUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-stone-400 hover:text-fuchsia-500"
            title="Open on Instagram"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {entry.article && (
        <div className="border-t border-stone-100 px-3 py-2 dark:border-stone-800">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900 dark:text-stone-100">
            {entry.article.title ?? "Untitled article"}
          </p>
          {entry.article.sourceName && (
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-stone-400">
              {entry.article.sourceName}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-stone-100 px-3 py-2 dark:border-stone-800">
        <video
          src={entry.mp4Url}
          controls
          playsInline
          poster={entry.thumbnailUrl || undefined}
          className="h-auto w-full rounded-md bg-black"
          style={{ aspectRatio: "9/16", maxHeight: 360 }}
        />
      </div>

      <details className="border-t border-stone-100 px-3 py-2 text-[11px] dark:border-stone-800">
        <summary className="cursor-pointer text-stone-500">Script</summary>
        <pre className="mt-1 whitespace-pre-wrap font-sans text-stone-600 dark:text-stone-400">
          {entry.scriptText}
        </pre>
      </details>

      <details className="border-t border-stone-100 px-3 py-2 text-[11px] dark:border-stone-800" open={entry.status !== "rejected"}>
        <summary className="flex cursor-pointer items-center justify-between text-stone-500">
          IG Caption
          <CopyButton text={entry.igCaption} label="Copy caption" />
        </summary>
        <pre className="mt-1 whitespace-pre-wrap font-sans text-stone-700 dark:text-stone-200">
          {entry.igCaption}
        </pre>
      </details>

      {entry.socialMetrics && (
        <div className="grid grid-cols-3 gap-1 border-t border-stone-100 px-3 py-2 text-center text-[10px] dark:border-stone-800">
          <div>
            <p className="text-stone-400">Plays</p>
            <p className="font-bold tabular-nums">{formatNum(entry.socialMetrics.plays)}</p>
          </div>
          <div>
            <p className="text-stone-400">Reach</p>
            <p className="font-bold tabular-nums">{formatNum(entry.socialMetrics.reach)}</p>
          </div>
          <div>
            <p className="text-stone-400">Watch %</p>
            <p className="font-bold tabular-nums">
              {formatPct(entry.socialMetrics.watchCompletionRate)}
            </p>
          </div>
        </div>
      )}

      {entry.rejectionReason && (
        <div className="border-t border-red-100 bg-red-50/50 px-3 py-1.5 dark:border-red-900 dark:bg-red-900/10">
          <p className="text-[10px] text-red-600 dark:text-red-400">
            Rejected: {entry.rejectionReason}
          </p>
        </div>
      )}

      {entry.status === "pending" && (
        <div className="flex items-center gap-2 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
          <button
            disabled={busy}
            onClick={() => void handle("approve")}
            className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 transition hover:bg-green-100 disabled:opacity-50 dark:bg-green-900/30 dark:text-green-300"
          >
            <Check className="h-3 w-3" /> Approve
          </button>
          <a
            href={entry.mp4Url}
            download={`reel-${entry.id}.mp4`}
            className="flex items-center gap-1 rounded-md bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600 transition hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
          >
            <Download className="h-3 w-3" /> Download MP4
          </a>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reject reason"
            className="ml-auto w-32 rounded border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] dark:border-stone-700 dark:bg-stone-800"
          />
          <button
            disabled={busy}
            onClick={() => void handle("reject", { reason })}
            className="flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-300"
          >
            <XCircle className="h-3 w-3" /> Reject
          </button>
        </div>
      )}

      {entry.status === "approved" && (
        <div className="space-y-2 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
          <ol className="space-y-1 text-[11px] text-stone-600 dark:text-stone-300">
            <li>1. Download the MP4 below.</li>
            <li>2. Open Instagram → New Reel → Upload from gallery.</li>
            <li>3. Pick a trending audio track (Sandra's voiceover stays mixed in).</li>
            <li>4. Paste the caption above as the post description.</li>
            <li>5. Post, copy the IG URL, paste it back here.</li>
          </ol>
          <div className="flex items-center gap-2">
            <a
              href={entry.mp4Url}
              download={`reel-${entry.id}.mp4`}
              className="flex items-center gap-1 rounded-md bg-fuchsia-50 px-2 py-1 text-[11px] font-medium text-fuchsia-700 transition hover:bg-fuchsia-100 dark:bg-fuchsia-900/30 dark:text-fuchsia-300"
            >
              <Download className="h-3 w-3" /> Download MP4
            </a>
            <input
              value={igUrl}
              onChange={(e) => setIgUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/…"
              className="flex-1 rounded border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] dark:border-stone-700 dark:bg-stone-800"
            />
            <button
              disabled={busy || igUrl.trim().length === 0}
              onClick={() => void handle("posted", { igPostUrl: igUrl.trim() })}
              className="flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-[11px] font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
            >
              <Send className="h-3 w-3" /> Mark posted
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-stone-100 px-3 py-1.5 text-[10px] text-stone-400 dark:border-stone-800">
        <span title={entry.id}>{entry.reelVariant}</span>
        <span>
          {entry.postedAt
            ? `posted ${new Date(entry.postedAt).toLocaleDateString("fr-FR")}`
            : entry.generatedAt
              ? new Date(entry.generatedAt).toLocaleString("fr-FR", {
                  timeZone: "America/Port-au-Prince",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "-"}
        </span>
      </div>
    </div>
  );
}

function Leaderboard({ rows }: { rows: ReelsLeaderboardEntry[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-stone-400">
        No leaderboard yet — needs 3+ posted Reels per variant in the last 30 days.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 dark:border-stone-800">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-800/50 dark:text-stone-400">
          <tr>
            <th className="px-3 py-2 text-left">Variant</th>
            <th className="px-3 py-2 text-right">Posts</th>
            <th className="px-3 py-2 text-right">Avg watch %</th>
            <th className="px-3 py-2 text-right">Avg plays</th>
            <th className="px-3 py-2 text-right">Avg reactions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {rows.map((row, i) => (
            <tr key={row.reelVariant} className={i === 0 ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}>
              <td className="px-3 py-2 font-mono text-xs">
                {i === 0 && <Trophy className="mr-1 inline h-3 w-3 text-yellow-500" />}
                {row.reelVariant}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{row.posts}</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums">
                {formatPct(row.avgWatchCompletionRate)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatNum(Math.round(row.avgPlays))}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatNum(Math.round(row.avgTotalInteractions))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ReelsPendingPage() {
  const [data, setData] = useState<ReelsPendingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reels-pending");
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Load failed");
      setData(json as ReelsPendingResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const action = useCallback(
    async (id: string, kind: "approve" | "reject" | "posted", payload?: unknown) => {
      try {
        const res = await fetch(`/api/admin/reels-pending/${id}/${kind}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload ?? {}),
        });
        const json = await res.json();
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "Action failed");
        void load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    },
    [load],
  );

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Film className="h-6 w-6 text-fuchsia-500" />
            Reels Pending Review
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Sandra-voiced Reels awaiting human approval and manual posting.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-500 transition hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {data && !data.enabled && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-300">
          REELS_ENABLED is <code>false</code>. The worker is not generating new Reels —
          existing items below are still actionable.
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <CostCard costToday={data.costToday} ceilingUsd={data.ceilingUsd} />
          <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <p className="text-xs text-stone-500 dark:text-stone-400">Pending</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{data.pending.length}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <p className="text-xs text-stone-500 dark:text-stone-400">Approved</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{data.approved.length}</p>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <p className="text-xs text-stone-500 dark:text-stone-400">Posted (30d)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{data.posted.length}</p>
          </div>
        </div>
      )}

      {loading && !data && <p className="text-sm text-stone-400">Loading...</p>}

      {data && (
        <>
          <div>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <Play className="h-4 w-4" /> Pending review
            </h2>
            {data.pending.length === 0 ? (
              <p className="text-sm text-stone-400">Nothing pending right now.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.pending.map((entry) => (
                  <ReelCard key={entry.id} entry={entry} onAction={action} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <Send className="h-4 w-4" /> Approved — ready to post
            </h2>
            {data.approved.length === 0 ? (
              <p className="text-sm text-stone-400">No approved Reels waiting to be posted.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.approved.map((entry) => (
                  <ReelCard key={entry.id} entry={entry} onAction={action} />
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <Trophy className="h-4 w-4 text-yellow-500" /> Variant leaderboard (last 30d)
            </h2>
            <Leaderboard rows={data.leaderboard} />
          </div>

          <div>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold">
              <Film className="h-4 w-4" /> Posted Reels
            </h2>
            {data.posted.length === 0 ? (
              <p className="text-sm text-stone-400">No posted Reels in the last 30 days.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.posted.map((entry) => (
                  <ReelCard key={entry.id} entry={entry} onAction={action} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
