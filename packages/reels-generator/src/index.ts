/**
 * @edlight-news/reels-generator — public surface.
 */

export * from "./types.js";
export * from "./brand.js";
export { pickTemplate, pickTemplateWithDowngrade, TEMPLATE_PREFERENCE } from "./pickTemplate.js";
export type { PickTemplateResult } from "./pickTemplate.js";
export { extractHeroNumber, HERO_NUMBER_SALIENCE } from "./extractHeroNumber.js";
export type { HeroNumber, HeroNumberKind, HeroNumberSource } from "./extractHeroNumber.js";

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
export { generateReelScript, TemplateRequirementError } from "./generateReelScript.js";
export type {
  ReelScript,
  GenerateReelScriptInput,
} from "./generateReelScript.js";
export { synthesizeVoice } from "./synthesizeVoice.js";
export { pickStockFootage } from "./pickStockFootage.js";
export type { StockClip } from "./pickStockFootage.js";
export { alignCaptions } from "./alignCaptions.js";
export type { AlignCaptionsInput, AlignCaptionsResult, AlignmentDiagnostic } from "./alignCaptions.js";
/** @deprecated use `alignCaptions` — kept for one release for back-compat. */
export { transcribeForCaptions } from "./transcribeForCaptions.js";
export { composeReel } from "./composeReel.js";
export { buildReel } from "./buildReel.js";
export type {
  BuildReelInput,
  BuildReelResult,
} from "./buildReel.js";

// ── v2 format-driven pipeline ────────────────────────────────────────────
// New editorial layer: format classification → storyboard → assets →
// quality score. Wraps `buildReel` for the actual MP4 render. See
// `./format/buildReelV2.ts` for the orchestrator entry point.
export * from "./format/index.js";
