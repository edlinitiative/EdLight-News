/**
 * @edlight-news/renderer – Template builder registry
 *
 * Central dispatch: given a templateId + slide content, routes to the correct
 * HTML-generating function.
 */

export { buildBreakingNewsSlide } from "./BreakingNewsTemplate.js";
export { buildNewsCarouselSlide } from "./NewsCarouselTemplate.js";
export { buildOpportunitySlide } from "./OpportunityTemplate.js";
export { buildExplainerSlide } from "./ExplainerTemplate.js";
export { buildQuoteStatSlide } from "./QuoteStatTemplate.js";
export { buildWeeklyRecapSlide } from "./WeeklyRecapTemplate.js";
export { buildTauxCarouselSlide } from "./TauxCarouselTemplate.js";

import type { SlideContent, TemplateId } from "../types/post.js";
import { buildBreakingNewsSlide } from "./BreakingNewsTemplate.js";
import { buildNewsCarouselSlide } from "./NewsCarouselTemplate.js";
import { buildOpportunitySlide } from "./OpportunityTemplate.js";
import { buildExplainerSlide } from "./ExplainerTemplate.js";
import { buildQuoteStatSlide } from "./QuoteStatTemplate.js";
import { buildWeeklyRecapSlide } from "./WeeklyRecapTemplate.js";
import { buildTauxCarouselSlide } from "./TauxCarouselTemplate.js";

/**
 * Build the HTML for a single slide using the correct template.
 *
 * @param templateId  One of the 6 supported IG template IDs.
 * @param slide       Validated slide content.
 * @param contentType Content type key for brand accent/background resolution.
 * @param slideIndex  0-based index within the carousel.
 * @param totalSlides Total slides in the carousel.
 */
export function buildSlideHtml(
  templateId: TemplateId,
  slide: SlideContent,
  contentType: string,
  slideIndex: number,
  totalSlides: number,
): string {
  switch (templateId) {
    case "breaking-news-single":
      return buildBreakingNewsSlide(slide, contentType);

    case "news-carousel":
      return buildNewsCarouselSlide(slide, contentType, slideIndex, totalSlides);

    case "opportunity-carousel":
      return buildOpportunitySlide(slide, contentType, slideIndex, totalSlides);

    case "explainer-carousel":
      return buildExplainerSlide(slide, contentType, slideIndex, totalSlides);

    case "quote-stat-card":
      return buildQuoteStatSlide(slide, contentType, slideIndex, totalSlides);

    case "weekly-recap-carousel":
      return buildWeeklyRecapSlide(slide, contentType, slideIndex, totalSlides);

    case "taux-card":
      return buildTauxCarouselSlide(slide, contentType, slideIndex, totalSlides);

    default: {
      // TypeScript exhaustiveness guard
      const _: never = templateId;
      throw new Error(`[ig-engine] No template builder for: "${String(_)}"`);
    }
  }
}
