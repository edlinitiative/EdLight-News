/**
 * @edlight-news/generator – Instagram pipeline
 *
 * Selection logic + formatting templates + meme generation for curated IG posting.
 */

export { decideIG, applyDedupePenalty } from "./selection.js";
export { formatForIG, formatForIGWithMeme } from "./formatters/index.js";
export {
  buildScholarshipCarousel,
  buildOpportunityCarousel,
  buildNewsCarousel,
  buildHistoireCarousel,
  buildUtilityCarousel,
} from "./formatters/index.js";
export { generateMemeSlide, isMemeWorthy, getMemeTemplates } from "./meme.js";
export type { GenerateMemeResult, GenerateMemeError } from "./meme.js";
