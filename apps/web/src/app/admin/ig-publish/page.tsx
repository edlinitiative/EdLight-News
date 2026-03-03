"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Copy,
  Check,
  Download,
  Send,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Clock,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface IGSlideData {
  heading: string;
  bullets: string[];
  footer: string | null;
}

interface IGMemePanel {
  text: string;
  emoji?: string;
}

interface IGMemeSlideData {
  template: string;
  panels: IGMemePanel[];
  topicLine?: string;
  tone: string;
}

interface IGPublishEntry {
  id: string;
  sourceContentId: string;
  igType: string;
  score: number;
  status: string;
  scheduledFor: string | null;
  caption: string | null;
  slides: IGSlideData[];
  slideUrls: string[];
  slideCount: number;
  memeSlide: IGMemeSlideData | null;
  dryRunPath: string | null;
  igPostId: string | null;
  reasons: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, { emoji: string; label: string; accent: string }> = {
  scholarship: { emoji: "🎓", label: "Bourse", accent: "bg-blue-500" },
  opportunity: { emoji: "🚀", label: "Opportunité", accent: "bg-emerald-500" },
  news: { emoji: "📰", label: "Actualité", accent: "bg-rose-500" },
  histoire: { emoji: "📜", label: "Histoire", accent: "bg-amber-500" },
  utility: { emoji: "💡", label: "Conseil", accent: "bg-violet-500" },
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  scheduled_ready_for_manual:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  rendering: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  posted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-stone-100 text-stone-600";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {status === "scheduled_ready_for_manual" ? "Ready to post" : status}
    </span>
  );
}

function formatDate(iso: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "America/Port-au-Prince",
    ...options,
  });
}

// ── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  entry,
  onMarkPosted,
}: {
  entry: IGPublishEntry;
  onMarkPosted: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(entry.status !== "posted");
  const [captionCopied, setCaptionCopied] = useState(false);
  const [posting, setPosting] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);

  const meta = TYPE_LABELS[entry.igType] ?? { emoji: "📄", label: entry.igType, accent: "bg-stone-500" };

  const copyCaption = async () => {
    if (!entry.caption) return;
    await navigator.clipboard.writeText(entry.caption);
    setCaptionCopied(true);
    setTimeout(() => setCaptionCopied(false), 2000);
  };

  const downloadSlide = (url: string, index: number) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entry.igType}_slide_${index + 1}.png`;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadAll = () => {
    entry.slideUrls.forEach((url, i) => {
      setTimeout(() => downloadSlide(url, i), i * 300);
    });
  };

  const handleMarkPosted = async () => {
    setPosting(true);
    try {
      await onMarkPosted(entry.id);
    } finally {
      setPosting(false);
    }
  };

  const isPosted = entry.status === "posted";

  return (
    <div
      className={`overflow-hidden rounded-xl border transition-shadow ${
        isPosted
          ? "border-green-200 bg-green-50/30 dark:border-green-900 dark:bg-green-950/20"
          : "border-stone-200 bg-white shadow-sm hover:shadow-md dark:border-stone-700 dark:bg-stone-900"
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        {/* Type accent bar */}
        <div className={`h-10 w-1 rounded-full ${meta.accent}`} />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="text-2xl">{meta.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{meta.label}</span>
              <StatusBadge status={entry.status} />
              <span className="text-xs tabular-nums text-stone-400">
                Score: {entry.score}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-stone-500">
              {entry.caption ? entry.caption.slice(0, 100) + "…" : "No caption"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {entry.scheduledFor && (
            <span className="hidden text-xs text-stone-400 sm:block">
              <Clock className="mr-1 inline h-3 w-3" />
              {formatDate(entry.scheduledFor, {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-stone-400">
            <ImageIcon className="h-3 w-3" />
            {entry.slideCount}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-stone-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-stone-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-stone-100 dark:border-stone-800">
          <div className="grid gap-6 p-5 lg:grid-cols-2">
            {/* Left: Slide preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                  Slides ({entry.slideCount})
                </h3>
                {entry.slideUrls.length > 0 && (
                  <button
                    onClick={downloadAll}
                    className="flex items-center gap-1 rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
                  >
                    <Download className="h-3 w-3" />
                    Tout télécharger
                  </button>
                )}
              </div>

              {/* Slide image carousel */}
              {entry.slideUrls.length > 0 ? (
                <div className="space-y-2">
                  {/* Main preview */}
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100 dark:border-stone-700 dark:bg-stone-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={entry.slideUrls[slideIndex]}
                      alt={`Slide ${slideIndex + 1}`}
                      className="h-full w-full object-contain"
                    />
                    <button
                      onClick={() => downloadSlide(entry.slideUrls[slideIndex]!, slideIndex)}
                      className="absolute bottom-2 right-2 rounded-md bg-black/60 p-1.5 text-white transition hover:bg-black/80"
                      title="Télécharger"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Thumbnail strip */}
                  {entry.slideUrls.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {entry.slideUrls.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setSlideIndex(i)}
                          className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition ${
                            slideIndex === i
                              ? "border-stone-900 dark:border-white"
                              : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Slide ${i + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-800/50">
                  <div className="text-center text-stone-400">
                    <ImageIcon className="mx-auto mb-2 h-8 w-8" />
                    <p className="text-xs">Images non disponibles</p>
                    <p className="mt-1 text-xs text-stone-300">
                      Les slides seront visibles après le rendu
                    </p>
                  </div>
                </div>
              )}

              {/* Slide content breakdown */}
              {entry.slides.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-stone-400">Contenu des slides</h4>
                  {entry.slides.map((slide, i) => (
                    <div
                      key={i}
                      className="rounded-md border border-stone-100 bg-stone-50/50 p-3 text-xs dark:border-stone-800 dark:bg-stone-800/30"
                    >
                      <p className="font-semibold text-stone-700 dark:text-stone-200">
                        Slide {i + 1}: {slide.heading}
                      </p>
                      <ul className="mt-1 space-y-0.5 text-stone-500 dark:text-stone-400">
                        {slide.bullets.map((b, j) => (
                          <li key={j}>• {b}</li>
                        ))}
                      </ul>
                      {slide.footer && (
                        <p className="mt-1 text-stone-400 italic">{slide.footer}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Meme slide info */}
              {entry.memeSlide && (
                <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 text-xs dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="font-semibold text-amber-700 dark:text-amber-300">
                    🎭 Meme slide ({entry.memeSlide.template})
                  </p>
                  {entry.memeSlide.topicLine && (
                    <p className="mt-1 text-amber-600 dark:text-amber-400">
                      {entry.memeSlide.topicLine}
                    </p>
                  )}
                  <div className="mt-1 space-y-0.5 text-amber-600 dark:text-amber-400">
                    {entry.memeSlide.panels.map((p, i) => (
                      <p key={i}>
                        {p.emoji ? `${p.emoji} ` : ""}
                        {p.text}
                      </p>
                    ))}
                  </div>
                  <p className="mt-1 text-amber-400">Tone: {entry.memeSlide.tone}</p>
                </div>
              )}
            </div>

            {/* Right: Caption + actions */}
            <div className="flex flex-col space-y-4">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                    Caption
                  </h3>
                  <button
                    onClick={copyCaption}
                    disabled={!entry.caption}
                    className="flex items-center gap-1 rounded-md bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:bg-stone-200 disabled:opacity-40 dark:bg-stone-800 dark:text-stone-300"
                  >
                    {captionCopied ? (
                      <>
                        <Check className="h-3 w-3 text-green-600" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copier
                      </>
                    )}
                  </button>
                </div>

                {entry.caption ? (
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800/50">
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-stone-700 dark:text-stone-300">
                      {entry.caption}
                    </pre>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-stone-300 p-4 text-center text-xs text-stone-400">
                    Aucune caption générée
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="space-y-1 rounded-lg border border-stone-100 bg-stone-50/50 p-3 text-xs dark:border-stone-800 dark:bg-stone-800/30">
                <div className="flex justify-between">
                  <span className="text-stone-400">ID</span>
                  <span className="font-mono text-stone-600 dark:text-stone-300">
                    {entry.id.slice(0, 12)}…
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Source</span>
                  <span className="font-mono text-stone-600 dark:text-stone-300">
                    {entry.sourceContentId.slice(0, 12)}…
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Créé</span>
                  <span className="text-stone-600 dark:text-stone-300">
                    {formatDate(entry.createdAt, {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {entry.igPostId && (
                  <div className="flex justify-between">
                    <span className="text-stone-400">IG Post ID</span>
                    <span className="font-mono text-green-600">{entry.igPostId}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {!isPosted && (
                <div className="flex gap-2">
                  <button
                    onClick={handleMarkPosted}
                    disabled={posting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:opacity-60"
                  >
                    {posting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        En cours…
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Marquer comme publié
                      </>
                    )}
                  </button>
                </div>
              )}

              {isPosted && (
                <div className="flex items-center justify-center gap-2 rounded-lg bg-green-50 py-2.5 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Publié
                  {entry.updatedAt && (
                    <span className="text-xs text-green-500">
                      — {formatDate(entry.updatedAt, {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function IGPublishPage() {
  const [readyPosts, setReadyPosts] = useState<IGPublishEntry[]>([]);
  const [postedPosts, setPostedPosts] = useState<IGPublishEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"ready" | "posted">("ready");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ig-publish");
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to load");
      setReadyPosts(data.ready as IGPublishEntry[]);
      setPostedPosts(data.posted as IGPublishEntry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const markAsPosted = async (id: string) => {
    try {
      const res = await fetch("/api/admin/ig-publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Failed to update");

      // Move the item from ready → posted
      setReadyPosts((prev) => prev.filter((p) => p.id !== id));
      setPostedPosts((prev) => {
        const item = readyPosts.find((p) => p.id === id);
        if (!item) return prev;
        return [
          { ...item, status: "posted", updatedAt: new Date().toISOString() },
          ...prev,
        ];
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to mark as posted");
    }
  };

  const readyCount = readyPosts.length;
  const postedCount = postedPosts.length;

  return (
    <section className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">📱 Publier sur Instagram</h1>
        <p className="mt-1 text-sm text-stone-500">
          Visualisez les posts prêts, téléchargez les images, copiez la caption,
          puis marquez-les comme publiés.
        </p>
      </div>

      {/* Quick workflow */}
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
          Workflow
        </h2>
        <ol className="mt-2 grid gap-2 text-xs text-indigo-700 sm:grid-cols-4 dark:text-indigo-300">
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200">
              1
            </span>
            Téléchargez toutes les slides
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200">
              2
            </span>
            Copiez la caption
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200">
              3
            </span>
            Publiez sur Instagram
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-200 text-xs font-bold text-indigo-700 dark:bg-indigo-800 dark:text-indigo-200">
              4
            </span>
            Marquez comme publié ici
          </li>
        </ol>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("ready")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            tab === "ready"
              ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
          }`}
        >
          À publier
          {readyCount > 0 && (
            <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs text-white">
              {readyCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("posted")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            tab === "posted"
              ? "bg-stone-900 text-white dark:bg-white dark:text-stone-900"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
          }`}
        >
          Publiés
          {postedCount > 0 && (
            <span className="ml-1.5 text-xs text-stone-400">({postedCount})</span>
          )}
        </button>
        <button
          onClick={() => void loadData()}
          className="ml-auto flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Actualiser
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
        </div>
      )}

      {/* Content */}
      {!loading && (
        <div className="space-y-4">
          {tab === "ready" && (
            <>
              {readyPosts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stone-300 py-12 text-center dark:border-stone-700">
                  <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-400" />
                  <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
                    Tous les posts ont été publiés !
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    Les prochains posts apparaîtront après le prochain cycle du pipeline.
                  </p>
                </div>
              ) : (
                readyPosts.map((entry) => (
                  <PostCard
                    key={entry.id}
                    entry={entry}
                    onMarkPosted={markAsPosted}
                  />
                ))
              )}
            </>
          )}

          {tab === "posted" && (
            <>
              {postedPosts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stone-300 py-12 text-center dark:border-stone-700">
                  <p className="text-sm text-stone-400">
                    Aucun post publié récemment.
                  </p>
                </div>
              ) : (
                postedPosts.map((entry) => (
                  <PostCard
                    key={entry.id}
                    entry={entry}
                    onMarkPosted={markAsPosted}
                  />
                ))
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
