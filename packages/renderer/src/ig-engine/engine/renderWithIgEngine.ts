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
import { buildPost } from "./buildSlides.js";
import { renderPost } from "./renderSlides.js";
import { adaptLegacyPayload } from "./adaptLegacyPayload.js";

// ── Result type ──────────────────────────────────────────────────────────────

export interface CarouselAssetResult {
  mode: "rendered" | "dry-run";
  slidePaths: string[];
  payloadPath: string;
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

  const rendered = await renderPost(post, contentType);

  const slidePaths: string[] = [];
  for (const slide of rendered) {
    const pngPath = join(exportDir, `slide_${slide.slideNumber}.png`);
    writeFileSync(pngPath, slide.png);
    slidePaths.push(pngPath);
  }

  console.log(
    `[ig-engine] ✓ rendered ${slidePaths.length} slides for ${queueItem.id}` +
    ` (igType="${queueItem.igType}" → template="${post.templateId}")`,
  );

  return { mode: "rendered", slidePaths, payloadPath, exportDir, renderedBy: "ig-engine" };
}
