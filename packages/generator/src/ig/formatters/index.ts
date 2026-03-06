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

const FORMATTERS: Record<IGPostType, (item: Item, bi?: BilingualText) => IGFormattedPayload> = {
  scholarship: buildScholarshipCarousel,
  opportunity: buildOpportunityCarousel,
  news: buildNewsCarousel,
  histoire: buildHistoireCarousel,
  utility: buildUtilityCarousel,
};

/**
 * Format an Item into IG carousel slides + caption based on its IG type.
 * When bilingual text is provided, formatters use fr/ht content_versions
 * instead of the raw (potentially English) item fields.
 */
export function formatForIG(igType: IGPostType, item: Item, bi?: BilingualText): IGFormattedPayload {
  const formatter = FORMATTERS[igType];
  return formatter(item, bi);
}

export type { BilingualText } from "./helpers.js";

export {
  buildScholarshipCarousel,
  buildOpportunityCarousel,
  buildNewsCarousel,
  buildHistoireCarousel,
  buildUtilityCarousel,
};
