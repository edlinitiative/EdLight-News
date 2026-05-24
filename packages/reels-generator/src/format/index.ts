/**
 * @edlight-news/reels-generator/format — v2 format-driven public surface.
 */

export * from "./types.js";
export { classifyReelFormat } from "./classifyReelFormat.js";
export type { ClassifyReelFormatInput } from "./classifyReelFormat.js";
export {
  generateStoryboard,
} from "./generateStoryboard.js";
export type {
  GenerateStoryboardInput,
  GenerateStoryboardResult,
  StoryboardSourceItem,
} from "./generateStoryboard.js";
export { collectReelAssets } from "./collectReelAssets.js";
export type { CollectReelAssetsInput } from "./collectReelAssets.js";
export { scoreReelQuality, scoreGeneratedReel } from "./scoreReelQuality.js";
export { buildReelV2 } from "./buildReelV2.js";
export type { BuildReelV2Input, BuildReelV2Result } from "./buildReelV2.js";
