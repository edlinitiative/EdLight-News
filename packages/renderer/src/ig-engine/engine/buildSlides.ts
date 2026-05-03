/**
 * @edlight-news/renderer – Build Slides (Pipeline Orchestrator)
 *
 * Wires the full validation pipeline from raw ContentIntakeInput to a
 * fully validated IGEnginePost ready for rendering.
 *
 * Pipeline (IG_COPILOT.md §2):
 *   1. selectTemplate        — pick a fixed template from the library
 *   2. validateCopyLimits    — enforce word / char / line counts per field
 *   3. rewriteSlideCopy      — compress if any field fails copy limits
 *   4. measureSlide          — pixel-level fit check for every text box
 *   5. rewriteSlideCopy      — compress again if pixel measurement fails
 *   6. final measurement     — record fit metadata, flag overflow risk
 *
 * Non-negotiable rules (IG_COPILOT.md §14):
 *   - Post status is "validated" only if all slides pass all checks.
 *   - Posts with unresolved overflow are marked "draft", not exported.
 *   - isExportReady() must return true before calling renderPost().
 */

import { randomUUID } from "node:crypto";
import type {
  ContentIntakeInput,
  SlideContent,
  ValidatedSlide,
  SlideValidationMeta,
  IGEnginePost,
  PostCaption,
} from "../types/post.js";
import { selectTemplate } from "./selectTemplate.js";
import { validateSlide } from "./validateCopyLimits.js";
import { measureSlide } from "./measureText.js";
import { rewriteSlideCopy } from "./rewriteCopy.js";
import { getTemplateConfig } from "../config/templateLimits.js";

// ── Public API ────────────────────────────────────────────────────────────────

/** Input bundle for the build pipeline. */
export interface BuildSlidesInput {
  /** Normalized intake metadata (topic, category, language, urgency …). */
  intake: ContentIntakeInput;
  /**
   * Pre-structured raw slide content.
   * Caller is responsible for setting one idea per slide and providing
   * all text fields (headline, body, sourceLine …) in the target language.
   * Measurement happens here, AFTER language text has been generated.
   */
  rawSlides: SlideContent[];
  /** Structured caption — always separate from slide copy (§5.2). */
  caption: PostCaption;
}

/** Result returned by buildPost(). */
export interface BuildSlidesResult {
  /** Fully assembled and validated post. */
  post: IGEnginePost;
  /**
   * Human-readable overflow warnings.
   * Non-empty means some text was moved to caption or hard-truncated.
   */
  overflowWarnings: string[];
}

/**
 * Run the full build pipeline and return a validated IGEnginePost.
 *
 * @param input - intake metadata, pre-structured raw slides, and caption.
 */
export function buildPost(input: BuildSlidesInput): BuildSlidesResult {
  const { intake, rawSlides, caption } = input;

  // ── Step 1: template selection ────────────────────────────────────────────
  const { templateId } = selectTemplate(intake);
  const config = getTemplateConfig(templateId);

  const overflowWarnings: string[] = [];
  const validatedSlides: ValidatedSlide[] = [];

  for (let i = 0; i < rawSlides.length; i++) {
    let current: SlideContent = { ...rawSlides[i]! };
    let rewriteCount = 0;

    // ── Step 2: copy-limit validation ───────────────────────────────────────
    let copyValidation = validateSlide(current, templateId);

    if (!copyValidation.passed) {
      // ── Step 3: rewrite to fix copy limits ──────────────────────────────
      const rw1 = rewriteSlideCopy(current, templateId, 4, intake.preferredLanguage);
      current = rw1.slide;
      rewriteCount += rw1.rewriteCount;

      if (rw1.overflowedToCaption.length > 0) {
        overflowWarnings.push(
          `slide[${i + 1}]: copy-limit overflow — moved to caption: "${rw1.overflowedToCaption.join(" ").slice(0, 80)}…"`,
        );
      }

      copyValidation = validateSlide(current, templateId);
    }

    // ── Step 4: pixel-level text measurement ────────────────────────────────
    const measureResults = measureSlide(current, config, intake.preferredLanguage);
    const measureFailed = measureResults.filter(r => !r.fits);

    if (measureFailed.length > 0) {
      // ── Step 5: rewrite to fix pixel overflow ─────────────────────────
      const rw2 = rewriteSlideCopy(current, templateId, 4, intake.preferredLanguage);
      current = rw2.slide;
      rewriteCount += rw2.rewriteCount;

      if (rw2.overflowedToCaption.length > 0) {
        overflowWarnings.push(
          `slide[${i + 1}]: pixel overflow — moved to caption: "${rw2.overflowedToCaption.join(" ").slice(0, 80)}…"`,
        );
      }
    }

    // ── Step 6: final measurement for metadata ──────────────────────────────
    const finalMeasure = measureSlide(current, config, intake.preferredLanguage);
    const finalFailed = finalMeasure.filter(r => !r.fits);

    if (finalFailed.length > 0) {
      overflowWarnings.push(
        `slide[${i + 1}]: unresolved overflow in field(s): ${finalFailed.map(r => r.field).join(", ")}`,
      );
    }

    // Build measured-line-count and font-size maps
    const measuredLineCount: Record<string, number> = {};
    for (const fit of finalMeasure) {
      measuredLineCount[fit.field] = fit.linesUsed;
    }

    const fontSizeUsed: Record<string, number> = {};
    for (const [zoneName, zone] of Object.entries(config.zones)) {
      if (zone) fontSizeUsed[zoneName] = zone.fontSize;
    }

    const validationMeta: SlideValidationMeta = {
      fitPassed: finalFailed.length === 0,
      rewriteCount,
      measuredLineCount,
      overflowRisk: finalMeasure.some(r => r.maxLines > 1 && (r.linesUsed / r.maxLines) >= 0.85),
      fontSizeUsed,
    };

    validatedSlides.push({ ...current, validation: validationMeta });
  }

  // ── Assemble post ──────────────────────────────────────────────────────────
  const allPassed = validatedSlides.every(s => s.validation.fitPassed);

  const post: IGEnginePost = {
    id: randomUUID(),
    contentType: intake.category,
    category: intake.category,
    topic: intake.topic,
    language: intake.preferredLanguage,
    templateId,
    slides: validatedSlides,
    caption,
    hashtags: caption.hashtags,
    sourceNote: intake.sourceNote,
    cta: caption.cta,
    status: allPassed ? "validated" : "draft",
    createdAt: new Date().toISOString(),
  };

  return { post, overflowWarnings };
}

/**
 * Return true only if every slide in the post passed its fit check.
 *
 * Call this before renderPost() — the renderer will still warn on failed
 * slides, but callers should gate final export behind this check.
 */
export function isExportReady(post: IGEnginePost): boolean {
  return post.status !== "failed" && post.slides.every(s => s.validation.fitPassed);
}
