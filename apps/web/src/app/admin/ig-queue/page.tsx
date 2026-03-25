"use client";

import { useState, useEffect, useCallback } from "react";
import { Copy, Check, ExternalLink, RefreshCw, ArrowUpCircle, XCircle, RotateCcw, X } from "lucide-react";
import { IGPostPreview } from "@/components/IGSlidePreview";
import type { SlideData } from "@/components/IGSlidePreview";

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
  slides: SlideData[];
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
  expired: number;
}

// ── Status badge colors ──────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  scheduled: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  scheduled_ready_for_manual: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  rendering: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  posted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  skipped: "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
  expired: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const TYPE_ACCENTS: Record<string, string> = {
  scholarship: "border-blue-500",
  opportunity: "border-violet-500",
  news: "border-teal-500",
  histoire: "border-amber-600",
  utility: "border-emerald-500",
};

const TYPE_EMOJIS: Record<string, string> = {
  scholarship: "🎓",
  opportunity: "🚀",
  news: "📰",
  histoire: "📜",
  utility: "💡",
};

// ── Small components ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors}`}>
      {status.replace(/_/g, " ")}
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="ml-1 inline-flex items-center text-stone-400 transition hover:text-stone-600 dark:hover:text-stone-300" title="Copy caption">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Post modal ───────────────────────────────────────────────────────────────

