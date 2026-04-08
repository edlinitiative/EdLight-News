/**
 * @edlight-news/renderer – Export Engine
 *
 * Writes all final assets to disk after the validation and rendering passes.
 *
 * Outputs (IG_COPILOT.md §5.8):
 *   - One PNG per slide   → edlight-news-[template]-[date]-slide-N.png
 *   - Caption text file   → edlight-news-[template]-[date]-caption.txt
 *   - JSON metadata file  → edlight-news-[template]-[date]-meta.json
 *   - Optional QA preview → edlight-news-[template]-[date]-preview.png
 *
 * Rules:
 *   - No export if any slide has unresolved overflow (unless forceExport).
 *   - Carousel ordering is always preserved.
 *   - File names are consistent and include template + date for archiving.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IGEnginePost, ExportResult } from "../types/post.js";
import type { RenderedSlide } from "./renderSlides.js";

// ── Public API ────────────────────────────────────────────────────────────────

export interface ExportOptions {
  /**
   * Output directory for all generated files.
   * Created recursively if it does not already exist.
   */
  outputDir: string;
  /**
   * Override the date segment in file names (format: YYYY-MM-DD).
   * Defaults to today's date.
   */
  dateOverride?: string;
  /**
   * Export even if some slides failed the fit check.
   * Default: false — export is blocked if overflow remains.
   */
  forceExport?: boolean;
  /**
   * Whether to write a preview-sheet PNG.
   * Requires `previewBuffer` to be supplied.
   */
  includePreview?: boolean;
  /**
   * Pre-rendered preview sheet buffer (from qa/generatePreviewSheet.ts).
   * Only written when includePreview is true.
   */
  previewBuffer?: Buffer;
}

/**
 * Write rendered slides and associated metadata to disk.
 *
 * Returns an ExportResult describing every file written and any errors.
 *
 * @param post   A validated IGEnginePost (from buildPost()).
 * @param slides Rendered slide buffers (from renderPost()).
 * @param opts   Export options (output directory, date, etc.).
 */
export function exportPost(
  post: IGEnginePost,
  slides: RenderedSlide[],
  opts: ExportOptions,
): ExportResult {
  const {
    outputDir,
    dateOverride,
    forceExport = false,
    includePreview = false,
    previewBuffer,
  } = opts;

  // ── Safety check ──────────────────────────────────────────────────────────
  const hasUnresolved = post.slides.some(s => !s.validation.fitPassed);
  if (hasUnresolved && !forceExport) {
    return {
      postId: post.id,
      templateId: post.templateId,
      date: buildDateString(dateOverride),
      slideFiles: [],
      captionFile: "",
      metadataFile: "",
      success: false,
      errors: [
        "Export blocked: one or more slides have unresolved overflow. " +
          "Set forceExport: true to override.",
      ],
    };
  }

  // ── Prepare output directory ───────────────────────────────────────────────
  mkdirSync(outputDir, { recursive: true });

  const date = buildDateString(dateOverride);
  const prefix = `edlight-news-${post.templateId}-${date}`;
  const errors: string[] = [];
  const slideFiles: string[] = [];

  // ── Write slide PNGs ──────────────────────────────────────────────────────
  for (const rendered of slides) {
    const filename = `${prefix}-slide-${rendered.slideNumber}.png`;
    const filepath = join(outputDir, filename);
    try {
      writeFileSync(filepath, rendered.png);
      slideFiles.push(filepath);
    } catch (err) {
      errors.push(`slide ${rendered.slideNumber}: ${String(err)}`);
    }
  }

  // ── Write caption text ────────────────────────────────────────────────────
  const captionFilename = `${prefix}-caption.txt`;
  const captionPath = join(outputDir, captionFilename);
  try {
    writeFileSync(captionPath, formatCaption(post), "utf8");
  } catch (err) {
    errors.push(`caption: ${String(err)}`);
  }

  // ── Write JSON metadata ───────────────────────────────────────────────────
  const metaFilename = `${prefix}-meta.json`;
  const metaPath = join(outputDir, metaFilename);
  try {
    writeFileSync(metaPath, JSON.stringify(buildMetadata(post, date), null, 2), "utf8");
  } catch (err) {
    errors.push(`metadata: ${String(err)}`);
  }

  // ── Write preview sheet (optional) ────────────────────────────────────────
  let previewFile: string | undefined;
  if (includePreview && previewBuffer) {
    const previewFilename = `${prefix}-preview.png`;
    const previewPath = join(outputDir, previewFilename);
    try {
      writeFileSync(previewPath, previewBuffer);
      previewFile = previewPath;
    } catch (err) {
      errors.push(`preview: ${String(err)}`);
    }
  }

  return {
    postId: post.id,
    templateId: post.templateId,
    date,
    slideFiles,
    captionFile: captionPath,
    metadataFile: metaPath,
    previewFile,
    success: errors.length === 0,
    errors,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDateString(override?: string): string {
  return override ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Format the post caption as a plain-text string ready for copy-paste. */
function formatCaption(post: IGEnginePost): string {
  const parts: string[] = [post.caption.text];

  if (post.caption.cta) {
    parts.push("", post.caption.cta);
  }

  if (post.caption.hashtags.length > 0) {
    parts.push("", post.caption.hashtags.join(" "));
  }

  return parts.join("\n");
}

// ── Metadata shape ────────────────────────────────────────────────────────────

interface ExportMeta {
  postId: string;
  templateId: string;
  contentType: string;
  language: string;
  topic: string;
  date: string;
  slideCount: number;
  status: string;
  fitSummary: {
    allPassed: boolean;
    slidesPassed: number;
    slidesFailed: number;
    overflowRiskCount: number;
    totalRewrites: number;
  };
  slides: Array<{
    slideNumber: number;
    headline: string;
    fitPassed: boolean;
    rewriteCount: number;
    overflowRisk: boolean;
    measuredLineCount: Record<string, number>;
    fontSizeUsed: Record<string, number>;
  }>;
}

function buildMetadata(post: IGEnginePost, date: string): ExportMeta {
  const slidesPassed = post.slides.filter(s => s.validation.fitPassed).length;
  const totalRewrites = post.slides.reduce(
    (acc, s) => acc + s.validation.rewriteCount,
    0,
  );

  return {
    postId: post.id,
    templateId: post.templateId,
    contentType: post.contentType,
    language: post.language,
    topic: post.topic,
    date,
    slideCount: post.slides.length,
    status: post.status,
    fitSummary: {
      allPassed: slidesPassed === post.slides.length,
      slidesPassed,
      slidesFailed: post.slides.length - slidesPassed,
      overflowRiskCount: post.slides.filter(s => s.validation.overflowRisk).length,
      totalRewrites,
    },
    slides: post.slides.map((s, i) => ({
      slideNumber: i + 1,
      headline: s.headline,
      fitPassed: s.validation.fitPassed,
      rewriteCount: s.validation.rewriteCount,
      overflowRisk: s.validation.overflowRisk,
      measuredLineCount: s.validation.measuredLineCount,
      fontSizeUsed: s.validation.fontSizeUsed,
    })),
  };
}
