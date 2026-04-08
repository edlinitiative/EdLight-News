/**
 * @edlight-news/renderer – IG Engine Drop-in Renderer
 *
 * Drop-in replacement for generateCarouselAssets() from ig-carousel.ts.
 * Returns the same CarouselAssetResult interface so the worker can swap
 * the call site with zero structural changes.
 *
 * Routing:
 *   igType === "taux"   → legacy renderer (dedicated financial template)
 *   all other igTypes   → new IG Engine (premium templates)
 *   any unhandled error → fall back to legacy renderer (fail-safe)
 *
 * The CarouselAssetResult interface is defined inline here to avoid a
 * hard circular dependency on ig-carousel.ts; it is structurally identical.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IGQueueItem, IGFormattedPayload } from "@edlight-news/types";
import { buildPost } from "./buildSlides.js";
import { renderPost } from "./renderSlides.js";
import { adaptLegacyPayload, shouldUseIgEngine } from "./adaptLegacyPayload.js";

// ── Shared result type (mirrors ig-carousel.ts CarouselAssetResult) ───────────

export interface CarouselAssetResult {
  mode: "rendered" | "dry-run";
  slidePaths: string[];
  payloadPath: string;
  exportDir: string;
}

// ── Internal: lazy-load legacy renderer to avoid startup cost ─────────────────

async function legacyRender(
  queueItem: IGQueueItem,
  payload: IGFormattedPayload,
): Promise<CarouselAssetResult> {
  const { generateCarouselAssets } = await import("../../ig-carousel.js");
  return generateCarouselAssets(queueItem, payload);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render an IG post using the premium IG Engine, with automatic fallback to
 * the legacy renderer for unsupported types or on any error.
 *
 * Return value is identical to generateCarouselAssets():
 *   { mode, slidePaths, payloadPath, exportDir }
 *
 * @param queueItem   The queued post metadata from Firestore.
 * @param payload     The formatted slide payload produced by buildIgQueue.
 */
export async function renderWithIgEngine(
  queueItem: IGQueueItem,
  payload:   IGFormattedPayload,
): Promise<CarouselAssetResult> {
  // ── Bypass: types with no IG Engine template ────────────────────────────────
  if (!shouldUseIgEngine(queueItem.igType)) {
    console.log(`[ig-engine] igType "${queueItem.igType}" → legacy renderer (no engine template)`);
    return legacyRender(queueItem, payload);
  }

  // ── Set up export directory + payload debug file ────────────────────────────
  const exportDir  = `/tmp/ig_exports/${queueItem.id}`;
  const payloadPath = join(exportDir, "payload.json");
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(payloadPath, JSON.stringify({ queueItem, payload }, null, 2), "utf-8");

  // ── Render with new engine, fall back on any error ──────────────────────────
  try {
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

    return { mode: "rendered", slidePaths, payloadPath, exportDir };

  } catch (err) {
    // Fail-safe: never drop a production post due to engine errors.
    // Log the error, fall back to legacy renderer, and continue.
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    console.warn(
      `[ig-engine] render failed for ${queueItem.id} (${queueItem.igType}) — ` +
      `falling back to legacy renderer:\n${msg}`,
    );
    return legacyRender(queueItem, payload);
  }
}
