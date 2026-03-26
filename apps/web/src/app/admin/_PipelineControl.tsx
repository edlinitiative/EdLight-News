"use client";

import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import type { TickResult } from "@/types/admin";

// ── Result panel ─────────────────────────────────────────────────────────────

function ResultRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-stone-500 dark:text-stone-400">{label}</span>
      <span className="font-medium tabular-nums dark:text-white">{value}</span>
    </div>
  );
}

function TickResultPanel({ result }: { result: TickResult }) {
  const bg = result.ok
    ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
    : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
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
        <p className="text-sm text-red-700 dark:text-red-400">{result.error}</p>
      )}

      {result.results && (
        <div className="divide-y divide-stone-200 rounded-lg bg-white/60 px-4 py-2 dark:divide-stone-700 dark:bg-stone-800/60">
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

// ── Pipeline Control ──────────────────────────────────────────────────────────

export function PipelineControl() {
  const [running, setRunning] = useState(false);
  const [tickResult, setTickResult] = useState<TickResult | null>(null);

  async function runPipeline() {
    setRunning(true);
    setTickResult(null);
    try {
      const res = await fetch("/api/admin/tick", { method: "POST" });
      const data = (await res.json()) as TickResult;
      setTickResult(data);
    } catch (err) {
      setTickResult({ ok: false, error: err instanceof Error ? err.message : "Network error" });
    } finally {
      setRunning(false);
    }
  }

  return (
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
  );
}
