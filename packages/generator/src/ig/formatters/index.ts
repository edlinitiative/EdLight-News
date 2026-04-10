/**
 * IG Formatters barrel – selects the correct formatter by IGPostType.
 *
 * After formatting, runs the two-pass reviewer LLM to fix:
 *  - English leaks → translate to French
 *  - Narrative incoherence across slides
 *  - Emoji excess (especially on histoire)
 *  - Truncated first-slide headlines
 */

import type { Item, IGPostType, IGFormattedPayload } from "@edlight-news/types";
import type { BilingualText } from "./helpers.js";
import { buildScholarshipCarousel } from "./scholarship.js";
import { buildOpportunityCarousel } from "./opportunity.js";
import { buildNewsCarousel } from "./news.js";
import { buildHistoireCarousel } from "./histoire.js";
import { buildUtilityCarousel } from "./utility.js";
import { buildBreakingNewsPost } from "./breaking.js";
import { buildStatCard } from "./stat.js";
import { normalizePayloadForPublishing, reviewSlides } from "../review.js";
import { enforceBulletBudgets } from "./helpers.js";

const MIN_IG_BACKGROUND_SHORT_SIDE = 1080;
const MAX_IG_BACKGROUND_ASPECT_RATIO = 2.1;

// ── PRD §8.6: Stock photo host blocklist ─────────────────────────────────────
// Images served from these CDNs are typically generic/cheesy stock photos that
// fail the editorial bar. Returning false lets the pipeline substitute a Gemini-
// generated contextual image or a free-licensed Wikimedia alternative instead.
const STOCK_PHOTO_HOSTS = new Set([
  "shutterstock.com", "gettyimages.com", "istockphoto.com",
  "depositphotos.com", "dreamstime.com", "123rf.com",
  "bigstockphoto.com", "fotolia.com", "alamy.com",
  "stock.adobe.com", "pond5.com", "canstockphoto.com",
  "stocksy.com", "pexels.com",
]);

function isStockPhotoUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return STOCK_PHOTO_HOSTS.has(host) ||
      [...STOCK_PHOTO_HOSTS].some((s) => host.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

/**
 * Returns true when the item's existing `imageUrl` is sharp enough to be used
 * as a full-bleed IG background without visibly stretching.
 *
 * Web/article images are often fine for cards but too soft for 4:5 IG renders,
 * especially legacy branded cards (1200×630). When this returns false, the IG
 * pipeline strips the background so downstream jobs can generate a sharper
 * editorial/AI replacement instead of publishing a blurry slide.
 */
export function isItemImageUsableForIG(item: Item): boolean {
  if (!item.imageUrl) return false;

  // Block stock photo CDNs — generic imagery fails PRD §8.6 editorial bar
  if (isStockPhotoUrl(item.imageUrl)) return false;

  const width = item.imageMeta?.width;
  const height = item.imageMeta?.height;

  // Legacy branded cards are landscape web assets and should not be stretched
  // to fill portrait IG slides unless we explicitly know they were rendered at
  // portrait-safe dimensions.
  if (item.imageSource === "branded" && (!width || !height)) {
    return false;
  }

  if (!width || !height) return true;

  if (Math.min(width, height) < MIN_IG_BACKGROUND_SHORT_SIDE) {
    return false;
  }

  if (width / Math.max(height, 1) > MAX_IG_BACKGROUND_ASPECT_RATIO) {
    return false;
  }

  return true;
}

/**
 * Options controlling IG formatting behaviour.
 * Maps to PRD §13 structured inputs — callers should provide as many fields
 * as they know rather than relying on formatter defaults.
 */
export interface FormatIGOptions {
  /** Bilingual text overrides from content_versions (FR + HT). */
  bi?: BilingualText;
  /**
   * Whether the source's publisher images are safe to embed in IG.
   * When false, the cover slide's backgroundImage is stripped so the
   * renderer uses the branded gradient style instead.
   * Defaults to true.
   */
  igImageSafe?: boolean;
  /**
   * Override image URL (e.g. a free-licensed Commons image found for
   * items whose publisher image is unsafe).
   */
  overrideImageUrl?: string;
  /**
   * Hard cap on total slides in the final payload (PRD §13 — number of slides).
   * CTA slides are preserved regardless of the cap; content slides are trimmed.
   * When unset, each formatter applies its own type-specific default cap.
   */
  maxSlides?: number;
  /**
   * Audience targeting hint (PRD §13 — audience type).
   * Influences hashtag selection and tone; defaults to "haiti".
   * - "haiti"         → local + diaspora audience (default)
   * - "diaspora"      → Haitian diaspora outside Haiti
   * - "international" → global francophone audience
   */
  audienceHint?: "haiti" | "diaspora" | "international";
}

const FORMATTERS: Record<IGPostType, (item: Item, bi?: BilingualText) => IGFormattedPayload> = {
  scholarship: buildScholarshipCarousel,
  opportunity: buildOpportunityCarousel,
  news: buildNewsCarousel,
  histoire: buildHistoireCarousel,
  utility: buildUtilityCarousel,
  taux: buildUtilityCarousel,    // Taux posts are built by buildIgTaux job, not via formatForIG
  breaking: buildBreakingNewsPost, // T1 single-slide — auto-routed for thin news
  stat: buildStatCard,             // T6 single-slide — manually triggered
};

/**
 * Format an Item into IG carousel slides + caption based on its IG type.
 *
 * When bilingual text is provided, formatters use fr/ht content_versions
 * instead of the raw (potentially English) item fields.
 *
 * When igImageSafe is false, the cover slide's backgroundImage is replaced
 * with the overrideImageUrl (free-licensed Commons image) or stripped entirely
 * so the renderer falls back to the branded gradient.
 */
export async function formatForIG(
  igType: IGPostType,
  item: Item,
  opts?: FormatIGOptions | BilingualText,
): Promise<IGFormattedPayload> {
  // Backwards compat: opts can be a bare BilingualText (old call sites)
  const options: FormatIGOptions =
    opts && "frTitle" in opts ? { bi: opts } : (opts as FormatIGOptions) ?? {};

  const formatter = FORMATTERS[igType];
  const payload = formatter(item, options.bi);

  // ── PRD §13: apply per-request slide count cap ───────────────────────────
  // CTA slides (curated landmark images) are always preserved at the end;
  // only content slides are trimmed.
  if (options.maxSlides && payload.slides.length > options.maxSlides) {
    const ctaSlides = payload.slides.filter((s) => s.layout === "cta");
    const contentSlides = payload.slides.filter((s) => s.layout !== "cta");
    const keepCount = Math.max(1, options.maxSlides - ctaSlides.length);
    payload.slides = [...contentSlides.slice(0, keepCount), ...ctaSlides];
  }

  // Handle image safety
  const igImageSafe = (options.igImageSafe ?? true) && isItemImageUsableForIG(item);

  if (!igImageSafe && payload.slides.length > 0) {
    // Source flagged as unsafe — strip ALL slides' images
    for (const slide of payload.slides) {
      delete slide.backgroundImage;
    }
    // Restore all slides with the free-licensed alternative so every slide
    // in the carousel uses the same image (avoids cover ≠ inner mismatch).
    if (options.overrideImageUrl) {
      for (const slide of payload.slides) {
        slide.backgroundImage = options.overrideImageUrl;
      }
    }
  }
  // Note: we no longer strip inner-slide images for scholarship/opportunity.
  // The per-type overlay system (OVERLAY_MEDIUM) in the renderer is now strong
  // enough to keep text readable over publisher images on all slides.

  // ── Two-pass reviewer: fix English leaks, narrative coherence, emoji limits ──
  // Non-blocking: if the reviewer fails, we return the original payload.
  try {
    const reviewed = await reviewSlides(payload, igType, item);
    if (reviewed.corrected) {
      console.log(`[formatForIG] Reviewer corrected ${igType} post: ${reviewed.corrections.join("; ")}`);
      return normalizePayloadForPublishing(enforceBulletBudgets(reviewed.payload));
    }
  } catch (err) {
    console.warn(`[formatForIG] Reviewer error (non-fatal):`, err instanceof Error ? err.message : err);
  }

  return normalizePayloadForPublishing(payload);
}

export type { BilingualText } from "./helpers.js";

export {
  buildScholarshipCarousel,
  buildOpportunityCarousel,
  buildNewsCarousel,
  buildHistoireCarousel,
  buildUtilityCarousel,
  buildBreakingNewsPost,
  buildStatCard,
};
