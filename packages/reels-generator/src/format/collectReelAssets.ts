/**
 * collectReelAssets — best-effort fills `assetUrls` on storyboard scenes
 * that want visual coverage. Pure orchestration over existing primitives:
 * `pickStockFootage` (Pexels / Wikimedia / brand fallback).
 *
 * Visual-type policy:
 *   - image_card / b_roll / roundup_item: pull 1 clip per scene via stock search.
 *   - animated_headline / deadline_card / checklist / brand_close / quote_card /
 *     logo_card / map: NO asset fetch — these are rendered procedurally by
 *     the templates from on-screen text and brand assets.
 *
 * Failure mode: scenes whose search returns nothing keep `assetUrls`
 * empty and rely on the renderer's fallback. We never throw — asset
 * gaps are surfaced via the quality score, not a build failure.
 */

import { pickStockFootage } from "../pickStockFootage.js";
import type { ReelTopic } from "../types.js";
import type { ReelScene } from "./types.js";

const VISUAL_NEEDS_ASSET = new Set([
  "image_card",
  "b_roll",
  "roundup_item",
]);

export interface CollectReelAssetsInput {
  /** Mapped v1 topic for the stock-footage provider routing. */
  topic: ReelTopic;
  /** Reel-level fallback search query (typically the title). */
  fallbackQuery: string;
  storyboard: ReelScene[];
}

export async function collectReelAssets(
  input: CollectReelAssetsInput,
): Promise<ReelScene[]> {
  const out: ReelScene[] = [];
  for (const scene of input.storyboard) {
    if (!VISUAL_NEEDS_ASSET.has(scene.visualType)) {
      out.push(scene);
      continue;
    }
    const query = (scene.assetHints && scene.assetHints[0])
      ? scene.assetHints.join(" ").slice(0, 80)
      : input.fallbackQuery;
    try {
      const clips = await pickStockFootage({
        topic: input.topic,
        query,
        count: 1,
      });
      out.push({
        ...scene,
        assetUrls: clips.map((c) => c.url),
      });
    } catch (err) {
      console.warn(
        `[collectReelAssets] scene ${scene.id} asset lookup failed:`,
        (err as Error).message,
      );
      out.push(scene);
    }
  }
  return out;
}
