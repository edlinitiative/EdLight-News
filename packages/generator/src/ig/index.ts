/**
 * @edlight-news/generator – Instagram pipeline
 *
 * Selection logic + formatting templates for curated IG posting.
 */

export { decideIG, applyDedupePenalty } from "./selection.js";
export { formatForIG } from "./formatters/index.js";
export type { BilingualText } from "./formatters/index.js";
export {
  buildScholarshipCarousel,
  buildOpportunityCarousel,
  buildNewsCarousel,
  buildHistoireCarousel,
  buildUtilityCarousel,
} from "./formatters/index.js";
