/**
 * @edlight-news/generator – Instagram pipeline
 *
 * Selection logic + formatting templates + reviewer for curated IG posting.
 */

export { decideIG, applyDedupePenalty } from "./selection.js";
export { formatForIG } from "./formatters/index.js";
export type { BilingualText, FormatIGOptions } from "./formatters/index.js";
export { buildDailySummaryStory } from "./formatters/story.js";
export type { StoryItemInput, StoryTauxInput, StoryFactsInput } from "./formatters/story.js";
export { reviewSlides, needsReview, countEmojis } from "./review.js";
export type { ReviewResult } from "./review.js";
export {
  buildScholarshipCarousel,
  buildOpportunityCarousel,
  buildNewsCarousel,
  buildHistoireCarousel,
  buildUtilityCarousel,
} from "./formatters/index.js";
