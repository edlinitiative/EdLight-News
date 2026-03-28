import { z } from "zod";

/**
 * Zod schema to validate the JSON output from Gemini.
 */
export const geminiWebDraftSchema = z.object({
  title_fr: z.string().min(1).max(200),
  summary_fr: z.string().min(1).max(500),
  body_fr: z.string().min(10),
  title_ht: z.string().min(1).max(200),
  summary_ht: z.string().min(1).max(500),
  body_ht: z.string().min(10),
  ig_narrative: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  haiti_relevant: z.boolean(),
  /**
   * Whether the article describes a success, achievement, or inspirational story
   * about a Haitian individual, group, or institution. Examples: awards, graduations,
   * international recognition, athletic victories, community achievements.
   */
  is_success_story: z.boolean(),
  /**
   * Semantic cluster slug — a short lowercase-english identifier
   * for the underlying *story* (not the article). Articles about the same
   * event/topic from different publishers should produce the same slug.
   * Format: kebab-case, 3-6 words, e.g. "haiti-child-recruitment-un-2026"
   */
  cluster_slug: z.string().min(5).max(120),
  extracted: z.object({
    deadline: z.string().nullable(),
    eligibility: z.string().nullable(),
    category: z.enum([
      "scholarship",
      "opportunity",
      "news",
      "event",
      "resource",
      "local_news",
    ]),
  }),
});

export type GeminiWebDraft = z.infer<typeof geminiWebDraftSchema>;
