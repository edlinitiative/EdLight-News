/**
 * @edlight-news/generator – Instagram pipeline
 *
 * Selection logic + formatting templates + reviewer for curated IG posting.
 */

export { decideIG, applyDedupePenalty } from "./selection.js";
export { formatForIG, isItemImageUsableForIG } from "./formatters/index.js";
export type { BilingualText, FormatIGOptions } from "./formatters/index.js";
export { buildDailySummaryStory, buildStorySlideForPost } from "./formatters/story.js";
export type {
  StoryItemInput,
  StoryTauxInput,
  StoryFactsInput,
  StoryHistoryInput,
} from "./formatters/story.js";
export {
  reviewSlides,
  needsReview,
  countEmojis,
  normalizePayloadForPublishing,
  validatePayloadForPublishing,
} from "./review.js";
export type { ReviewResult, IGPublishIssue, IGPublishValidationResult } from "./review.js";
export {
  normalizeStoryPayloadForPublishing,
  validateStoryPayloadForPublishing,
} from "./storyValidation.js";
export type { IGStoryPublishValidationResult } from "./storyValidation.js";
export {
  buildScholarshipCarousel,
  buildOpportunityCarousel,
  buildNewsCarousel,
  buildHistoireCarousel,
  buildUtilityCarousel,
  buildBreakingNewsPost,
  buildStatCard,
} from "./formatters/index.js";
