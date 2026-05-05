/**
 * Zod schemas for the social generator.
 *
 * `socialArticleInputSchema` — what we pass to the LLM (and what callers must
 * provide; missing optional fields default to null/[]).
 * `socialPostsOutputSchema` — what we expect the LLM to return; mirrors the
 * Output Format section of the system prompt.
 *
 * Validation is intentionally strict: invalid responses trigger one repair
 * round in `generate.ts`. If the second attempt also fails we throw so the
 * caller can fall back to the legacy formatter.
 */

import { z } from "zod";

// ── Input ────────────────────────────────────────────────────────────────────

export const SOCIAL_CATEGORIES = [
  "Bourses",
  "Opportunités",
  "Actualités",
  "Haïti",
  "Éducation",
  "Histoire",
  "Explainer",
  "Taux",
  "Autre",
] as const;

export const socialArticleInputSchema = z.object({
  articleId: z.string().min(1),
  url: z.string().url(),
  category: z.enum(SOCIAL_CATEGORIES),
  language: z.enum(["fr", "ht"]),
  title: z.string().min(1),
  summary: z.string().default(""),
  body: z.string().default(""),
  publishedAt: z.string().min(4),
  deadline: z.string().nullable().default(null),
  country: z.string().nullable().default(null),
  institution: z.string().nullable().default(null),
  level: z
    .enum(["Lycée", "Licence", "Master", "Doctorat", "Tous"])
    .nullable()
    .default(null),
  coverage: z.array(z.string()).default([]),
  eligibility: z.array(z.string()).default([]),
  documents: z.array(z.string()).default([]),
  applicationUrl: z.string().nullable().default(null),
  imageUrl: z.string().nullable().default(null),
});

export type SocialArticleInput = z.infer<typeof socialArticleInputSchema>;

// ── Output ───────────────────────────────────────────────────────────────────

const carouselSlideSchema = z.object({
  slide_number: z.number().int().positive(),
  headline: z.string().min(1).max(120), // ≤8 words ≈ 60 chars; hard cap 120
  subheadline: z.string().nullable().optional().default(null),
  body: z.string().max(400).nullable().optional().default(null),
  icon: z.string().nullable().optional().default(null),
  background_style: z
    .enum(["primary", "secondary", "accent", "neutral"])
    .default("primary"),
  iconNotes: z.string().nullable().optional().default(null),
});

const instagramSchema = z.object({
  post_type: z.enum(["carousel", "single", "reel", "story_only"]),
  carousel_slides: z.array(carouselSlideSchema), // may be empty for story_only
  caption: z.string().max(2200),
  hashtags: z.array(z.string()).max(15),
  alt_text: z.string().min(1).max(1000),
});

const threadsPostSchema = z.object({
  text: z.string().min(1).max(500),
  is_reply_to_previous: z.boolean().default(false),
});

const threadsSchema = z.object({
  posts: z.array(threadsPostSchema).min(1).max(6),
  hashtags: z.array(z.string()).max(3),
});

const facebookSchema = z.object({
  post_text: z.string().min(1).max(8000),
  first_comment: z.string().nullable().default(null),
  hashtags: z.array(z.string()).max(7),
});

const sharedSchema = z.object({
  primary_cta: z.string().min(1).max(160),
  deadline_urgency: z.enum(["high", "medium", "low", "n/a"]),
  best_post_time: z.string().nullable().default(null),
});

export const socialPostsOutputSchema = z.object({
  instagram: instagramSchema,
  threads: threadsSchema,
  facebook: facebookSchema,
  shared: sharedSchema,
});

export type SocialPostsOutput = z.infer<typeof socialPostsOutputSchema>;
export type SocialInstagramPayload = z.infer<typeof instagramSchema>;
export type SocialThreadsPayload = z.infer<typeof threadsSchema>;
export type SocialFacebookPayload = z.infer<typeof facebookSchema>;
