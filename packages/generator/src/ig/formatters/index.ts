/**
 * IG Formatters barrel – selects the correct formatter by IGPostType.
 */

import type { Item, IGPostType, IGFormattedPayload } from "@edlight-news/types";
import type { BilingualText } from "./helpers.js";
import { buildScholarshipCarousel } from "./scholarship.js";
import { buildOpportunityCarousel } from "./opportunity.js";
import { buildNewsCarousel } from "./news.js";
import { buildHistoireCarousel } from "./histoire.js";
import { buildUtilityCarousel } from "./utility.js";

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
export function formatForIG(
  igType: IGPostType,
  item: Item,
  opts?: FormatIGOptions | BilingualText,
): IGFormattedPayload {
  // Backwards compat: opts can be a bare BilingualText (old call sites)
  const options: FormatIGOptions =
    opts && "frTitle" in opts ? { bi: opts } : (opts as FormatIGOptions) ?? {};

  const formatter = FORMATTERS[igType];
  const payload = formatter(item, options.bi);

  // Handle image safety for the cover slide
  const igImageSafe = options.igImageSafe ?? true;
  if (!igImageSafe && payload.slides.length > 0) {
    const cover = payload.slides[0]!;
    if (options.overrideImageUrl) {
      // Use the free-licensed alternative image
      cover.backgroundImage = options.overrideImageUrl;
    } else {
      // No alternative found — strip publisher image, renderer uses branded gradient
      delete cover.backgroundImage;
    }
  }

  return payload;
}

export type { BilingualText } from "./helpers.js";

export {
  buildScholarshipCarousel,
  buildOpportunityCarousel,
  buildNewsCarousel,
  buildHistoireCarousel,
  buildUtilityCarousel,
};
