/**
 * @edlight-news/renderer – Layout Renderer
 *
 * Renders validated slides to PNG using the existing Playwright-based pipeline.
 *
 * Approach (IG_COPILOT.md §5.7):
 *   - Each slide is rendered from a deterministic HTML template
 *   - Canvas is always 1080 × 1350 px (4:5 Instagram portrait)
 *   - No freestyle layout — every slide comes from a fixed template builder
 *   - Slides that failed fit validation are warned about but still rendered
 *     (caller decides whether to block export via isExportReady())
 *
 * Note: Uses Playwright (existing project dependency) rather than Satori
 * because the project already has a mature HTML template system.
 * Same input → same output → deterministic rendering.
 */

import type { ValidatedSlide, IGEnginePost, TemplateId } from "../types/post.js";
import { buildSlideHtml } from "../templates/index.js";
import { getBrowserInstance } from "../../index.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const CANVAS_W = 1080;
const CANVAS_H = 1350;

// ── Public types ──────────────────────────────────────────────────────────────

/** A single rendered slide returned by renderPost() / renderSingleSlide(). */
export interface RenderedSlide {
  /** 1-based slide number (matches carousel order). */
  slideNumber: number;
  /** Raw PNG data. */
  png: Buffer;
  widthPx: number;
  heightPx: number;
}

/** Options for controlling render quality. */
export interface RenderOptions {
  /** Device scale factor for retina rendering. Default: 1 (1080×1350). Set to 2 for 2160×2700. */
  deviceScaleFactor?: 1 | 2;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render all slides in a validated post to PNG buffers.
 *
 * Opens one browser context per call and reuses it for all slides in the
 * carousel (one page per slide, closed after capture).
 *
 * @param post          A fully validated IGEnginePost (status: "validated").
 * @param contentType   Content-type key for brand colour resolution
 *                      (e.g. "news", "breaking", "opportunity").
 */
export async function renderPost(
  post: IGEnginePost,
  contentType: string,
  options?: RenderOptions,
): Promise<RenderedSlide[]> {
  if (post.status === "failed") {
    throw new Error(
      `[renderSlides] Cannot render post "${post.id}" — status is "failed".`,
    );
  }

  const scaleFactor = options?.deviceScaleFactor ?? 1;
  const browser = await getBrowserInstance();
  const context = await browser.newContext({
    viewport: { width: CANVAS_W, height: CANVAS_H },
    deviceScaleFactor: scaleFactor,
  });

  const results: RenderedSlide[] = [];

  try {
    for (let i = 0; i < post.slides.length; i++) {
      const slide = post.slides[i]!;

      if (!slide.validation.fitPassed) {
        console.warn(
          `[renderSlides] slide ${i + 1}/${post.slides.length} failed fit check` +
            (slide.validation.overflowRisk ? " (overflow risk)" : "") +
            " — rendering anyway",
        );
      }

      const html = buildSlideHtml(
        post.templateId,
        slide,
        contentType,
        i,
        post.slides.length,
      );

      const page = await context.newPage();
      try {
        await page.setContent(html, { waitUntil: "networkidle" });

        const png = await page.screenshot({
          type: "png",
          clip: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H },
        });

        results.push({
          slideNumber: i + 1,
          png: Buffer.from(png),
          widthPx: CANVAS_W * scaleFactor,
          heightPx: CANVAS_H * scaleFactor,
        });
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
  }

  return results;
}

/**
 * Render a single slide to a PNG buffer.
 *
 * Useful for per-slide previews and QA checks without rendering the whole
 * carousel.
 *
 * @param templateId  Template to use for HTML generation.
 * @param slide       A validated slide (from buildPost / buildSlides).
 * @param contentType Content-type key for brand colours.
 * @param slideIndex  0-based position within the carousel.
 * @param totalSlides Total slides in the carousel (for slide counters).
 */
export async function renderSingleSlide(
  templateId: TemplateId,
  slide: ValidatedSlide,
  contentType: string,
  slideIndex: number,
  totalSlides: number,
  options?: RenderOptions,
): Promise<Buffer> {
  const browser = await getBrowserInstance();
  const context = await browser.newContext({
    viewport: { width: CANVAS_W, height: CANVAS_H },
    deviceScaleFactor: options?.deviceScaleFactor ?? 1,
  });

  const page = await context.newPage();
  try {
    const html = buildSlideHtml(templateId, slide, contentType, slideIndex, totalSlides);
    await page.setContent(html, { waitUntil: "networkidle" });

    const png = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: CANVAS_W, height: CANVAS_H },
    });

    return Buffer.from(png);
  } finally {
    await page.close();
    await context.close();
  }
}
