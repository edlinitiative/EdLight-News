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
import { normalizePayloadForPublishing, reviewSlides } from "../review.js";

/** Options controlling IG formatting behaviour. */
export interface FormatIGOptions {
  /** Bilingual text overrides from content_versions */
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
}

const FORMATTERS: Record<IGPostType, (item: Item, bi?: BilingualText) => IGFormattedPayload> = {
  scholarship: buildScholarshipCarousel,
  opportunity: buildOpportunityCarousel,
  news: buildNewsCarousel,
  histoire: buildHistoireCarousel,
  utility: buildUtilityCarousel,
  taux: buildUtilityCarousel, // Taux posts are built by buildIgTaux job, not via formatForIG
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

  // Handle image safety
  const igImageSafe = options.igImageSafe ?? true;

  if (!igImageSafe && payload.slides.length > 0) {
    // Source flagged as unsafe — strip ALL slides' images
    for (const slide of payload.slides) {
      delete slide.backgroundImage;
    }
    // Optionally restore cover with a free-licensed alternative
    if (options.overrideImageUrl) {
      payload.slides[0]!.backgroundImage = options.overrideImageUrl;
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
      return normalizePayloadForPublishing(reviewed.payload);
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
};
