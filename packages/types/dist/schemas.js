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
    weakSource: z.boolean().optional(),
    missingDeadline: z.boolean().optional(),
    offMission: z.boolean().optional(),
    reasons: z.array(z.string()),
});
const sourceSelectorsSchema = z.object({
    listItem: z.string().optional(),
    articleBody: z.string().optional(),
    title: z.string().optional(),
});
const geoTagSchema = z.enum(["HT", "Diaspora", "Global"]);
const imageSourceSchema = z.enum(["publisher", "wikidata", "branded", "screenshot"]);
const imageMetaSchema = z.object({
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
    fetchedAt: z.string().optional(),
    originalImageUrl: z.string().url().optional(),
});
const imageAttributionSchema = z.object({
    name: z.string().optional(),
    url: z.string().url().optional(),
    license: z.string().optional(),
});
const entityRefSchema = z.object({
    personName: z.string().optional(),
    wikidataId: z.string().optional(),
});
const itemSourceSchema = z.object({
    name: z.string().min(1),
    originalUrl: z.string().url(),
    aggregatorUrl: z.string().url().optional(),
});
const opportunitySchema = z.object({
    deadline: z.string().optional(),
    eligibility: z.array(z.string()).optional(),
    coverage: z.string().optional(),
    howToApply: z.string().optional(),
    officialLink: z.string().url().optional(),
});
const synthesisSourceRefSchema = z.object({
    itemId: z.string().min(1),
    title: z.string().min(1),
    sourceName: z.string().min(1),
    publishedAt: z.string().optional(),
});
const synthesisMetaSchema = z.object({
    sourceItemIds: z.array(z.string().min(1)),
    sourceCount: z.number().int().min(1),
    publisherDomains: z.array(z.string()),
    model: z.string().min(1),
    promptVersion: z.string().min(1),
    validationPassed: z.boolean(),
    lastSynthesizedAt: z.string(),
});
const contentSectionSchema = z.object({
    heading: z.string().min(1),
    content: z.string().min(1),
});
export const sourceCitationSchema = z.object({
    name: z.string().min(1),
    url: z.string().url(),
});
// ── Utility schemas ───────────────────────────────────────────────────────────
export const utilitySeriesSchema = z.enum([
    "StudyAbroad",
    "Career",
    "ScholarshipRadar",
    "HaitiHistory",
    "HaitiFactOfTheDay",
    "HaitianOfTheWeek",
]);
export const utilityTypeSchema = z.enum(["study_abroad", "career", "scholarship", "opportunity", "history", "daily_fact", "profile"]);
export const utilityAudienceSchema = z.enum(["lycee", "universite", "international"]);
export const utilityRegionSchema = z.enum(["HT", "US", "CA", "FR", "DO", "RU", "Global"]);
export const utilityCitationSchema = z.object({
    label: z.string().min(1),
    url: z.string().url(),
});
export const extractedFactsSchema = z.object({
    deadlines: z.array(z.object({
        label: z.string().min(1),
        dateISO: z.string(),
        sourceUrl: z.string().url(),
    })).optional(),
    requirements: z.array(z.string()).optional(),
    steps: z.array(z.string()).optional(),
    eligibility: z.array(z.string()).optional(),
});
export const utilityMetaSchema = z.object({
    series: utilitySeriesSchema,
    utilityType: utilityTypeSchema,
    region: z.array(utilityRegionSchema).optional(),
    audience: z.array(utilityAudienceSchema).optional(),
    tags: z.array(z.string()).optional(),
    citations: z.array(utilityCitationSchema).min(1),
    extractedFacts: extractedFactsSchema.optional(),
    rotationKey: z.string().optional(),
});
const utilitySourceParsingHintsSchema = z.object({
    selectorMain: z.string().optional(),
    selectorDate: z.string().optional(),
});
export const utilitySourceSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    url: z.string().url(),
    series: utilitySeriesSchema,
    rotationKey: z.string().optional(),
    type: z.enum(["rss", "html", "pdf", "calendar"]),
    allowlistDomain: z.string().min(1),
    priority: z.number().int().min(0).max(100).default(50),
    region: z.array(utilityRegionSchema).min(1),
    utilityTypes: z.array(utilityTypeSchema).min(1),
    parsingHints: utilitySourceParsingHintsSchema.optional(),
    active: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
});
export const utilityQueueEntrySchema = z.object({
    id: z.string().min(1),
    status: z.enum(["queued", "processing", "done", "failed"]),
    series: utilitySeriesSchema,
    rotationKey: z.string().optional(),
    langTargets: z.array(z.enum(["fr", "ht"])).min(1),
    sourceIds: z.array(z.string().min(1)).min(1),
    runAt: timestampSchema,
    attempts: z.number().int().min(0),
    lastError: z.string().optional(),
    failReasons: z.array(z.string()).optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
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
        "bourses",
        "concours",
        "stages",
        "programmes",
    ]),
    deadline: z.string().nullable(),
    evergreen: z.boolean(),
    confidence: z.number().min(0).max(1),
    qualityFlags: qualityFlagsSchema,
    citations: z.array(citationSchema).min(1),
    // v2 fields — optional for backwards compat
    vertical: z.string().optional(),
    geoTag: geoTagSchema.optional(),
    audienceFitScore: z.number().min(0).max(1).optional(),
    dedupeGroupId: z.string().optional(),
    source: itemSourceSchema.optional(),
    opportunity: opportunitySchema.optional(),
    publishedAt: timestampSchema.nullable().optional(),
    // image fields
    imageUrl: z.string().url().nullable().optional(),
    imageSource: imageSourceSchema.optional(),
    imageConfidence: z.number().min(0).max(1).optional(),
    imageMeta: imageMetaSchema.optional(),
    imageAttribution: imageAttributionSchema.optional(),
    entity: entityRefSchema.optional(),
    // synthesis fields
    itemType: z.enum(["source", "synthesis", "utility"]).optional(),
    clusterId: z.string().optional(),
    synthesisMeta: synthesisMetaSchema.optional(),
    utilityMeta: utilityMetaSchema.optional(),
    lastMajorUpdateAt: timestampSchema.nullable().optional(),
    effectiveDate: z.string().optional(),
    sourceList: z.array(synthesisSourceRefSchema).optional(),
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
    category: z.enum(["scholarship", "opportunity", "news", "event", "resource", "local_news", "bourses", "concours", "stages", "programmes"]).optional(),
    qualityFlags: qualityFlagsSchema.optional(),
    citations: z.array(citationSchema).min(1),
    // v2 fields
    sections: z.array(contentSectionSchema).optional(),
    whatChanged: z.string().optional(),
    synthesisTags: z.array(z.string()).optional(),
    sourceCitations: z.array(sourceCitationSchema).optional(),
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
export { citationSchema, contentSectionSchema, entityRefSchema, geoTagSchema, imageAttributionSchema, imageMetaSchema, imageSourceSchema, itemSourceSchema, opportunitySchema, qualityFlagsSchema, sourceSelectorsSchema, synthesisMetaSchema, synthesisSourceRefSchema, timestampSchema, };
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
export const createUtilitySourceSchema = utilitySourceSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
export const createUtilityQueueEntrySchema = utilityQueueEntrySchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});
//# sourceMappingURL=schemas.js.map