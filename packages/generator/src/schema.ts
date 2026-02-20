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
  confidence: z.number().min(0).max(1),
  haiti_relevant: z.boolean(),
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
