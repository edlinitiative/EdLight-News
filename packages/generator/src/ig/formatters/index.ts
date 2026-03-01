/**
 * IG Formatters barrel – selects the correct formatter by IGPostType.
 */

import type { Item, IGPostType, IGFormattedPayload } from "@edlight-news/types";
import { buildScholarshipCarousel } from "./scholarship.js";
import { buildOpportunityCarousel } from "./opportunity.js";
import { buildNewsCarousel } from "./news.js";
import { buildHistoireCarousel } from "./histoire.js";
import { buildUtilityCarousel } from "./utility.js";

const FORMATTERS: Record<IGPostType, (item: Item) => IGFormattedPayload> = {
  scholarship: buildScholarshipCarousel,
  opportunity: buildOpportunityCarousel,
  news: buildNewsCarousel,
  histoire: buildHistoireCarousel,
  utility: buildUtilityCarousel,
};

/**
 * Format an Item into IG carousel slides + caption based on its IG type.
 */
export function formatForIG(igType: IGPostType, item: Item): IGFormattedPayload {
  const formatter = FORMATTERS[igType];
  return formatter(item);
}

export {
  buildScholarshipCarousel,
  buildOpportunityCarousel,
  buildNewsCarousel,
  buildHistoireCarousel,
  buildUtilityCarousel,
};
