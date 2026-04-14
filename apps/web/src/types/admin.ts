/**
 * Shared types for the admin section.
 * Used by both page components and API route handlers.
 */

import type { SlideData } from "@/components/IGSlidePreview";

// ── Dashboard ────────────────────────────────────────────────────────────────

export interface AdminStats {
  items: { total: number; withImages: number };
  contentVersions: { total: number; published: number; draft: number };
  sources: { active: number };
}

export interface TickResult {
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

// ── IG Queue ─────────────────────────────────────────────────────────────────

export interface IGQueueEntry {
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
  /** Which renderer produced the assets. Null for posts rendered before ig-engine. */
  renderedBy: "ig-engine" | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface IGQueueCounts {
  queued: number;
  scheduled: number;
  posted: number;
  skipped: number;
  rendering: number;
  expired: number;
  totalDocs: number;
}

// ── IG Publish ───────────────────────────────────────────────────────────────

export interface IGSlideData {
  heading: string;
  bullets: string[];
  footer: string | null;
}

export interface IGPublishEntry {
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
  dryRunPath: string | null;
  igPostId: string | null;
  /** Which renderer produced the assets. Null for posts rendered before ig-engine. */
  renderedBy: "ig-engine" | null;
  reasons: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

// ── WA Queue ─────────────────────────────────────────────────────────────────

export interface WAQueueEntry {
  id: string;
  sourceContentId: string;
  score: number;
  status: string;
  scheduledFor: string | null;
  reasons: string[];
  text: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  waMessageId: string | null;
  sendRetries: number;
  error: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WAQueueCounts {
  queued: number;
  scheduled: number;
  sending: number;
  sent: number;
  failed: number;
  skipped: number;
  totalDocs: number;
}
