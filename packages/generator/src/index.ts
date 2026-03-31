/**
 * @edlight-news/generator
 *
 * Uses Google Gemini to generate web content in FR + HT.
 * Validates output with zod. Enforces quality gates.
 */

import { callGemini } from "./client.js";
import { buildWebDraftPrompt } from "./prompts.js";
import { geminiWebDraftSchema, type GeminiWebDraft } from "./schema.js";
import type { ContentChannel, ContentLanguage, ContentStatus, ItemCategory, QualityFlags } from "@edlight-news/types";

export type { GeminiWebDraft } from "./schema.js";
export { geminiWebDraftSchema } from "./schema.js";

export { callGemini, callLLM } from "./client.js";
export type { LLMProvider, LLMOptions } from "./client.js";

// ── Re-export synthesis module ──────────────────────────────────────────────
export {
  generateSynthesisFromPacket,
  validateSynthesisGrounding,
  buildSynthesisPrompt,
  geminiSynthesisSchema,
  SYNTHESIS_PROMPT_VERSION,
} from "./synthesis.js";
export type {
  GeminiSynthesisOutput,
  SynthesisSource,
  SynthesisPacket,
  GenerateSynthesisResult,
  GenerateSynthesisError,
  ValidationResult,
} from "./synthesis.js";

// ── Re-export utility module ────────────────────────────────────────────────
export {
  generateUtilityFromPackets,
  validateUtilityJson,
  buildUtilityPrompt,
  geminiUtilitySchema,
  UTILITY_PROMPT_VERSION,
} from "./utility.js";
export type {
  GeminiUtilityOutput,
  UtilitySourcePacket,
  UtilityGenerateInput,
  GenerateUtilityResult,
  GenerateUtilityError,
  UtilityValidationResult,
} from "./utility.js";

// ── Re-export normalization module ──────────────────────────────────────────
export {
  normalizeArticle,
  validateNormalizationGrounding,
  formatNormalizedArticle,
  buildNormalizePrompt,
  geminiNormalizedArticleSchema,
  NORMALIZE_PROMPT_VERSION,
} from "./normalize.js";
export type {
  GeminiNormalizedArticle,
  NormalizeArticleInput,
  NormalizeArticleResult,
  NormalizeArticleError,
  NormalizationValidationResult,
} from "./normalize.js";

// ── Re-export postprocess module ────────────────────────────────────────────
export { formatContentVersion } from "./postprocess/formatContentVersion.js";
export type {
  FormatContentVersionInput,
  FormatContentVersionOutput,
  ContentSection as PostprocessContentSection,
  SourceCitation as PostprocessSourceCitation,
} from "./postprocess/formatContentVersion.js";

// ── Re-export editorial tone module ─────────────────────────────────────────
export {
  getEditorialDirective,
  getEditorialDirectiveByKey,
  formatEditorialBlock,
  editorialBlockForSeries,
  editorialBlockForKey,
} from "./editorial-tone.js";
export type {
  EditorialToneKey,
  EditorialDirective,
} from "./editorial-tone.js";

// ── Re-export dataset content module ────────────────────────────────────────
export {
  generateDatasetArticle,
  buildDatasetPrompt,
  geminiDatasetArticleSchema,
  DATASET_PROMPT_VERSION,
} from "./datasets.js";
export type {
  GeminiDatasetArticle,
  DatasetArticleType,
  GenerateDatasetArticleResult,
  GenerateDatasetArticleError,
} from "./datasets.js";

// ── Re-export dataset verification module ───────────────────────────────────
export {
  verifyUniversity,
  verifyScholarship,
  verifyCalendarEvent,
  verifyUniversitySchema,
  verifyScholarshipSchema,
  verifyCalendarEventSchema,
  VERIFY_CONFIDENCE_THRESHOLD,
} from "./verify.js";
export type {
  VerifyUniversityResult,
  VerifyScholarshipResult,
  VerifyCalendarEventResult,
  VerifyResult,
  VerifySuccess,
  VerifyError,
} from "./verify.js";

// ── Re-export Instagram pipeline module ─────────────────────────────────────
export {
  decideIG,
  applyDedupePenalty,
  formatForIG,
  buildScholarshipCarousel,
  buildOpportunityCarousel,
  buildNewsCarousel,
  buildHistoireCarousel,
  buildUtilityCarousel,
} from "./ig/index.js";
export type { BilingualText, FormatIGOptions } from "./ig/index.js";

/** Items scoring below this are kept as draft — never auto-published. */
export const PUBLISH_SCORE_THRESHOLD = 0.40;

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
  category?: ItemCategory,
  audienceFitScore?: number,
): Array<{
  channel: ContentChannel;
  language: ContentLanguage;
  title: string;
  summary: string;
  body: string;
  status: ContentStatus;
  draftReason?: string;
  category?: ItemCategory;
  qualityFlags: QualityFlags;
  citations: { sourceName: string; sourceUrl: string }[];
  narrative?: string | null;
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
  } else if (audienceFitScore !== undefined && audienceFitScore < PUBLISH_SCORE_THRESHOLD) {
    status = "draft";
    draftReason = `Low audience-fit score (${audienceFitScore.toFixed(2)})`;
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
      ...(draft.ig_narrative ? { narrative: draft.ig_narrative } : {}),
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
