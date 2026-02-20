/**
 * @edlight-news/generator
 *
 * Uses Google Gemini to generate web content in FR + HT.
 * Validates output with zod. Enforces quality gates.
 */

import { callGemini } from "./client.js";
import { buildWebDraftPrompt } from "./prompts.js";
import { geminiWebDraftSchema, type GeminiWebDraft } from "./schema.js";
import type { ContentChannel, ContentLanguage, ContentStatus, QualityFlags } from "@edlight-news/types";

export type { GeminiWebDraft } from "./schema.js";
export { geminiWebDraftSchema } from "./schema.js";

export interface GenerateWebDraftInput {
  title: string;
  text: string;
  sourceUrl: string;
  sourceName: string;
}

export interface GenerateWebDraftResult {
  success: true;
  draft: GeminiWebDraft;
}

export interface GenerateWebDraftError {
  success: false;
  error: string;
  rawResponse?: string;
}

/**
 * Call Gemini to generate web drafts in FR + HT.
 * Returns structured, zod-validated output or an error.
 */
export async function generateWebDraftFRHT(
  input: GenerateWebDraftInput,
): Promise<GenerateWebDraftResult | GenerateWebDraftError> {
  try {
    const prompt = buildWebDraftPrompt(input);
    const raw = await callGemini(prompt);

    // Parse JSON from response
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        success: false,
        error: "Gemini response is not valid JSON",
        rawResponse: raw.slice(0, 500),
      };
    }

    // Validate with zod
    const result = geminiWebDraftSchema.safeParse(parsed);
    if (!result.success) {
      return {
        success: false,
        error: `Zod validation failed: ${result.error.message}`,
        rawResponse: raw.slice(0, 500),
      };
    }

    return { success: true, draft: result.data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown Gemini error",
    };
  }
}

/**
 * Build content_version write payloads from a validated Gemini draft.
 * Applies quality gates and returns status + draftReason accordingly.
 */
export function buildContentVersionPayloads(
  draft: GeminiWebDraft,
  itemId: string,
  qualityFlags: QualityFlags,
  citations: { sourceName: string; sourceUrl: string }[],
  category?: "news" | "scholarship" | "opportunity" | "event" | "resource" | "local_news",
): Array<{
  channel: ContentChannel;
  language: ContentLanguage;
  title: string;
  summary: string;
  body: string;
  status: ContentStatus;
  draftReason?: string;
  category?: "news" | "scholarship" | "opportunity" | "event" | "resource" | "local_news";
  qualityFlags: QualityFlags;
  citations: { sourceName: string; sourceUrl: string }[];
}> {
  // Determine status based on quality gates
  // Auto-publish when all gates pass; otherwise keep as draft with a reason
  let status: ContentStatus = "published";
  let draftReason: string | undefined;

  if (!qualityFlags.hasSourceUrl) {
    status = "draft";
    draftReason = "No source URL — cannot auto-publish";
  } else if (qualityFlags.needsReview) {
    status = "review";
    draftReason = "Needs review (opportunity missing deadline/eligibility)";
  } else if (qualityFlags.lowConfidence) {
    status = "draft";
    draftReason = `Low confidence (${draft.confidence})`;
  }

  const base = {
    channel: "web" as ContentChannel,
    status,
    ...(draftReason ? { draftReason } : {}),
    ...(category ? { category } : {}),
    qualityFlags,
    citations,
  };

  return [
    {
      ...base,
      language: "fr" as ContentLanguage,
      title: draft.title_fr,
      summary: draft.summary_fr,
      body: draft.body_fr,
    },
    {
      ...base,
      language: "ht" as ContentLanguage,
      title: draft.title_ht,
      summary: draft.summary_ht,
      body: draft.body_ht,
    },
  ];
}
