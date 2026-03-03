/**
 * IG Formatters barrel – selects the correct formatter by IGPostType.
 * Optionally attaches a Litquidity-style meme slide for virality.
 */

import type { Item, IGPostType, IGFormattedPayload } from "@edlight-news/types";
import { buildScholarshipCarousel } from "./scholarship.js";
import { buildOpportunityCarousel } from "./opportunity.js";
import { buildNewsCarousel } from "./news.js";
import { buildHistoireCarousel } from "./histoire.js";
import { buildUtilityCarousel } from "./utility.js";
import { generateMemeSlide, isMemeWorthy } from "../meme.js";

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

/**
 * Format an Item into IG carousel slides + caption, then generate
 * a meme slide if the article is meme-worthy.
 *
 * This is the recommended entry point for the full IG pipeline.
 * Falls back gracefully: if meme generation fails, returns the
 * payload without a meme slide (no error thrown).
 */
export async function formatForIGWithMeme(
  igType: IGPostType,
  item: Item,
): Promise<IGFormattedPayload> {
  const payload = formatForIG(igType, item);

  // Only generate memes for eligible content
  if (!isMemeWorthy(item, igType)) return payload;

  const result = await generateMemeSlide(item, igType);
  if (result.success) {
    return { ...payload, memeSlide: result.meme };
  }

  // Log but don't fail — memes are a bonus, not a requirement
  console.warn(`[ig-meme] Skipped meme for ${item.id}: ${result.error}`);
  return payload;
}

export {
  buildScholarshipCarousel,
  buildOpportunityCarousel,
  buildNewsCarousel,
  buildHistoireCarousel,
  buildUtilityCarousel,
};
