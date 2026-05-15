/**
 * @edlight-news/reels-generator — public surface.
 */

export * from "./types.js";
export * from "./brand.js";
export { pickTemplate, TEMPLATE_PREFERENCE } from "./pickTemplate.js";

// Note: React/Remotion templates (templates/*.tsx) are built separately via
// `tsconfig.templates.json` only when Remotion peer deps are installed. They
// are NOT re-exported here so this package can be consumed by the Node-only
// worker without `@types/react` / `remotion`. Consumers that render reels
// (a dedicated Remotion bundler entrypoint) import them via the
// `@edlight-news/reels-generator/templates/*` subpath.
export type {
  BaseTemplateProps,
  CaptionWord,
  ResolvedClip,
} from "./templates/types.js";

// Orchestrator pieces — the worker calls these.
export { generateReelScript } from "./generateReelScript.js";
export type {
  ReelScript,
  GenerateReelScriptInput,
} from "./generateReelScript.js";
export { synthesizeVoice } from "./synthesizeVoice.js";
export { pickStockFootage } from "./pickStockFootage.js";
export type { StockClip } from "./pickStockFootage.js";
export { transcribeForCaptions } from "./transcribeForCaptions.js";
export { composeReel } from "./composeReel.js";
export { buildReel } from "./buildReel.js";
export type {
  BuildReelInput,
  BuildReelResult,
} from "./buildReel.js";
