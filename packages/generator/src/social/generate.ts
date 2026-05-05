/**
 * Multi-platform social post generator.
 *
 * Pipeline:
 *   1. Validate the input article against `socialArticleInputSchema`.
 *   2. Call the LLM with the canonical system prompt + the article JSON.
 *   3. Parse the response and validate with `socialPostsOutputSchema`.
 *   4. On schema failure, retry ONCE with a repair prompt that quotes the
 *      validation errors back to the model.
 *   5. Return the validated output plus metadata (provider, model, prompt
 *      version, retry count).
 *
 * The function never throws on transient LLM failures — those are surfaced
 * via `result.ok === false` so callers can fall back gracefully. Schema
 * failures after retry DO throw (programmer error / model regression).
 */

import { callLLM, type LLMOptions } from "../client.js";
import { SOCIAL_SYSTEM_PROMPT, SOCIAL_PROMPT_VERSION } from "./prompt.js";
import {
  socialArticleInputSchema,
  socialPostsOutputSchema,
  type SocialArticleInput,
  type SocialPostsOutput,
} from "./schema.js";

export interface GenerateSocialPostsResult {
  ok: true;
  output: SocialPostsOutput;
  meta: {
    promptVersion: string;
    retries: number;
    rawResponseChars: number;
  };
}

export interface GenerateSocialPostsError {
  ok: false;
  error: string;
  rawResponse?: string;
}

/**
 * Strip markdown code fences that some models add despite jsonMode.
 * Tolerant of optional language tags and trailing whitespace.
 */
function stripFences(s: string): string {
  let out = s.trim();
  if (out.startsWith("```")) {
    out = out.replace(/^```(?:json)?\s*/i, "");
    out = out.replace(/```\s*$/i, "");
  }
  return out.trim();
}

function buildPrompt(article: SocialArticleInput, repairContext?: string): string {
  const articleBlock = JSON.stringify(article, null, 2);
  if (!repairContext) {
    return `${SOCIAL_SYSTEM_PROMPT}\n\n# Article (input)\n${articleBlock}\n\n# Now return the JSON object.`;
  }
  return [
    SOCIAL_SYSTEM_PROMPT,
    "",
    "# Article (input)",
    articleBlock,
    "",
    "# Previous attempt failed schema validation",
    repairContext,
    "",
    "Return the corrected JSON object only. Do not apologise. Do not add prose.",
  ].join("\n");
}

/**
 * Generate platform-optimized social posts for a single article.
 *
 * @param articleInput  The article object — partial inputs are accepted; the
 *                      schema fills in defaults for optional fields.
 * @param llmOpts       Optional overrides for the LLM call. By default uses
 *                      the project default (gemini-2.5-flash-lite, JSON mode).
 */
export async function generateSocialPosts(
  articleInput: unknown,
  llmOpts?: LLMOptions,
): Promise<GenerateSocialPostsResult | GenerateSocialPostsError> {
  // 1. Input validation — surfaced as an error, not a throw, so callers can
  //    log+skip without aborting a batch.
  const parsedInput = socialArticleInputSchema.safeParse(articleInput);
  if (!parsedInput.success) {
    return {
      ok: false,
      error: `Invalid article input: ${parsedInput.error.message}`,
    };
  }
  const article = parsedInput.data;

  const opts: LLMOptions = {
    temperature: 0.4,
    maxOutputTokens: 4096,
    jsonMode: true,
    ...llmOpts,
  };

  let lastRaw = "";
  let lastErrorMsg = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = buildPrompt(
      article,
      attempt === 0 ? undefined : lastErrorMsg,
    );
    let raw: string;
    try {
      raw = await callLLM(prompt, opts);
    } catch (err) {
      return {
        ok: false,
        error: `LLM call failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    lastRaw = raw;

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripFences(raw));
    } catch (err) {
      lastErrorMsg = `Output was not valid JSON: ${err instanceof Error ? err.message : String(err)}. First 200 chars: ${raw.slice(0, 200)}`;
      continue;
    }

    const result = socialPostsOutputSchema.safeParse(parsedJson);
    if (result.success) {
      return {
        ok: true,
        output: result.data,
        meta: {
          promptVersion: SOCIAL_PROMPT_VERSION,
          retries: attempt,
          rawResponseChars: raw.length,
        },
      };
    }
    lastErrorMsg = `Schema validation failed:\n${result.error.issues
      .slice(0, 8)
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n")}`;
  }

  return {
    ok: false,
    error: `Output failed schema validation after retry. Last errors:\n${lastErrorMsg}`,
    rawResponse: lastRaw.slice(0, 2000),
  };
}
