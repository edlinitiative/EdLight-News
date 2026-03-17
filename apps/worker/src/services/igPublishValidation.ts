import { validatePayloadForPublishing } from "@edlight-news/generator/ig/review.js";
import {
  normalizeStoryPayloadForPublishing,
  validateStoryPayloadForPublishing,
} from "@edlight-news/generator/ig/storyValidation.js";

export { validatePayloadForPublishing };
export {
  normalizeStoryPayloadForPublishing,
  validateStoryPayloadForPublishing,
};
export type {
  IGPublishIssue,
  IGPublishValidationResult,
} from "@edlight-news/generator/ig/review.js";
export type { IGStoryPublishValidationResult } from "@edlight-news/generator/ig/storyValidation.js";
