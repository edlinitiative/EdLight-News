/**
 * Shared Reels types — used by every module in this package and exported
 * to the worker / web app for Firestore typing and admin dashboards.
 */

/** All topics the Reels pipeline knows how to render. */
export type ReelTopic =
  | "scholarship"
  | "opportunity"
  | "taux"
  | "news"
  | "histoire"
  | "fact"
  | "education";

/** All visual templates the Reels pipeline can render. */
export type ReelTemplate =
  | "BigStatistic"
  | "PullQuote"
  | "HeadlinePhoto"
  | "NumberedPoints";

/** Language Sandra speaks the Reel in — matches the source item. */
export type ReelLanguage = "fr" | "ht" | "en";

/** Status flow for a queued Reel. */
export type ReelStatus = "pending" | "approved" | "posted" | "rejected";

/**
 * Insights metrics fetched from IG Graph API per posted Reel.
 *
 * `watchCompletionRate` is computed locally as
 * `min(avgWatchTimeSec / durationSec, 1.0)` — IG does not return it directly.
 */
export interface ReelMetrics {
  plays?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  totalInteractions?: number;
  avgWatchTimeSec?: number;
  totalWatchTimeSec?: number;
  /** Local computation: min(avgWatchTimeSec / durationSec, 1.0). */
  completionRate?: number;
  /** ISO string — set in repo helpers, not in the worker. */
  lastSyncedAtISO?: string;
}

/**
 * Cost breakdown logged per generation so the daily ceiling can be enforced.
 * All in USD. Render compute is an estimate based on duration.
 */
export interface ReelCostBreakdown {
  scriptUsd: number;
  voiceUsd: number;
  transcriptionUsd: number;
  footageUsd: number;
  renderUsd: number;
  totalUsd: number;
}

/**
 * What `buildReel()` returns to the queue builder. The queue builder is
 * responsible for uploading the MP4 + writing the Firestore doc.
 *
 * This is a richer "in-flight" artifact than what eventually lands in
 * Firestore (`ReelsPendingItem`). Mapping happens in the worker job.
 */
export interface ReelArtifact {
  id: string;
  topic: ReelTopic;
  template: ReelTemplate;
  status: "pending_review";
  language: ReelLanguage;
  sourceItemId: string;
  sourceItemTitle: string;
  sourceUrl?: string;
  /** Full script object (voiceover, hook, caption, hashtags, …). */
  script: {
    voiceover: string;
    caption: string;
    hashtags: string[];
    hook?: string;
    hero?: string;
    context?: string;
    quote?: string;
    attribution?: string;
    headline?: string;
    framing?: string;
    points?: string[];
    sourceLabel?: string;
  };
  /** Whisper-aligned caption words. */
  captionWords: Array<{ word: string; start: number; end: number }>;
  /** Stock clip provenance for credits. */
  clips: Array<{
    url: string;
    kind: string;
    provider: string;
    credit?: string;
    sourceUrl?: string;
  }>;
  durationSec: number;
  videoBytes: number;
  voiceTier: string;
  voiceVoice: string;
  cost: ReelCostBreakdown;
  metrics: ReelMetrics;
  timings: { scriptMs: number; totalMs: number };
  createdAt: string;
  /** Filled in by the worker after uploading the MP4 to Cloud Storage. */
  videoUrl?: string;
  /** First-pass IG caption draft (pre-human edit). */
  captionDraft: string;
}
