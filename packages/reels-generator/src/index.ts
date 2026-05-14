/**
 * @edlight-news/reels-generator — public surface.
 */

export * from "./types.js";
export * from "./brand.js";
export { pickTemplate, TEMPLATE_PREFERENCE } from "./pickTemplate.js";

// Templates are exported but consumers will mostly hit `buildReel` / `composeReel`.
export { BigStatisticTemplate } from "./templates/BigStatisticTemplate.js";
export { PullQuoteTemplate } from "./templates/PullQuoteTemplate.js";
export { HeadlinePhotoTemplate } from "./templates/HeadlinePhotoTemplate.js";
export { NumberedPointsTemplate } from "./templates/NumberedPointsTemplate.js";
export { IntroCard } from "./templates/IntroCard.js";
export { OutroCard } from "./templates/OutroCard.js";
export { Captions } from "./templates/Captions.js";
export { RemotionRoot } from "./templates/Root.js";
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
