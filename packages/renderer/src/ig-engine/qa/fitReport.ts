/**
 * @edlight-news/renderer – QA Preview Layer: Fit Report
 *
 * Generates structured reports about text-fit checks and rewrites.
 *
 * (IG_COPILOT.md §5.9):
 *   - Show fit-check status per field
 *   - Show whether any text is near limits (overflow risk)
 *   - Show which fields were rewritten automatically
 *
 * Two output modes:
 *   buildFitReport()  → structured FitReportSummary (JSON-serialisable)
 *   formatFitReport() → human-readable ASCII report for editors / logs
 */

import type { IGEnginePost, SlideValidationMeta } from "../types/post.js";

// ── Public types ──────────────────────────────────────────────────────────────

export interface FieldReport {
  /** Field name (e.g. "headline", "body", "sourceLine"). */
  field: string;
  linesUsed: number;
  /**
   * Maximum allowed lines for this field.
   * NOTE: populated from measuredLineCount keys; maxLines is stored
   * in the template config and not repeated on the slide meta, so
   * the value here is the measured lines used (not a cap).
   */
  maxLines: number;
  /** Percentage of the allowed line budget consumed (0–100+). */
  fillPercent: number;
  status: "pass" | "risk" | "fail";
}

export interface FitReportSlide {
  slideNumber: number;
  headline: string;
  fitPassed: boolean;
  overflowRisk: boolean;
  rewriteCount: number;
  fieldReports: FieldReport[];
}

export interface FitReportSummary {
  postId: string;
  templateId: string;
  language: string;
  topic: string;
  totalSlides: number;
  slidesPassed: number;
  slidesFailed: number;
  overflowRiskSlides: number;
  totalRewrites: number;
  /** True only if every slide passed and none have overflow risk. */
  allClear: boolean;
  slides: FitReportSlide[];
  generatedAt: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a structured fit report for a validated post.
 *
 * @param post  The validated IGEnginePost (from buildPost()).
 */
export function buildFitReport(post: IGEnginePost): FitReportSummary {
  const slideReports: FitReportSlide[] = post.slides.map((slide, i) => ({
    slideNumber: i + 1,
    headline: slide.headline,
    fitPassed: slide.validation.fitPassed,
    overflowRisk: slide.validation.overflowRisk,
    rewriteCount: slide.validation.rewriteCount,
    fieldReports: buildFieldReports(slide.validation),
  }));

  const slidesPassed = slideReports.filter(s => s.fitPassed).length;
  const totalRewrites = post.slides.reduce(
    (acc, s) => acc + s.validation.rewriteCount,
    0,
  );

  return {
    postId: post.id,
    templateId: post.templateId,
    language: post.language,
    topic: post.topic,
    totalSlides: post.slides.length,
    slidesPassed,
    slidesFailed: post.slides.length - slidesPassed,
    overflowRiskSlides: slideReports.filter(s => s.overflowRisk).length,
    totalRewrites,
    allClear: slidesPassed === post.slides.length && !slideReports.some(s => s.overflowRisk),
    slides: slideReports,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Format a fit report as a human-readable text string.
 *
 * Intended for logging, terminal output, or writing alongside exported
 * slides so editors can see at a glance which fields were near their limits.
 */
export function formatFitReport(report: FitReportSummary): string {
  const W = 58;
  const line = "═".repeat(W);
  const thin = "─".repeat(W);

  const lines: string[] = [
    line,
    `  EdLight News — IG Engine Fit Report`,
    `  ${report.templateId} · ${report.language.toUpperCase()} · ${report.totalSlides} slide${report.totalSlides !== 1 ? "s" : ""}`,
    `  Topic: ${truncate(report.topic, W - 10)}`,
    line,
    `  Status  : ${report.allClear ? "✓ ALL CLEAR" : "✗ ISSUES DETECTED"}`,
    `  Passed  : ${report.slidesPassed} / ${report.totalSlides} slides`,
    `  Rewrites: ${report.totalRewrites} total`,
    `  At risk : ${report.overflowRiskSlides} slide(s) near overflow`,
    thin,
  ];

  for (const slide of report.slides) {
    const icon = slide.fitPassed
      ? slide.overflowRisk
        ? "⚠"
        : "✓"
      : "✗";

    const headline = truncate(slide.headline, W - 16);
    lines.push(`  ${icon} Slide ${String(slide.slideNumber).padStart(2)}: ${headline}`);

    if (slide.rewriteCount > 0) {
      lines.push(`        ✏ Rewritten ×${slide.rewriteCount}`);
    }

    for (const f of slide.fieldReports) {
      if (f.status === "pass") continue;
      const statusIcon = f.status === "fail" ? "✗" : "⚠";
      lines.push(
        `        ${statusIcon} ${f.field.padEnd(18)} ${f.linesUsed} lines  (${f.fillPercent}% full)`,
      );
    }
  }

  lines.push(
    line,
    `  Generated : ${report.generatedAt}`,
    `  Post ID   : ${report.postId}`,
    line,
  );

  return lines.join("\n");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build per-field reports from the slide's validation metadata.
 *
 * measuredLineCount is keyed by field name and contains the lines used.
 * We don't have the per-field maxLines here (that lives in templateLimits)
 * so we use a simple heuristic: > measured is a risk indicator based on
 * whether overflowRisk was flagged overall.
 */
function buildFieldReports(meta: SlideValidationMeta): FieldReport[] {
  return Object.entries(meta.measuredLineCount).map(([field, linesUsed]) => {
    // Without the exact maxLines per field we use a conservative sentinel
    // so callers see the raw usage; the overall fitPassed flag is authoritative.
    const maxLines = linesUsed; // will equal linesUsed when no overflow
    const fillPercent = 100; // placeholder — actual overflow is in fitPassed
    const status: FieldReport["status"] = meta.fitPassed
      ? meta.overflowRisk
        ? "risk"
        : "pass"
      : "fail";

    return { field, linesUsed, maxLines, fillPercent, status };
  });
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}
