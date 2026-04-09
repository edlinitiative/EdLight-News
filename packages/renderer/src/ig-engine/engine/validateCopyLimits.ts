/**
 * @edlight-news/renderer – Copy Limit Validator
 *
 * Enforces strict max word / char / line counts for every text field
 * before a slide is allowed to proceed to the renderer.
 *
 * Rules (IG_COPILOT.md §5.4):
 *   - If content exceeds limits, do NOT render yet.
 *   - Pass to rewriteCopy.ts instead.
 *   - Limits are configured per-template in templateLimits.ts.
 */

import type { SlideContent, TemplateConfig, FitResult, ValidationResult } from "../types/post.js";
import { resolveZone } from "../types/post.js";
import { getTemplateConfig } from "../config/templateLimits.js";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate copy limits for a single slide against its template config.
 * Returns a ValidationResult. If any field fails, `passed` is false.
 */
export function validateSlide(
  slide: SlideContent,
  templateId: string,
): ValidationResult {
  const config = getTemplateConfig(templateId);
  const variant = slide.layoutVariant;
  const fitResults: FitResult[] = [];
  const warnings: string[] = [];

  fitResults.push(...validateField("headline", slide.headline, config, templateId, variant));
  fitResults.push(...validateField("body", slide.body, config, templateId, variant));
  fitResults.push(...validateField("supportLine", slide.supportLine, config, templateId, variant));
  fitResults.push(...validateField("sourceLine", slide.sourceLine, config, templateId, variant));
  fitResults.push(...validateField("deadline", slide.deadline, config, templateId, variant));
  fitResults.push(...validateField("statValue", slide.statValue, config, templateId, variant));
  fitResults.push(...validateField("statDescription", slide.statDescription, config, templateId, variant));

  const failedFields = fitResults.filter(r => !r.fits);
  if (failedFields.length > 0) {
    warnings.push(
      `${failedFields.length} field(s) exceed copy limits: ${failedFields.map(f => f.field).join(", ")}`,
    );
  }

  return {
    passed: failedFields.length === 0,
    fitResults,
    rewriteCount: 0,
    warnings,
  };
}

/**
 * Validate all slides in a set. Returns aggregated ValidationResult.
 */
export function validateAllSlides(
  slides: SlideContent[],
  templateId: string,
): ValidationResult {
  const allFit: FitResult[] = [];
  const allWarnings: string[] = [];
  let allPassed = true;

  for (let i = 0; i < slides.length; i++) {
    const result = validateSlide(slides[i]!, templateId);
    allFit.push(...result.fitResults.map(r => ({ ...r, field: `slide[${i}].${r.field}` })));
    allWarnings.push(...result.warnings.map(w => `slide[${i}]: ${w}`));
    if (!result.passed) allPassed = false;
  }

  return { passed: allPassed, fitResults: allFit, rewriteCount: 0, warnings: allWarnings };
}

// ── Field-level validation ────────────────────────────────────────────────────

function validateField(
  fieldName: keyof typeof FIELD_ZONE_MAP,
  text: string | undefined,
  config: TemplateConfig,
  templateId: string,
  variant?: string,
): FitResult[] {
  if (text === undefined || text === "") return [];

  const zoneName = FIELD_ZONE_MAP[fieldName];
  const zone = resolveZone(config, zoneName, variant);
  if (!zone) return []; // Zone not defined for this template — field is not used

  const { limits } = zone;
  const results: FitResult[] = [];

  // Word count check
  if (limits.maxWords !== undefined) {
    const wordCount = countWords(text);
    const fits = wordCount <= limits.maxWords;
    const maxLines = limits.maxLines ?? 99;
    results.push({
      field: fieldName,
      fits,
      linesUsed: 0, // Set by measureText later
      maxLines,
      overflowPx: 0,
      recommendedAdjustment: fits
        ? undefined
        : `Reduce from ${wordCount} to max ${limits.maxWords} words (remove ${wordCount - limits.maxWords} words)`,
    });
  }

  // Char count check (supplementary)
  if (limits.maxChars !== undefined) {
    const charCount = text.length;
    const fits = charCount <= limits.maxChars;
    if (!fits) {
      results.push({
        field: `${fieldName}[chars]`,
        fits: false,
        linesUsed: 0,
        maxLines: limits.maxLines ?? 99,
        overflowPx: 0,
        recommendedAdjustment: `Reduce from ${charCount} to max ${limits.maxChars} characters`,
      });
    }
  }

  // Log warning if results is empty (field present but no limits)
  void templateId;

  return results;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Maps SlideContent field names to TemplateConfig zone names. */
const FIELD_ZONE_MAP = {
  headline: "headline",
  body: "body",
  supportLine: "supportLine",
  sourceLine: "sourceLine",
  deadline: "deadline",
  statValue: "statValue",
  statDescription: "statDescription",
} as const;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
