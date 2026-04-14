/**
 * Weighted multi-factor image scoring.
 *
 * Score = relevance (35%) + trust (20%) + recency (15%) + quality (15%) + licensing (15%)
 *
 * If licensing safety fails, score collapses to zero for auto-posting.
 */

import type { ImageCandidate, LicenseStatus, ImageSourceTier, StoryType } from "./imageTypes.js";

// ── Score weights ──────────────────────────────────────────────────────────

const W = {
  relevance: 35,
  trust: 20,
  recency: 15,
  quality: 15,
  licensing: 15,
} as const;

// ── Relevance scoring ──────────────────────────────────────────────────────

/**
 * Score how relevant the image is to the query/story.
 * Uses term overlap between search query and image metadata.
 */
export function scoreRelevance(
  query: string,
  imageMetadata: string,
  storyType: StoryType,
  entityMatch: boolean,
): number {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  if (terms.length === 0) return 0;

  const haystack = imageMetadata.toLowerCase();
  const matches = terms.filter((t) => haystack.includes(t)).length;
  const termOverlap = matches / terms.length; // 0-1

  let score = termOverlap * 25; // max 25

  // Entity match bonus (person name found in image metadata)
  if (entityMatch) score += 8;

  // Story type alignment bonus
  if (storyType === "person" && entityMatch) score += 2;

  return Math.min(score, W.relevance);
}

// ── Trust scoring ──────────────────────────────────────────────────────────

const TIER_TRUST: Record<ImageSourceTier, number> = {
  official: 20,
  editorial: 19, // Reuters/AP/Getty — highest editorial quality
  archive: 14,
  stock: 8,
  fallback: 2,
};

/**
 * Score trust based on source tier + optional official source boost.
 */
export function scoreTrust(tier: ImageSourceTier, officialBoost = 0): number {
  return Math.min(TIER_TRUST[tier] + officialBoost, W.trust);
}

// ── Recency scoring ────────────────────────────────────────────────────────

/**
 * Score based on how recent the image is.
 * Recent images score higher for event-led stories.
 */
export function scoreRecency(captureDate?: string, storyType?: StoryType): number {
  if (!captureDate) {
    // No date known — moderate score (don't penalize archives)
    return storyType === "event" ? 3 : 8;
  }

  const ageMs = Date.now() - new Date(captureDate).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays < 1) return 15;       // Today
  if (ageDays < 7) return 13;       // This week
  if (ageDays < 30) return 11;      // This month
  if (ageDays < 365) return 8;      // This year
  if (ageDays < 365 * 5) return 5;  // Recent years
  return 3;                          // Old (but may be perfect for history)
}

// ── Quality scoring ────────────────────────────────────────────────────────

/** Minimum width for IG (1080px slides) */
const MIN_WIDTH = 1200;

/**
 * Score image quality based on dimensions and IG suitability.
 */
export function scoreQuality(width: number, height: number): number {
  let s = 0;

  // Resolution
  if (width >= 3200) s += 8;
  else if (width >= 2400) s += 6;
  else if (width >= 1800) s += 5;
  else if (width >= MIN_WIDTH) s += 3;
  else if (width >= 800) s += 1;
  else return 0; // Too small

  // Portrait or square orientation bonus (4:5 IG format)
  const ratio = width / Math.max(height, 1);
  if (ratio <= 1.0) s += 4;      // Portrait — perfect for IG
  else if (ratio <= 1.2) s += 2;  // Nearly square — good
  else if (ratio > 2.1) s -= 2;   // Ultra-wide — bad crop

  // Ultra-sharp bonus
  if (width >= 2400 && height >= 2400) s += 3;

  return Math.min(Math.max(s, 0), W.quality);
}

// ── Licensing scoring ──────────────────────────────────────────────────────

const LICENSE_SCORES: Record<LicenseStatus, number> = {
  safe_public_domain: 15,
  official_reusable: 14,
  licensed_editorial: 14,       // Reuters/AP/Getty — best editorial quality
  cc_attribution: 12,
  editorial_fair_use: 11,       // News/editorial images via web search — fair use for commentary
  unknown_do_not_publish: 0,    // ZERO — blocks auto-publishing
};

/**
 * Score licensing safety. Returns 0 for unsafe licenses (blocks auto-post).
 */
export function scoreLicensing(status: LicenseStatus): number {
  return LICENSE_SCORES[status];
}

// ── Composite score ────────────────────────────────────────────────────────

export interface ScoreInputs {
  query: string;
  imageMetadata: string;
  storyType: StoryType;
  entityMatch: boolean;
  tier: ImageSourceTier;
  officialBoost?: number;
  captureDate?: string;
  width: number;
  height: number;
  licenseStatus: LicenseStatus;
}

/**
 * Compute the composite weighted score for an image candidate.
 *
 * Returns 0-100. If licensing is unsafe, score collapses to zero.
 */
export function computeImageScore(inputs: ScoreInputs): {
  total: number;
  breakdown: ImageCandidate["scoreBreakdown"];
} {
  const relevance = scoreRelevance(inputs.query, inputs.imageMetadata, inputs.storyType, inputs.entityMatch);
  const trust = scoreTrust(inputs.tier, inputs.officialBoost);
  const recency = scoreRecency(inputs.captureDate, inputs.storyType);
  const quality = scoreQuality(inputs.width, inputs.height);
  const licensing = scoreLicensing(inputs.licenseStatus);

  // Licensing gate: only hard-block truly unknown sources
  const total = licensing === 0 ? 0 : (relevance + trust + recency + quality + licensing);

  return {
    total,
    breakdown: { relevance, trust, recency, quality, licensing },
  };
}
