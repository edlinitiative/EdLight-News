/**
 * @edlight-news/generator/social
 *
 * Multi-platform social post generator for @edlightnews (IG / Threads / FB).
 *
 * Wraps the canonical system prompt (see SYSTEM_PROMPT.ts) with strict Zod
 * schema validation and a one-shot retry on schema failure. Returns a
 * platform-agnostic JSON object that downstream adapters convert into the
 * existing per-queue payloads (IGFormattedPayload / FbMessagePayload /
 * ThMessagePayload).
 *
 * Strategy decisions baked in (see PR thread):
 *   - Lucide icons emitted as `[Icon: Name]` text tokens; renderer support
 *     for inline icon glyphs comes in a follow-up.
 *   - Single bilingual @edlightnews account; one language per generation.
 *   - Existing IG carousel pipeline untouched. New generator opts in
 *     to FB/Threads via the SOCIAL_GENERATOR_V2 env flag at the queue
 *     builders.
 */

export { SOCIAL_SYSTEM_PROMPT, SOCIAL_PROMPT_VERSION } from "./prompt.js";
export {
  socialArticleInputSchema,
  socialPostsOutputSchema,
  type SocialArticleInput,
  type SocialPostsOutput,
  type SocialInstagramPayload,
  type SocialThreadsPayload,
  type SocialFacebookPayload,
} from "./schema.js";
export {
  generateSocialPosts,
  type GenerateSocialPostsResult,
} from "./generate.js";
export {
  socialToFbPayload,
  socialToThPayload,
  type ToFbAdapterOpts,
  type ToThAdapterOpts,
} from "./adapters.js";
