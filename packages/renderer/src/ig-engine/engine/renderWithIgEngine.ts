/**
 * @edlight-news/renderer – IG Engine Production Renderer
 *
 * The sole production renderer for all IG post types.
 * There is no fallback — every post type has a premium template.
 * Errors are thrown so the worker can surface them cleanly.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IGQueueItem, IGFormattedPayload } from "@edlight-news/types";
import { buildPost, isExportReady } from "./buildSlides.js";
import { renderPost } from "./renderSlides.js";
import { adaptLegacyPayload } from "./adaptLegacyPayload.js";
import { buildFitReport, formatFitReport } from "../qa/fitReport.js";

// ── Result type ──────────────────────────────────────────────────────────────

export interface CarouselAssetResult {
  mode: "rendered" | "dry-run";
  slidePaths: string[];
  payloadPath: string;
  fitReportPath: string;
  exportDir: string;
  /** Always "ig-engine" — legacy renderer has been removed. */
  renderedBy: "ig-engine";
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Render an IG post using the premium IG Engine.
 * All post types are supported. Errors are thrown, not swallowed.
 *
 * @param queueItem   The queued post metadata from Firestore.
 * @param payload     The formatted slide payload produced by buildIgQueue.
 */
export async function renderWithIgEngine(
  queueItem: IGQueueItem,
  payload:   IGFormattedPayload,
): Promise<CarouselAssetResult> {
  const exportDir   = `/tmp/ig_exports/${queueItem.id}`;
  const payloadPath = join(exportDir, "payload.json");
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(payloadPath, JSON.stringify({ queueItem, payload }, null, 2), "utf-8");

  const { intake, rawSlides, caption, contentType } = adaptLegacyPayload(queueItem, payload);

  const { post, overflowWarnings } = buildPost({ intake, rawSlides, caption });

  if (overflowWarnings.length > 0) {
    console.warn(
      `[ig-engine] overflow warnings for ${queueItem.id} (${queueItem.igType}):`,
      overflowWarnings,
    );
  }

  if (!isExportReady(post)) {
    const report = formatFitReport(buildFitReport(post));
    console.error(`[ig-engine] ✗ overflow gate BLOCKED export for ${queueItem.id}\n${report}`);
    throw new Error(
      `[ig-engine] Export blocked for ${queueItem.id} — unresolved overflow in template "${post.templateId}". ` +
      `Overflow fields: ${post.slides.filter(s => !s.validation.fitPassed).map((s, i) => `slide ${i+1}`).join(", ")}`,
    );
  }

  const rendered = await renderPost(post, contentType, { failOnDomOverflow: true });

  const slidePaths: string[] = [];
  for (const slide of rendered) {
    const pngPath = join(exportDir, `slide_${slide.slideNumber}.png`);
    writeFileSync(pngPath, slide.png);
    slidePaths.push(pngPath);
  }

  // — Write caption.txt ———————————————————————————————————————
  const captionLines: string[] = [caption.text];
  if (caption.cta) captionLines.push("", caption.cta);
  if (caption.hashtags.length) captionLines.push("", caption.hashtags.join(" "));
  const captionPath = join(exportDir, "caption.txt");
  writeFileSync(captionPath, captionLines.join("\n"), "utf-8");

  // — Write meta.json ————————————————————————————————————————
  const meta = {
    templateId: post.templateId,
    language: post.language,
    topic: post.topic,
    slideCount: post.slides.length,
    slides: post.slides.map((s, i) => ({
      slideNumber: i + 1,
      fitPassed: s.validation.fitPassed,
    })),
  };
  const metaPath = join(exportDir, "meta.json");
  writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");

  // — Write fit-report.txt ———————————————————————————————————
  const fitReport = buildFitReport(post);
  const fitReportText = formatFitReport(fitReport);
  const fitReportPath = join(exportDir, "fit-report.txt");
  writeFileSync(fitReportPath, fitReportText, "utf-8");

  console.log(
    `[ig-engine] ✓ rendered ${slidePaths.length} slides for ${queueItem.id}` +
    ` (igType="${queueItem.igType}" → template="${post.templateId}")`,
  );

  return { mode: "rendered", slidePaths, payloadPath, fitReportPath, exportDir, renderedBy: "ig-engine" };
}
