/**
 * Format-driven Reel types (v2 pipeline).
 *
 * The v1 pipeline classified content by `ReelTopic` (scholarship, news, …)
 * and chose a visual `ReelTemplate`. v2 adds an EDITORIAL layer on top:
 *
 *   ReelFormat = the story type the human reviewer will recognize
 *     "opportunity_alert" / "haiti_explainer" / "weekly_opportunity_roundup"
 *
 *   A storyboard (ReelScene[]) captures the spoken voiceover line-by-line
 *   plus the matching visual treatment for each beat, so the script is
 *   short, mobile-first, and not a wall of read-aloud paragraph text.
 *
 * The v1 ReelTopic/ReelTemplate are kept for back-compat: every v2 format
 * still maps onto a v1 topic + template so the existing Remotion render
 * chain runs unchanged. The new fields are stored alongside on the
 * `reels_pending_review` document for reviewer context and quality audit.
 */

/** Editorial format the Reel belongs to (drives prompt + storyboard shape). */
export type ReelFormat =
  | "opportunity_alert"
  | "haiti_explainer"
  | "weekly_opportunity_roundup";

/**
 * Full Reel lifecycle (v2). Superset of the v1 status union — older docs
 * with `pending` / `approved` / `posted` / `rejected` remain valid.
 */
export type ReelStatusV2 =
  | "draft"
  | "rendering"
  | "pending_review"
  | "sent_to_slack"
  | "approved"
  | "rejected"
  | "needs_edit"
  | "posted"
  | "failed"
  // legacy v1 aliases:
  | "pending";

/** Languages Sandra supports. Reuses the existing pipeline language set. */
export type ReelLanguageV2 = "fr" | "ht" | "en";

/** Visual treatments a single scene can request. */
export type ReelSceneVisualType =
  | "animated_headline"
  | "image_card"
  | "deadline_card"
  | "checklist"
  | "map"
  | "logo_card"
  | "quote_card"
  | "brand_close"
  | "b_roll"
  | "roundup_item";

export interface ReelScene {
  id: string;
  startSec: number;
  endSec: number;
  /** Spoken line for this scene. SHORT — ideally ≤ 12 words. */
  voiceover: string;
  /** Short on-screen overlay text. Mobile-safe — ≤ 60 chars recommended. */
  onScreenText: string;
  visualType: ReelSceneVisualType;
  /** Keywords/phrases the asset collector can search for. */
  assetHints?: string[];
  /** Resolved final asset URLs (filled by collectReelAssets). */
  assetUrls?: string[];
}

export interface ReelQualityScore {
  /** Aggregate 0..100. */
  total: number;
  hookStrength: number;
  scriptClarity: number;
  visualRelevance: number;
  voiceNaturalness: number;
  captionReadability: number;
  brandConsistency: number;
  durationFit: number;
  mobileSafeArea: number;
  /** Human-readable per-axis warnings ("hook too long", "scene 3 has no asset"). */
  notes: string[];
  /** True when `total >= REEL_QUALITY_PASS_THRESHOLD` AND no hard-fail notes. */
  passed: boolean;
}

/** Threshold above which a Reel is considered review-ready. */
export const REEL_QUALITY_PASS_THRESHOLD = 70;

/**
 * The full v2 Reel package handed to Slack for review.
 *
 * NOT all of these fields are mirrored on the Firestore doc — `videoUrl`,
 * `thumbnailUrl`, `slackMessageTs`, `status`, etc. are filled by the
 * worker after upload, while `storyboard`, `qualityScore`, `format`,
 * `hook`, `hashtags`, `sourceItemIds` are persisted alongside the v1
 * `ReelsPendingItem` fields.
 */
export interface GeneratedReel {
  id: string;
  /** Primary driving item (for explainers and single-opportunity alerts). */
  sourceItemId?: string;
  /** Multi-source list (used by the weekly roundup). */
  sourceItemIds?: string[];
  format: ReelFormat;
  language: ReelLanguageV2;
  title: string;
  /** First scene's opening line — duplicated for quick reviewer scanning. */
  hook: string;
  /** Concatenated voiceover used by TTS. */
  script: string;
  storyboard: ReelScene[];
  caption: string;
  hashtags: string[];
  videoUrl?: string;
  thumbnailUrl?: string;
  durationSec?: number;
  qualityScore?: ReelQualityScore;
  status: ReelStatusV2;
  slackMessageTs?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Format → existing topic/template mapping ──────────────────────────────
//
// The v1 render chain (Remotion templates + Sandra TTS) is reused by
// mapping every v2 format onto a v1 topic + a preferred template. The
// reviewer sees the v2 format on the Slack card; the renderer sees only
// the v1 topic.

import type { ReelTopic, ReelTemplate } from "../types.js";

export const FORMAT_TO_TOPIC: Record<ReelFormat, ReelTopic> = {
  opportunity_alert: "opportunity",
  haiti_explainer: "news",
  weekly_opportunity_roundup: "opportunity",
};

/**
 * Preferred render template per format. The renderer will fall back if a
 * template's required fields can't be derived from the storyboard.
 */
export const FORMAT_TO_TEMPLATE: Record<ReelFormat, ReelTemplate> = {
  opportunity_alert: "HeadlinePhoto",
  haiti_explainer: "NumberedPoints",
  weekly_opportunity_roundup: "NumberedPoints",
};

/** Per-format target duration window (seconds). Hard cap 45s globally. */
export const FORMAT_DURATION: Record<
  ReelFormat,
  { min: number; max: number; target: number }
> = {
  opportunity_alert: { min: 12, max: 22, target: 18 },
  haiti_explainer: { min: 20, max: 35, target: 28 },
  weekly_opportunity_roundup: { min: 25, max: 45, target: 38 },
};

export const REEL_HARD_DURATION_CAP_SEC = 45;
