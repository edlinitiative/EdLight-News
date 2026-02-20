import { z } from "zod";

// ── Helpers ────────────────────────────────────────────────────────────────
/** Firestore Timestamp is validated as an object with seconds & nanoseconds */
const timestampSchema = z.object({
  seconds: z.number(),
  nanoseconds: z.number(),
});

const citationSchema = z.object({
  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
});

const qualityFlagsSchema = z.object({
  hasSourceUrl: z.boolean(),
  needsReview: z.boolean(),
  lowConfidence: z.boolean(),
  reasons: z.array(z.string()),
});

const sourceSelectorsSchema = z.object({
  listItem: z.string().optional(),
  articleBody: z.string().optional(),
  title: z.string().optional(),
});

// ── sources ────────────────────────────────────────────────────────────────
export const sourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
  type: z.enum(["rss", "html"]),
  selector: z.string().optional(),
  selectors: sourceSelectorsSchema.optional(),
  language: z.enum(["fr", "ht"]),
  active: z.boolean(),
  pollCadenceSec: z.number().int().min(60).default(3600),
  priority: z.enum(["hot", "normal"]).default("normal"),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ── raw_items ──────────────────────────────────────────────────────────────
export const rawItemSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  hash: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url(),
  description: z.string(),
  publishedAt: timestampSchema.nullable(),
  status: z.enum(["new", "processed", "skipped"]),
  skipReason: z.string().optional(),
  createdAt: timestampSchema,
});

// ── items ──────────────────────────────────────────────────────────────────
export const itemSchema = z.object({
  id: z.string().min(1),
  rawItemId: z.string().min(1),
  sourceId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  canonicalUrl: z.string().url(),
  extractedText: z.string().nullable().optional(),
  category: z.enum([
    "scholarship",
    "opportunity",
    "news",
    "event",
    "resource",
    "local_news",
  ]),
  deadline: z.string().nullable(),
  evergreen: z.boolean(),
  confidence: z.number().min(0).max(1),
  qualityFlags: qualityFlagsSchema,
  citations: z.array(citationSchema).min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ── content_versions ───────────────────────────────────────────────────────
export const contentVersionSchema = z.object({
  id: z.string().min(1),
  itemId: z.string().min(1),
  channel: z.enum(["web", "ig", "wa"]),
  language: z.enum(["fr", "ht"]),
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
  status: z.enum(["draft", "review", "published"]),
  draftReason: z.string().optional(),
  category: z.enum(["scholarship","opportunity","news","event","resource","local_news"]).optional(),
  qualityFlags: qualityFlagsSchema.optional(),
  citations: z.array(citationSchema).min(1),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ── assets ─────────────────────────────────────────────────────────────────
export const assetSchema = z.object({
  id: z.string().min(1),
  contentVersionId: z.string().min(1),
  type: z.enum(["carousel_image", "story_image"]),
  url: z.string().url(),
  width: z.number().positive(),
  height: z.number().positive(),
  createdAt: timestampSchema,
});

// ── publish_queue ──────────────────────────────────────────────────────────
export const publishQueueEntrySchema = z.object({
  id: z.string().min(1),
  contentVersionId: z.string().min(1),
  target: z.enum(["ig", "wa"]),
  status: z.enum(["pending", "in_progress", "done", "failed"]),
  scheduledAt: timestampSchema,
  attemptCount: z.number().int().min(0),
  lastError: z.string().optional(),
  completedAt: timestampSchema.optional(),
  createdAt: timestampSchema,
});

// ── metrics ────────────────────────────────────────────────────────────────
export const metricSchema = z.object({
  id: z.string().min(1),
  contentVersionId: z.string().min(1),
  channel: z.enum(["web", "ig", "wa"]),
  views: z.number().int().min(0),
  clicks: z.number().int().min(0),
  shares: z.number().int().min(0),
  recordedAt: timestampSchema,
});

// ── Re-export sub-schemas for external use ─────────────────────────────────
export { citationSchema, qualityFlagsSchema, sourceSelectorsSchema, timestampSchema };

// ── Create schemas (omit id + timestamps for writes) ───────────────────────
export const createSourceSchema = sourceSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createRawItemSchema = rawItemSchema.omit({
  id: true,
  createdAt: true,
});

export const createItemSchema = itemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createContentVersionSchema = contentVersionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createAssetSchema = assetSchema.omit({
  id: true,
  createdAt: true,
});

export const createPublishQueueEntrySchema = publishQueueEntrySchema.omit({
  id: true,
  createdAt: true,
});

export const createMetricSchema = metricSchema.omit({
  id: true,
});

// ── Inferred types for create payloads ─────────────────────────────────────
export type CreateSource = z.infer<typeof createSourceSchema>;
export type CreateRawItem = z.infer<typeof createRawItemSchema>;
export type CreateItem = z.infer<typeof createItemSchema>;
export type CreateContentVersion = z.infer<typeof createContentVersionSchema>;
export type CreateAsset = z.infer<typeof createAssetSchema>;
export type CreatePublishQueueEntry = z.infer<typeof createPublishQueueEntrySchema>;
export type CreateMetric = z.infer<typeof createMetricSchema>;
