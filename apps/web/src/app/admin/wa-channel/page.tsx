"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, RefreshCw, Plus, TrendingUp, TrendingDown } from "lucide-react";

interface Snapshot {
  dateISO: string;
  followerCount: number;
  source: string;
  notes?: string;
  createdAt: string | null;
}

interface Summary {
  latest: Snapshot;
  delta7d: number | null;
  delta7dPct: number | null;
  count: number;
  recent: Snapshot[];
}

export default function WaChannelPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [followerCount, setFollowerCount] = useState("");
  const [dateISO, setDateISO] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/wa-channel");
      const json = (await res.json()) as { summary: Summary | null; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setSummary(json.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/wa-channel/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followerCount: Number(followerCount),
          dateISO,
          source: "manual",
          notes: notes || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setFollowerCount("");
      setNotes("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Phone className="h-6 w-6 text-emerald-500" />
            WhatsApp Channel
          </h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Manual follower snapshots — Meta does not expose this number via API.
            Record one a few times per week to track growth.
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

      {/* Latest + 7d delta */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
            <div className="text-xs uppercase tracking-wider text-stone-400">Latest count</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">
              {summary.latest.followerCount.toLocaleString()}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              {summary.latest.dateISO} · {summary.latest.source}
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
            <div className="text-xs uppercase tracking-wider text-stone-400">7-day delta</div>
            <div
              className={`mt-1 flex items-center gap-2 text-3xl font-bold tabular-nums ${
                summary.delta7d === null
                  ? "text-stone-400"
                  : summary.delta7d >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
              }`}
            >
              {summary.delta7d === null ? (
                "—"
              ) : (
                <>
                  {summary.delta7d >= 0 ? (
                    <TrendingUp className="h-6 w-6" />
                  ) : (
                    <TrendingDown className="h-6 w-6" />
                  )}
                  {summary.delta7d >= 0 ? "+" : ""}
                  {summary.delta7d.toLocaleString()}
                </>
              )}
            </div>
            <div className="mt-1 text-xs text-stone-500">
              {summary.delta7dPct === null
                ? "Need a baseline ≥ 7 days old"
                : `${summary.delta7dPct >= 0 ? "+" : ""}${summary.delta7dPct.toFixed(1)}%`}
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 p-4 dark:border-stone-700">
            <div className="text-xs uppercase tracking-wider text-stone-400">Snapshots logged</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{summary.count}</div>
            <div className="mt-1 text-xs text-stone-500">last 30 entries</div>
          </div>
        </div>
      )}

      {!summary && !loading && (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700">
          No snapshots yet — record your first one below to start tracking.
        </p>
      )}

      {/* Add snapshot */}
      <form
        onSubmit={submit}
        className="rounded-xl border border-stone-200 p-4 dark:border-stone-700"
      >
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-stone-500">
          <Plus className="h-4 w-4" /> Add snapshot
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-stone-500">
            Date
            <input
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
              className="mt-1 block w-full rounded border border-stone-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
              required
            />
          </label>
          <label className="text-xs text-stone-500">
            Follower count
            <input
              type="number"
              min={0}
              value={followerCount}
              onChange={(e) => setFollowerCount(e.target.value)}
              className="mt-1 block w-full rounded border border-stone-300 px-2 py-1.5 text-sm tabular-nums dark:border-stone-700 dark:bg-stone-900"
              required
            />
          </label>
          <label className="text-xs text-stone-500 sm:col-span-1">
            Notes (optional)
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="campaign label, anomaly, …"
              className="mt-1 block w-full rounded border border-stone-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={submitting || !followerCount}
          className="mt-3 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save snapshot"}
        </button>
      </form>

      {/* History */}
      {summary && summary.recent.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left text-xs uppercase tracking-wide text-stone-400 dark:border-stone-800">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Followers</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50 dark:divide-stone-800">
              {summary.recent.map((s, i) => (
                <tr key={`${s.dateISO}-${i}`}>
                  <td className="px-4 py-2 font-mono text-[12px]">{s.dateISO}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {s.followerCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-xs text-stone-500">{s.source}</td>
                  <td className="px-4 py-2 text-xs text-stone-500">{s.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
