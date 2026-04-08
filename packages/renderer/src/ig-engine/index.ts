/**
 * @edlight-news/renderer – IG Engine
 *
 * Public entry point for the template-based Instagram post rendering engine.
 *
 * Architecture (IG_COPILOT.md §4):
 *   buildPost()        — intake → selectTemplate → validate → measure → rewrite
 *   renderPost()       — validated post → PNG buffers (via Playwright)
 *   exportPost()       — PNG buffers → files on disk + caption.txt + meta.json
 *   generatePreviewSheet() — all slide PNGs → QA contact sheet
 *   buildFitReport()   — post → structured fit report
 *   formatFitReport()  — fit report → human-readable ASCII text
 *
 * Quick usage:
 *   ```ts
 *   import { buildPost, renderPost, exportPost } from "@edlight-news/renderer/ig-engine";
 *
 *   const { post, overflowWarnings } = buildPost({ intake, rawSlides, caption });
 *   if (isExportReady(post)) {
 *     const rendered = await renderPost(post, "news");
 *     const result   = exportPost(post, rendered, { outputDir: "./out" });
 *   }
 *   ```
 */

// ── Types ─────────────────────────────────────────────────────────────────────

// Post model
export type { IGEnginePost, SlideContent, ValidatedSlide, PostCaption, PostLanguage, PostStatus, TemplateId } from "./types/post.js";
// Template zones
export type { TemplateConfig, TemplateZone, TextBox, FieldLimits } from "./types/post.js";
// Fit / validation
export type { FitResult, ValidationResult, SlideValidationMeta } from "./types/post.js";
// Export / measurement / intake
export type { ExportResult, MeasureTextInput, MeasureTextResult, ContentIntakeInput } from "./types/post.js";

// ── Config ────────────────────────────────────────────────────────────────────

export {
  TEMPLATE_CONFIGS,
  getTemplateConfig,
  listTemplateIds,
} from "./config/templateLimits.js";

export {
  BRAND,
  getBrandAccent,
  getBrandBackground,
  getBrandLabel,
  escapeHtml,
  footerBarHtml,
} from "./config/brand.js";

export {
  FONTS,
  GOOGLE_FONTS_URL,
  getFontCoefficients,
  getFontCoefficient,
} from "./config/fonts.js";

export type { SupportedFontFamily, FontCoefficients } from "./config/fonts.js";

// ── Engine — selection & validation ──────────────────────────────────────────

export { selectTemplate } from "./engine/selectTemplate.js";
export { validateSlide, validateAllSlides } from "./engine/validateCopyLimits.js";
export { measureText, measureSlide } from "./engine/measureText.js";
export { rewriteSlideCopy, countWords } from "./engine/rewriteCopy.js";
export type { RewriteResult } from "./engine/rewriteCopy.js";

// ── Engine — pipeline ─────────────────────────────────────────────────────────

export { buildPost, isExportReady } from "./engine/buildSlides.js";
export type { BuildSlidesInput, BuildSlidesResult } from "./engine/buildSlides.js";

export { renderPost, renderSingleSlide } from "./engine/renderSlides.js";
export type { RenderedSlide } from "./engine/renderSlides.js";

export { exportPost } from "./engine/exportSlides.js";
export type { ExportOptions } from "./engine/exportSlides.js";

// ── Templates ─────────────────────────────────────────────────────────────────

export { buildSlideHtml } from "./templates/index.js";
export { buildBreakingNewsSlide } from "./templates/BreakingNewsTemplate.js";
export { buildNewsCarouselSlide } from "./templates/NewsCarouselTemplate.js";
export { buildOpportunitySlide } from "./templates/OpportunityTemplate.js";
export { buildExplainerSlide } from "./templates/ExplainerTemplate.js";
export { buildQuoteStatSlide } from "./templates/QuoteStatTemplate.js";
export { buildWeeklyRecapSlide } from "./templates/WeeklyRecapTemplate.js";

// ── Legacy Adapter & Production Renderer ────────────────────────────────────

export { adaptLegacyPayload, resolveContentType } from "./engine/adaptLegacyPayload.js";
export type { AdaptedPayload } from "./engine/adaptLegacyPayload.js";

export { renderWithIgEngine } from "./engine/renderWithIgEngine.js";
export type { CarouselAssetResult } from "./engine/renderWithIgEngine.js";

// ── QA ────────────────────────────────────────────────────────────────────────

export { generatePreviewSheet } from "./qa/generatePreviewSheet.js";
export { buildFitReport, formatFitReport } from "./qa/fitReport.js";
export type {
  FitReportSummary,
  FitReportSlide,
  FieldReport,
} from "./qa/fitReport.js";
