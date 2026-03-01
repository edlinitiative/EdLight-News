"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface IGQueueEntry {
  id: string;
  sourceContentId: string;
  igType: string;
  score: number;
  status: string;
  scheduledFor: string | null;
  reasons: string[];
  caption: string | null;
  slidesCount: number;
  dryRunPath: string | null;
  igPostId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface IGQueueCounts {
  queued: number;
  scheduled: number;
  posted: number;
  skipped: number;
  rendering: number;
}

// ── Status badge colors ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-blue-100 text-blue-800",
  scheduled: "bg-yellow-100 text-yellow-800",
  scheduled_ready_for_manual: "bg-orange-100 text-orange-800",
  rendering: "bg-purple-100 text-purple-800",
  posted: "bg-green-100 text-green-800",
  skipped: "bg-stone-100 text-stone-500",
};

const TYPE_EMOJIS: Record<string, string> = {
  scholarship: "🎓",
  opportunity: "🚀",
  news: "📰",
  histoire: "📜",
  utility: "💡",
};

// ── Components ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-700 bg-green-50" :
    score >= 60 ? "text-blue-700 bg-blue-50" :
    score >= 40 ? "text-yellow-700 bg-yellow-50" :
    "text-stone-500 bg-stone-50";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${color}`}>
      {score}
    </span>
  );
}

function CountCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${color}`}>
      <p className="text-xs text-stone-500">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

// ── Filter tabs ──────────────────────────────────────────────────────────────

const FILTER_OPTIONS = ["all", "queued", "scheduled", "posted", "skipped"] as const;
type FilterOption = (typeof FILTER_OPTIONS)[number];

// ── Main page ────────────────────────────────────────────────────────────────

export default function IGQueuePage() {
  const [entries, setEntries] = useState<IGQueueEntry[]>([]);
  const [counts, setCounts] = useState<IGQueueCounts | null>(null);
  const [filter, setFilter] = useState<FilterOption>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ig-queue");
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load");
      setEntries(data.items as IGQueueEntry[]);
      setCounts(data.counts as IGQueueCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load IG queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = filter === "all"
    ? entries
    : entries.filter((e) => {
        if (filter === "scheduled") return e.status === "scheduled" || e.status === "scheduled_ready_for_manual";
        return e.status === filter;
      });

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Instagram Queue</h1>
        <p className="mt-1 text-sm text-stone-500">
          Curated IG posting pipeline — view queued, scheduled, and posted items.
        </p>
      </div>

      {/* Counts */}
      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <CountCard label="Queued" value={counts.queued} color="bg-blue-50" />
          <CountCard label="Scheduled" value={counts.scheduled} color="bg-yellow-50" />
          <CountCard label="Posted" value={counts.posted} color="bg-green-50" />
          <CountCard label="Skipped" value={counts.skipped} color="bg-stone-50" />
          <CountCard label="Rendering" value={counts.rendering} color="bg-purple-50" />
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => setFilter(opt)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === opt
                ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
            }`}
          >
            {opt === "all" ? "All" : opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        ))}
        <button
          onClick={() => void loadData()}
          className="ml-auto text-xs text-stone-400 hover:text-stone-600"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error state */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Loading */}
      {loading && <p className="text-sm text-stone-400">Loading…</p>}

      {/* Table */}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-stone-400">No items found.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50 dark:bg-stone-800">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Type</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Score</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Status</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Scheduled</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Slides</th>
                <th className="px-4 py-2 text-left font-medium text-stone-500">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
              {filtered.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    className="cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/50"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span className="mr-1">{TYPE_EMOJIS[entry.igType] ?? "📄"}</span>
                      {entry.igType}
                    </td>
                    <td className="px-4 py-2.5"><ScoreBadge score={entry.score} /></td>
                    <td className="px-4 py-2.5"><StatusBadge status={entry.status} /></td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-xs text-stone-500">
                      {entry.scheduledFor
                        ? new Date(entry.scheduledFor).toLocaleString("fr-FR", { timeZone: "America/Port-au-Prince" })
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-center tabular-nums">{entry.slidesCount}</td>
                    <td className="px-4 py-2.5 text-xs text-stone-400">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr key={`${entry.id}-detail`}>
                      <td colSpan={6} className="bg-stone-50/50 px-6 py-4 dark:bg-stone-800/30">
                        <div className="space-y-3 text-xs">
                          <div>
                            <span className="font-semibold text-stone-500">Item ID:</span>{" "}
                            <span className="font-mono">{entry.sourceContentId}</span>
                          </div>
                          {entry.caption && (
                            <div>
                              <span className="font-semibold text-stone-500">Caption preview:</span>
                              <p className="mt-1 max-w-xl whitespace-pre-wrap text-stone-600 dark:text-stone-300">
                                {entry.caption}
                              </p>
                            </div>
                          )}
                          {entry.reasons.length > 0 && (
                            <div>
                              <span className="font-semibold text-stone-500">Reasons:</span>
                              <ul className="mt-1 list-inside list-disc text-stone-500">
                                {entry.reasons.map((r, i) => (
                                  <li key={i}>{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {entry.igPostId && (
                            <div>
                              <span className="font-semibold text-stone-500">IG Post ID:</span>{" "}
                              <span className="font-mono">{entry.igPostId}</span>
                            </div>
                          )}
                          {entry.dryRunPath && (
                            <div>
                              <span className="font-semibold text-stone-500">Dry-run path:</span>{" "}
                              <span className="font-mono">{entry.dryRunPath}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
