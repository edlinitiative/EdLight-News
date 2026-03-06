"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  items: { total: number; withImages: number };
  contentVersions: { total: number; published: number; draft: number };
  sources: { active: number };
}

interface TickResult {
  ok: boolean;
  timedOut?: boolean;
  durationMs?: number;
  error?: string;
  results?: {
    ingest: { new: number; skipped: number; errors: number };
    process: { processed: number; skipped: number; errors: number };
    generate: { generated: number; skipped: number; errors: number };
    published: number;
    images?: { generated: number; failed: number };
  };
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color = "bg-white",
}: {
  label: string;
  value: number | string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className={`rounded-xl border p-5 ${color}`}>
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

// ── Result panel ─────────────────────────────────────────────────────────────

function ResultRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function TickResultPanel({ result }: { result: TickResult }) {
  const bg = result.ok ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200";
  const icon = result.ok
    ? <CheckCircle className="inline-block h-5 w-5 text-green-600" />
    : <XCircle className="inline-block h-5 w-5 text-red-600" />;
  const heading = result.timedOut
    ? "Pipeline triggered (still running)"
    : result.ok
      ? "Pipeline complete"
      : "Pipeline error";

  return (
    <div className={`rounded-lg border p-5 space-y-3 ${bg}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold">
          {icon} {heading}
        </span>
        {result.durationMs && (
          <span className="text-xs text-stone-400">
            {(result.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {result.error && (
        <p className="text-sm text-red-700">{result.error}</p>
      )}

      {result.results && (
        <div className="divide-y rounded-lg bg-white/60 px-4 py-2">
          <div className="py-2">
            <ResultRow label="Ingest — new raw items" value={result.results.ingest?.new ?? 0} />
          </div>
          <div className="py-2 space-y-1">
            <ResultRow label="Process — items created/updated" value={result.results.process?.processed ?? 0} />
            <ResultRow label="Process — skipped" value={result.results.process?.skipped ?? 0} />
          </div>
          <div className="py-2">
            <ResultRow label="Generate — content versions" value={result.results.generate?.generated ?? 0} />
          </div>
          <div className="py-2">
            <ResultRow label="Published" value={result.results.published ?? 0} />
          </div>
          {result.results.images && (
            <div className="py-2 space-y-1">
              <ResultRow label="Images — generated" value={result.results.images.generated} />
              <ResultRow label="Images — failed" value={result.results.images.failed} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [tickResult, setTickResult] = useState<TickResult | null>(null);

  const loadStats = useCallback(async () => {
    setStatsError(null);
    try {
      const res = await fetch("/api/admin/stats");
      if (res.status === 401) {
        window.location.href = "/admin/login?from=/admin";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load stats");
      setStats(data as Stats);
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : "Failed to load stats");
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  async function runPipeline() {
    setRunning(true);
    setTickResult(null);
    try {
      const res = await fetch("/api/admin/tick", { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/admin/login?from=/admin";
        return;
      }
      const data = (await res.json()) as TickResult;
      setTickResult(data);
      if (data.ok) setTimeout(() => void loadStats(), 500);
    } catch (err) {
      setTickResult({ ok: false, error: err instanceof Error ? err.message : "Network error" });
    } finally {
      setRunning(false);
    }
  }

  const imagesPct =
    stats && stats.items.total > 0
      ? Math.round((stats.items.withImages / stats.items.total) * 100)
      : 0;

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-stone-500">
          Pipeline status and controls for EdLight News.
        </p>
      </div>

      {/* Stats grid */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-400">
          Overview
        </h2>
        {statsError ? (
          <p className="text-sm text-red-600">{statsError}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="Active sources" value={stats?.sources.active ?? "—"} />
            <StatCard label="Items" value={stats?.items.total ?? "—"} />
            <StatCard
              label="Published articles"
              value={stats?.contentVersions.published ?? "—"}
              sub="FR + HT combined"
              color="bg-green-50"
            />
            <StatCard
              label="Drafts"
              value={stats?.contentVersions.draft ?? "—"}
              sub="awaiting review"
              color={(stats?.contentVersions.draft ?? 0) > 0 ? "bg-yellow-50" : "bg-white"}
            />
            <StatCard
              label="With images"
              value={stats ? `${stats.items.withImages} (${imagesPct}%)` : "—"}
              sub={`of ${stats?.items.total ?? "?"} items`}
            />
          </div>
        )}
        <button
          onClick={() => void loadStats()}
          className="mt-2 text-xs text-stone-400 hover:text-stone-600"
        >
          ↻ Refresh stats
        </button>
      </div>

      {/* Pipeline trigger */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-400">
          Pipeline
        </h2>
        <div className="flex items-center gap-4">
          <button
            onClick={() => void runPipeline()}
            disabled={running}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-100"
          >
            {running ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Running…
              </>
            ) : (
              <>▶ Run Pipeline</>
            )}
          </button>
          {running && (
            <span className="text-sm text-stone-400">
              This may take 1–3 minutes. Please wait.
            </span>
          )}
        </div>
        <p className="text-xs text-stone-400">
          Runs: ingest → process → generate (FR+HT) → publish drafts → generate images
        </p>
        {tickResult && <TickResultPanel result={tickResult} />}
      </div>
    </section>
  );
}

