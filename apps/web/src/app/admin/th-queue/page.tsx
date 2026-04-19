"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  AtSign,
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import Image from "next/image";
import type { THQueueCounts, THQueueEntry } from "@/types/admin";

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  scheduled: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  sending: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  sent: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  skipped: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
};

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors}`}>
      {status}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-900/30" :
    score >= 60 ? "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-900/30" :
    score >= 40 ? "text-yellow-700 bg-yellow-50 dark:text-yellow-300 dark:bg-yellow-900/30" :
    "text-stone-500 bg-stone-50 dark:text-stone-400 dark:bg-stone-800";
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${color}`}>
      {score}
    </span>
  );
}

function CountCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-lg border px-4 py-3 ${color}`}>
      <p className="text-xs text-stone-500 dark:text-stone-400">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function compactDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-FR", {
    timeZone: "America/Port-au-Prince",
    month: "short",
    day: "numeric",
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={copy}
      className="ml-1 inline-flex items-center text-stone-400 transition hover:text-stone-600 dark:hover:text-stone-300"
      title="Copy post text"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function QueueCard({
  entry,
  onAction,
}: {
  entry: THQueueEntry;
  onAction: (id: string, action: string) => Promise<void>;
}) {
  const [showFullText, setShowFullText] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleAction = async (action: string) => {
    setBusy(true);
    try {
      await onAction(entry.id, action);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border-t-4 border-purple-600 bg-white shadow-sm transition hover:shadow-md dark:bg-stone-900">
      <div className="flex items-center gap-2 px-3 py-2">
        <AtSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <ScoreBadge score={entry.score} />
        <StatusBadge status={entry.status} />
        {entry.sendRetries > 0 && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <AlertTriangle className="h-2.5 w-2.5" />
            {entry.sendRetries} retries
          </span>
        )}
        {entry.thPostId && (
          <a
            href={`https://www.threads.net/post/${entry.thPostId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-stone-400 hover:text-purple-500"
            title="View on Threads"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {entry.article && (
        <div className="flex gap-3 border-t border-stone-100 px-3 py-3 dark:border-stone-800">
          {entry.article.imageUrl && (
            <Image
              src={entry.article.imageUrl}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 shrink-0 rounded-md object-cover"
              unoptimized
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide text-stone-400">
              {entry.article.category && <span>{entry.article.category.replace(/_/g, " ")}</span>}
              {entry.article.vertical && <span>{entry.article.vertical}</span>}
              {entry.article.sourceName && <span>{entry.article.sourceName}</span>}
              {compactDate(entry.article.publishedAt) && <span>{compactDate(entry.article.publishedAt)}</span>}
            </div>
            {entry.linkUrl ? (
              <a
                href={entry.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900 hover:underline dark:text-stone-100"
              >
                {entry.article.title ?? "Untitled article"}
              </a>
            ) : (
              <p className="line-clamp-2 text-sm font-semibold leading-snug text-stone-900 dark:text-stone-100">
                {entry.article.title ?? "Untitled article"}
              </p>
            )}
            {entry.article.summary && (
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
                {entry.article.summary}
              </p>
            )}
          </div>
        </div>
      )}

      {entry.text && (
        <div className="border-t border-stone-100 px-3 py-2 dark:border-stone-800">
          <div className="flex items-start justify-between">
            <pre
              className="flex-1 cursor-pointer whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-stone-600 dark:text-stone-400"
              onClick={() => setShowFullText(!showFullText)}
            >
              {showFullText
                ? entry.text
                : entry.text.length > 220
                  ? `${entry.text.slice(0, 220)}...`
                  : entry.text}
            </pre>
            <CopyButton text={entry.text} />
          </div>
        </div>
      )}

      {(entry.linkUrl || entry.imageUrl) && (
        <div className="space-y-1 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
          {entry.linkUrl && (
            <a
              href={entry.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-purple-600 hover:underline dark:text-purple-400"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{entry.linkUrl}</span>
            </a>
          )}
          {entry.imageUrl && (
            <a
              href={entry.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-stone-500 hover:underline dark:text-stone-400"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">Image URL</span>
            </a>
          )}
        </div>
      )}

      {entry.error && (
        <div className="border-t border-red-100 bg-red-50/50 px-3 py-1.5 dark:border-red-900 dark:bg-red-900/10">
          <p className="text-[10px] text-red-600 dark:text-red-400">{entry.error}</p>
        </div>
      )}

      {(entry.status === "queued" || entry.status === "scheduled" || entry.status === "failed" || entry.status === "skipped") && (
        <div className="flex items-center gap-2 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
          {(entry.status === "queued" || entry.status === "scheduled") && (
            <>
              <button
                disabled={busy}
                onClick={() => void handleAction("publish_now")}
                className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-[11px] font-medium text-purple-700 transition hover:bg-purple-100 disabled:opacity-50 dark:bg-purple-900/30 dark:text-purple-300"
                title="Publish on the next worker tick"
              >
                <Zap className="h-3 w-3" /> Publish Now
              </button>
              <button
                disabled={busy}
                onClick={() => void handleAction("skip")}
                className="flex items-center gap-1 rounded-md bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-500 transition hover:bg-stone-100 disabled:opacity-50 dark:bg-stone-800 dark:text-stone-400"
              >
                <XCircle className="h-3 w-3" /> Skip
              </button>
            </>
          )}
          {(entry.status === "failed" || entry.status === "skipped") && (
            <button
              disabled={busy}
              onClick={() => void handleAction("requeue")}
              className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-900/30 dark:text-amber-300"
            >
              <RotateCcw className="h-3 w-3" /> Re-queue
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-stone-100 px-3 py-1.5 text-[10px] text-stone-400 dark:border-stone-800">
        <span className="truncate" title={entry.sourceContentId}>
          {entry.sourceContentId.slice(0, 12)}...
        </span>
        <span>
          {entry.scheduledFor
            ? new Date(entry.scheduledFor).toLocaleString("fr-FR", {
                timeZone: "America/Port-au-Prince",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : entry.createdAt
              ? new Date(entry.createdAt).toLocaleDateString("fr-FR")
              : "-"}
        </span>
      </div>
    </div>
  );
}

const STATUS_FILTERS = ["all", "queued", "scheduled", "sending", "sent", "failed", "skipped"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function THQueuePage() {
  const [entries, setEntries] = useState<THQueueEntry[]>([]);
  const [counts, setCounts] = useState<THQueueCounts | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeConfirm, setPurgeConfirm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/th-queue");
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load");
      setEntries(data.items as THQueueEntry[]);
      setCounts(data.counts as THQueueCounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Threads queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const performAction = useCallback(async (id: string, action: string) => {
    try {
      const res = await fetch("/api/admin/th-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Action failed");
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }, [loadData]);

  const handlePurge = useCallback(async () => {
    setPurging(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/th-queue/purge", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Purge failed");
      setPurgeConfirm(false);
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purge failed");
    } finally {
      setPurging(false);
    }
  }, [loadData]);

  const filtered = entries.filter((entry) => {
    if (statusFilter === "all") return entry.status !== "skipped";
    return entry.status === statusFilter;
  });

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Threads Queue</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Posts prepared for Threads distribution
          </p>
        </div>
        <div className="flex items-center gap-2">
          {purgeConfirm ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 dark:border-red-700 dark:bg-red-900/20">
              <span className="text-xs font-medium text-red-700 dark:text-red-300">Delete everything?</span>
              <button
                onClick={() => void handlePurge()}
                disabled={purging}
                className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {purging ? "Purging..." : "Confirm"}
              </button>
              <button
                onClick={() => setPurgeConfirm(false)}
                className="text-xs text-red-400 transition hover:text-red-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setPurgeConfirm(true)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 transition hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
            >
              <Trash2 className="h-3 w-3" />
              Purge All
            </button>
          )}
          <button
            onClick={() => void loadData()}
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-500 transition hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <CountCard label="Queued" value={counts.queued} color="bg-blue-50 dark:bg-blue-900/10" />
          <CountCard label="Scheduled" value={counts.scheduled} color="bg-yellow-50 dark:bg-yellow-900/10" />
          <CountCard label="Sending" value={counts.sending} color="bg-purple-50 dark:bg-purple-900/10" />
          <CountCard label="Sent" value={counts.sent} color="bg-green-50 dark:bg-green-900/10" />
          <CountCard label="Failed" value={counts.failed} color="bg-red-50 dark:bg-red-900/10" />
          <CountCard label="Skipped" value={counts.skipped} color="bg-stone-50 dark:bg-stone-800/50" />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option}
            onClick={() => setStatusFilter(option)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              statusFilter === option
                ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
            }`}
          >
            {option === "all" ? "All" : option.charAt(0).toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && <p className="text-sm text-stone-400">Loading...</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-sm text-stone-400">No Threads queue items found.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <QueueCard key={entry.id} entry={entry} onAction={performAction} />
          ))}
        </div>
      )}
    </section>
  );
}