function PostModal({ entry, onClose }: { entry: IGQueueEntry; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-stone-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* IG-like header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2.5 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-[10px] font-bold text-white">
              EL
            </div>
            <div>
              <p className="text-xs font-semibold leading-tight text-stone-900 dark:text-stone-100">edlight.haiti</p>
              <p className="text-[10px] leading-tight text-stone-400">{entry.igType}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={entry.status} />
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Slide preview — full-width 1:1 IG proportions */}
        <IGPostPreview igType={entry.igType} slides={entry.slides} />

        {/* Caption */}
        {entry.caption && (
          <div className="max-h-40 overflow-y-auto border-t border-stone-100 px-3 py-2.5 dark:border-stone-800">
            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">edlight.haiti </span>
            <pre className="inline whitespace-pre-wrap font-sans text-xs leading-relaxed text-stone-600 dark:text-stone-400">{entry.caption}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Post card ────────────────────────────────────────────────────────────────

function PostCard({ entry, onAction, onOpen }: { entry: IGQueueEntry; onAction: (id: string, action: string) => void; onOpen: (entry: IGQueueEntry) => void }) {
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [busy, setBusy] = useState(false);
  const accentBorder = TYPE_ACCENTS[entry.igType] ?? "border-stone-300";

  const handleAction = async (action: string) => {
    setBusy(true);
    try {
      onAction(entry.id, action);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`overflow-hidden rounded-xl border-t-4 ${accentBorder} bg-white shadow-sm transition hover:shadow-md dark:bg-stone-900`}>
      {/* Visual preview — click to open IG modal */}
      <div className="cursor-pointer p-3" onClick={() => onOpen(entry)}>
        <IGPostPreview
          igType={entry.igType}
          slides={entry.slides}
        />
      </div>

      {/* Meta bar */}
      <div className="flex items-center gap-2 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
        <span className="text-base">{TYPE_EMOJIS[entry.igType] ?? "📄"}</span>
        <span className="text-xs font-medium text-stone-700 dark:text-stone-300">{entry.igType}</span>
        <ScoreBadge score={entry.score} />
        <StatusBadge status={entry.status} />
        {entry.igPostId && (
          <a
            href={`https://www.instagram.com/p/${entry.igPostId}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-stone-400 hover:text-blue-500"
            title="View on Instagram"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {/* Caption */}
      {entry.caption && (
        <div className="border-t border-stone-100 px-3 py-2 dark:border-stone-800">
          <div className="flex items-start justify-between">
            <pre
              className="flex-1 cursor-pointer whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-stone-600 dark:text-stone-400"
              onClick={() => setShowFullCaption(!showFullCaption)}
            >
              {showFullCaption
                ? entry.caption
                : entry.caption.length > 150
                  ? entry.caption.slice(0, 150) + "…"
                  : entry.caption}
            </pre>
            <CopyButton text={entry.caption} />
          </div>
        </div>
      )}

      {/* Actions */}
      {(entry.status === "queued" || entry.status === "expired" || entry.status === "skipped" || entry.status === "scheduled" || entry.status === "scheduled_ready_for_manual") && (
        <div className="flex items-center gap-2 border-t border-stone-100 px-3 py-2 dark:border-stone-800">
          {entry.status === "queued" && (
            <>
              <button
                disabled={busy}
                onClick={() => void handleAction("push")}
                className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-300"
              >
                <ArrowUpCircle className="h-3 w-3" /> Push
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
          {(entry.status === "scheduled" || entry.status === "scheduled_ready_for_manual") && (
            <button
              disabled={busy}
              onClick={() => void handleAction("skip")}
              className="flex items-center gap-1 rounded-md bg-stone-50 px-2 py-1 text-[11px] font-medium text-stone-500 transition hover:bg-stone-100 disabled:opacity-50 dark:bg-stone-800 dark:text-stone-400"
            >
              <XCircle className="h-3 w-3" /> Skip
            </button>
          )}
          {(entry.status === "expired" || entry.status === "skipped") && (
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

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-stone-100 px-3 py-1.5 text-[10px] text-stone-400 dark:border-stone-800">
        <span>{entry.slidesCount} slide{entry.slidesCount !== 1 ? "s" : ""}</span>
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
              : "—"}
        </span>
      </div>
    </div>
  );
}

// ── Filter tabs ──────────────────────────────────────────────────────────────

const STATUS_FILTERS = ["all", "queued", "scheduled", "rendering", "posted", "skipped", "expired"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const TYPE_FILTERS = ["all", "scholarship", "opportunity", "news", "histoire", "utility"] as const;
type TypeFilter = (typeof TYPE_FILTERS)[number];

// ── Main page ────────────────────────────────────────────────────────────────

export default function IGQueuePage() {
  const [entries, setEntries] = useState<IGQueueEntry[]>([]);
  const [counts, setCounts] = useState<IGQueueCounts | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<IGQueueEntry | null>(null);

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

  const performAction = useCallback(async (id: string, action: string) => {
    try {
      const res = await fetch("/api/admin/ig-queue", {
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

  const filtered = entries.filter((e) => {
    const statusMatch =
      statusFilter === "all"
        ? e.status !== "skipped"
        : (statusFilter === "scheduled"
          ? e.status === "scheduled" || e.status === "scheduled_ready_for_manual"
          : e.status === statusFilter);
    const typeMatch = typeFilter === "all" || e.igType === typeFilter;
    return statusMatch && typeMatch;
  });

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Instagram Queue</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Visual preview of the IG posting pipeline
          </p>
        </div>
        <button
          onClick={() => void loadData()}
          className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs text-stone-500 transition hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Counts */}
      {counts && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <CountCard label="Queued" value={counts.queued} color="bg-blue-50 dark:bg-blue-900/10" />
          <CountCard label="Scheduled" value={counts.scheduled} color="bg-yellow-50 dark:bg-yellow-900/10" />
          <CountCard label="Rendering" value={counts.rendering} color="bg-purple-50 dark:bg-purple-900/10" />
          <CountCard label="Posted" value={counts.posted} color="bg-green-50 dark:bg-green-900/10" />
          <CountCard label="Skipped" value={counts.skipped} color="bg-stone-50 dark:bg-stone-800/50" />
          <CountCard label="Expired" value={counts.expired} color="bg-red-50 dark:bg-red-900/10" />
        </div>
      )}

      {/* Status filter tabs */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((opt) => (
            <button
              key={opt}
              onClick={() => setStatusFilter(opt)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                statusFilter === opt
                  ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
              }`}
            >
              {opt === "all" ? "All" : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>

        {/* Type filter tabs */}
        <div className="flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((opt) => (
            <button
              key={opt}
              onClick={() => setTypeFilter(opt)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                typeFilter === opt
                  ? "bg-stone-700 text-white dark:bg-stone-300 dark:text-stone-900"
                  : "bg-stone-50 text-stone-500 hover:bg-stone-100 dark:bg-stone-800 dark:text-stone-400"
              }`}
            >
              {opt === "all" ? "All types" : `${TYPE_EMOJIS[opt] ?? ""} ${opt}`}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Loading */}
      {loading && <p className="text-sm text-stone-400">Loading…</p>}

      {/* Card grid */}
      {!loading && filtered.length === 0 && (
        <p className="text-sm text-stone-400">No items found.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <PostCard key={entry.id} entry={entry} onAction={performAction} onOpen={setSelectedEntry} />
          ))}
        </div>
      )}

      {selectedEntry && (
        <PostModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </section>
  );
}
