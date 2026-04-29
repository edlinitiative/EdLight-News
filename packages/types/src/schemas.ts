import { z } from "zod";

// ── Helpers ────────────────────────────────────────────────────────────────
/** ISO date string in YYYY-MM-DD format */
const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected ISO date YYYY-MM-DD");

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
  reasons: z.array(z.string()).default([]),
});

const sourceSelectorsSchema = z.object({
  listItem: z.string().optional(),
  articleBody: z.string().optional(),
  title: z.string().optional(),
});

const geoTagSchema = z.enum(["HT", "Diaspora", "Global"]);

const imageSourceSchema = z.enum([
  "publisher",
  "wikidata",
  "branded",
  "screenshot",
  "commons",
  "gemini_ai",
]);

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
  imageUrl: z.string().url().optional(),
  imageCaption: z.string().optional(),
  imageCredit: z.string().optional(),
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
  "ScholarshipRadarWeekly",
  "HaitiHistory",
  "HaitiFactOfTheDay",
  "HaitianOfTheWeek",
  "HaitiEducationCalendar",
]);
export const utilityTypeSchema = z.enum([
  "study_abroad",
  "career",
  "scholarship",
  "opportunity",
  "history",
  "daily_fact",
  "profile",
  "school_calendar",
]);
export const utilityAudienceSchema = z.enum([
  "lycee",
  "universite",
  "international",
]);
export const utilityRegionSchema = z.enum([
  "HT",
  "US",
  "CA",
  "FR",
  "DO",
  "RU",
  "Global",
]);

export const utilityCitationSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

export const extractedFactsSchema = z.object({
  deadlines: z
    .array(
      z.object({
        label: z.string().min(1),
        dateISO: isoDateString,
        sourceUrl: z.string().url(),
      }),
    )
    .optional(),
  requirements: z.array(z.string()).optional(),
  steps: z.array(z.string()).optional(),
  eligibility: z.array(z.string()).optional(),
  notes: z.array(z.string()).optional(),
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
  calendarHash: z.string().optional(),
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
  /** Real publisher URL extracted from Google News <source url="..."> tag */
  publisherUrl: z.string().url().nullable().optional(),
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
  vertical: z.enum(["news", "opportunites", "haiti", "world", "education", "business", "technology", "explainers", "bourses", "histoire", "succes"]).optional(),
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
  itemType: z.enum(["source", "synthesis", "utility", "opinion"]).optional(),
  clusterId: z.string().optional(),
  synthesisMeta: synthesisMetaSchema.optional(),
  utilityMeta: utilityMetaSchema.optional(),
  lastMajorUpdateAt: timestampSchema.nullable().optional(),
  effectiveDate: z.string().optional(),
  sourceList: z.array(synthesisSourceRefSchema).optional(),
  successTag: z.boolean().optional(),
  generationAttempts: z.number().int().nonnegative().optional(),
  authorSlug: z.string().optional(),
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
  category: z
    .enum([
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
    ])
    .optional(),
  qualityFlags: qualityFlagsSchema.optional(),
  citations: z.array(citationSchema).min(1),
  // v2 fields
  sections: z.array(contentSectionSchema).optional(),
  whatChanged: z.string().optional(),
  synthesisTags: z.array(z.string()).optional(),
  sourceCitations: z.array(sourceCitationSchema).optional(),
  narrative: z.string().nullable().optional(),
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
export {
  citationSchema,
  contentSectionSchema,
  entityRefSchema,
  geoTagSchema,
  imageAttributionSchema,
  imageMetaSchema,
  imageSourceSchema,
  itemSourceSchema,
  opportunitySchema,
  qualityFlagsSchema,
  sourceSelectorsSchema,
  synthesisMetaSchema,
  synthesisSourceRefSchema,
  timestampSchema,
};

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

// ── Inferred types for create payloads ─────────────────────────────────────
export type CreateSource = z.infer<typeof createSourceSchema>;
export type CreateRawItem = z.infer<typeof createRawItemSchema>;
export type CreateItem = z.infer<typeof createItemSchema>;
export type CreateContentVersion = z.infer<typeof createContentVersionSchema>;
export type CreateAsset = z.infer<typeof createAssetSchema>;
export type CreatePublishQueueEntry = z.infer<
  typeof createPublishQueueEntrySchema
>;
export type CreateMetric = z.infer<typeof createMetricSchema>;
export type CreateUtilitySource = z.infer<typeof createUtilitySourceSchema>;
export type CreateUtilityQueueEntry = z.infer<
  typeof createUtilityQueueEntrySchema
>;

// ══════════════════════════════════════════════════════════════════════════════
// ── Student Intelligence Platform — dataset schemas ─────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export const datasetCountrySchema = z.enum([
  "US",
  "CA",
  "FR",
  "UK",
  "DO",
  "MX",
  "CN",
  "RU",
  "HT",
  "Global",
]);

export const academicLevelSchema = z.enum([
  "bachelor",
  "master",
  "phd",
  "short_programs",
]);

export const tuitionBandSchema = z.enum(["low", "medium", "high", "unknown"]);

export const datasetCitationSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
});

export const datasetDeadlineSchema = z.object({
  label: z.string().min(1),
  monthRange: z.string().optional(),
  dateISO: isoDateString.optional(),
  sourceUrl: z.string().url(),
});

// ── universities ───────────────────────────────────────────────────────────

const universityRequirementsSchema = z.object({
  englishTests: z.array(z.string()).optional(),
  frenchTests: z.array(z.string()).optional(),
  applicationPlatform: z.string().optional(),
});

export const universitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: datasetCountrySchema,
  city: z.string().optional(),
  languages: z.array(z.string()).optional(),
  levelSupport: z.array(academicLevelSchema).optional(),
  tuitionBand: tuitionBandSchema.optional(),
  admissionsUrl: z.string().url(),
  internationalAdmissionsUrl: z.string().url().optional(),
  scholarshipUrl: z.string().url().optional(),
  requirements: universityRequirementsSchema.optional(),
  typicalDeadlines: z.array(datasetDeadlineSchema).optional(),
  haitianFriendly: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  sources: z.array(datasetCitationSchema).min(1),
  verifiedAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ── scholarships ───────────────────────────────────────────────────────────

export const scholarshipKindSchema = z.enum(["program", "directory"]);

export const scholarshipHaitianEligibilitySchema = z.enum([
  "yes",
  "no",
  "unknown",
]);

export const scholarshipDeadlineAccuracySchema = z.enum([
  "exact",
  "month-only",
  "varies",
  "unknown",
]);

export const scholarshipFundingTypeSchema = z.enum([
  "full",
  "partial",
  "stipend",
  "tuition-only",
  "unknown",
]);

const scholarshipDeadlineSchema = z.object({
  dateISO: isoDateString.optional(),
  month: z.number().int().min(1).max(12).optional(),
  notes: z.string().optional(),
  sourceUrl: z.string().url(),
});

const scholarshipImageSchema = z.object({
  url: z.string().url(),
  caption: z.string().optional(),
  credit: z.string().optional(),
});

const scholarshipApplicationStepSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  url: z.string().url().optional(),
});

const scholarshipSubProgramSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  level: z.array(academicLevelSchema).optional(),
  eligibility: z.string().optional(),
  url: z.string().url().optional(),
  relatedPagePath: z.string().startsWith("/").optional(),
});

const scholarshipKeyDateSchema = z.object({
  label: z.string().min(1),
  dateISO: isoDateString.optional(),
  monthRange: z.string().optional(),
  notes: z.string().optional(),
});

export const scholarshipSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: datasetCountrySchema,
  eligibleCountries: z.array(z.string()).optional(),
  level: z.array(academicLevelSchema).min(1),
  fundingType: scholarshipFundingTypeSchema,
  kind: scholarshipKindSchema.optional(),
  haitianEligibility: scholarshipHaitianEligibilitySchema.optional(),
  deadlineAccuracy: scholarshipDeadlineAccuracySchema.optional(),
  deadline: scholarshipDeadlineSchema.optional(),
  officialUrl: z.string().url(),
  howToApplyUrl: z.string().url().optional(),
  requirements: z.array(z.string()).optional(),
  eligibilitySummary: z.string().optional(),
  recurring: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  sources: z.array(datasetCitationSchema).min(1),
  // Rich detail-page fields (all optional)
  heroImageUrl: z.string().url().optional(),
  gallery: z.array(scholarshipImageSchema).optional(),
  programDescription: z.string().optional(),
  applicationSteps: z.array(scholarshipApplicationStepSchema).optional(),
  subPrograms: z.array(scholarshipSubProgramSchema).optional(),
  relatedPagePath: z.string().startsWith("/").optional(),
  keyDates: z.array(scholarshipKeyDateSchema).optional(),
  verifiedAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ── haiti_education_calendar ───────────────────────────────────────────────

export const calendarEventTypeSchema = z.enum([
  "rentree",
  "registration",
  "exam",
  "results",
  "admissions",
  "closure",
]);

export const calendarLevelSchema = z.enum([
  "ns1",
  "ns2",
  "ns3",
  "ns4",
  "bac",
  "university",
  "general",
]);

export const haitiCalendarEventSchema = z.object({
  id: z.string().min(1),
  institution: z.string().min(1),
  eventType: calendarEventTypeSchema,
  level: z.array(calendarLevelSchema).min(1),
  title: z.string().min(1),
  startDateISO: isoDateString.optional(),
  endDateISO: isoDateString.optional(),
  dateISO: isoDateString.optional(),
  location: z.string().optional(),
  officialUrl: z.string().url(),
  notes: z.string().optional(),
  sources: z.array(datasetCitationSchema).min(1),
  verifiedAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ── pathways ───────────────────────────────────────────────────────────────

export const pathwayGoalKeySchema = z.enum([
  "study_abroad",
  "career",
  "scholarship",
  "haiti_calendar",
]);

const pathwayStepSchema = z.object({
  title_fr: z.string().min(1),
  title_ht: z.string().min(1),
  description_fr: z.string().min(1),
  description_ht: z.string().min(1),
  links: z.array(datasetCitationSchema),
});

export const pathwaySchema = z.object({
  id: z.string().min(1),
  title_fr: z.string().min(1),
  title_ht: z.string().min(1),
  goalKey: pathwayGoalKeySchema,
  country: datasetCountrySchema.optional(),
  steps: z.array(pathwayStepSchema).min(1),
  recommendedUniversityIds: z.array(z.string()).optional(),
  recommendedScholarshipIds: z.array(z.string()).optional(),
  sources: z.array(datasetCitationSchema).min(1),
  updatedAt: timestampSchema,
});

// ── dataset_jobs ───────────────────────────────────────────────────────────

export const datasetNameSchema = z.enum([
  "universities",
  "scholarships",
  "haiti_calendar",
  "pathways",
  "haiti_history_almanac",
  "haiti_holidays",
]);

export const datasetJobSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["queued", "processing", "done", "failed"]),
  dataset: datasetNameSchema,
  runAt: timestampSchema,
  attempts: z.number().int().min(0),
  sourceIds: z.array(z.string()).optional(),
  targetId: z.string().optional(),
  lastError: z.string().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ── contributor_profiles ───────────────────────────────────────────────────

export const contributorRoleSchema = z.enum(["intern", "editor", "admin"]);

export const contributorSocialLinksSchema = z.object({
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  website: z.string().url().optional(),
});

export const contributorProfileSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  displayName: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional(),
  role: contributorRoleSchema,
  verified: z.boolean(),
  bio: z.string().optional(),
  photoUrl: z.string().url().optional(),
  socialLinks: contributorSocialLinksSchema.optional(),
  payoutRate: z.number().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ── drafts ─────────────────────────────────────────────────────────────────

export const draftStatusSchema = z.enum([
  "draft",
  "submitted",
  "approved",
  "rejected",
]);

export const draftSchema = z.object({
  id: z.string().min(1),
  authorId: z.string().min(1),
  title_fr: z.string().min(1),
  body_fr: z.string().min(1),
  title_ht: z.string().optional(),
  body_ht: z.string().optional(),
  series: utilitySeriesSchema.optional(),
  status: draftStatusSchema,
  citations: z.array(datasetCitationSchema),
  reviewNote: z.string().optional(),
  payoutDue: z.number().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

// ── Create schemas for datasets ────────────────────────────────────────────

export const createUniversitySchema = universitySchema.omit({
  id: true,
  verifiedAt: true,
  updatedAt: true,
});

export const createScholarshipSchema = scholarshipSchema.omit({
  id: true,
  verifiedAt: true,
  updatedAt: true,
});

export const createHaitiCalendarEventSchema = haitiCalendarEventSchema.omit({
  id: true,
  verifiedAt: true,
  updatedAt: true,
});

export const createPathwaySchema = pathwaySchema.omit({
  id: true,
  updatedAt: true,
});

export const createDatasetJobSchema = datasetJobSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createContributorProfileSchema = contributorProfileSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const createDraftSchema = draftSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ── haiti_history_almanac ──────────────────────────────────────────────────

export const almanacConfidenceSchema = z.enum(["high", "medium"]);
export const almanacCreatedBySchema = z.enum([
  "seed",
  "admin",
  "intern",
  "import",
]);
export const almanacTagSchema = z.enum([
  "independence",
  "culture",
  "education",
  "politics",
  "science",
  "military",
  "economy",
  "literature",
  "art",
  "religion",
  "sports",
  "disaster",
  "diplomacy",
  "resistance",
  "revolution",
]);

export const haitiHistoryAlmanacEntrySchema = z.object({
  id: z.string().min(1),
  monthDay: z.string().regex(/^\d{2}-\d{2}$/, "Expected MM-DD"),
  year: z.number().int().nullable().optional(),
  title_fr: z.string().min(1),
  summary_fr: z.string().min(1),
  student_takeaway_fr: z.string().min(1),
  tags: z.array(almanacTagSchema).optional(),
  illustration: z
    .object({
      imageUrl: z.string().url(),
      pageUrl: z.string().url(),
      pageTitle: z.string().optional(),
      provider: z.enum(["wikimedia_commons", "manual", "gemini_ai"]).optional(),
      author: z.string().optional(),
      license: z.string().optional(),
      confidence: z.number().min(0).max(1).optional(),
    })
    .optional(),
  sources: z.array(datasetCitationSchema).min(1),
  confidence: almanacConfidenceSchema,
  createdBy: almanacCreatedBySchema,
  verifiedAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createHaitiHistoryAlmanacEntrySchema =
  haitiHistoryAlmanacEntrySchema.omit({
    id: true,
    verifiedAt: true,
    updatedAt: true,
  });

export type CreateHaitiHistoryAlmanacEntry = z.infer<
  typeof createHaitiHistoryAlmanacEntrySchema
>;

// ── haiti_holidays ─────────────────────────────────────────────────────────

export const haitiHolidaySchema = z.object({
  id: z.string().min(1),
  monthDay: z.string().regex(/^\d{2}-\d{2}$/, "Expected MM-DD"),
  name_fr: z.string().min(1),
  name_ht: z.string().min(1),
  description_fr: z.string().optional(),
  description_ht: z.string().optional(),
  isNationalHoliday: z.boolean().optional(),
  sources: z.array(datasetCitationSchema).min(1),
  verifiedAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createHaitiHolidaySchema = haitiHolidaySchema.omit({
  id: true,
  verifiedAt: true,
  updatedAt: true,
});

export type CreateHaitiHoliday = z.infer<typeof createHaitiHolidaySchema>;

// ── history_publish_log ────────────────────────────────────────────────────

export const historyPublishLogSchema = z.object({
  id: z.string().min(1),
  dateISO: isoDateString,
  publishedItemId: z.string().optional(),
  almanacEntryIds: z.array(z.string()),
  holidayId: z.string().optional(),
  status: z.enum(["done", "skipped", "failed"]),
  error: z.string().optional(),
  validationWarnings: z.array(z.string()).optional(),
  validationErrors: z.array(z.string()).optional(),
  createdAt: timestampSchema,
});

// ── haiti_history_almanac_raw ───────────────────────────────────────────────

export const almanacRawCategorySchema = z.enum([
  "political",
  "education",
  "culture",
  "international",
  "economy",
  "social",
  "science",
  "birth",
  "death",
]);

export const almanacRawSourceTypeSchema = z.enum([
  "government",
  "academic",
  "institutional",
  "press",
  "reference",
]);

export const almanacRawVerificationStatusSchema = z.enum([
  "unverified",
  "verified",
]);

export const almanacRawSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
});

export const haitiHistoryAlmanacRawSchema = z.object({
  id: z.string().min(1),
  monthDay: z.string().regex(/^\d{2}-\d{2}$/, "Expected MM-DD"),
  year: z.number().int(),
  title: z.string().min(1),
  shortSummary: z.string().min(1),
  category: almanacRawCategorySchema,
  sourcePrimary: almanacRawSourceSchema,
  sourceSecondary: almanacRawSourceSchema.optional(),
  sourceType: almanacRawSourceTypeSchema,
  verificationStatus: almanacRawVerificationStatusSchema,
  createdAt: timestampSchema,
});

export const createHaitiHistoryAlmanacRawSchema =
  haitiHistoryAlmanacRawSchema.omit({
    id: true,
    createdAt: true,
  });

export type CreateHaitiHistoryAlmanacRaw = z.infer<
  typeof createHaitiHistoryAlmanacRawSchema
>;

// ── Instagram pipeline schemas ─────────────────────────────────────────────

export const igPostTypeSchema = z.enum([
  "scholarship",
  "opportunity",
  "news",
  "histoire",
  "utility",
  "taux",
  "breaking",
  "stat",
]);

export const igQueueStatusSchema = z.enum([
  "queued",
  "scheduled",
  "rendering",
  "posted",
  "skipped",
  "expired",
  "scheduled_ready_for_manual",
]);

export const igDecisionSchema = z.object({
  igEligible: z.boolean(),
  igType: igPostTypeSchema.nullable(),
  igPriorityScore: z.number().min(0).max(100),
  reasons: z.array(z.string()),
  igPostAfter: z.string().optional(),
  igExpiresAt: z.string().optional(),
});

export const igSlideLayoutSchema = z.enum(["headline", "explanation", "data", "cta"]);

export const igSlideSchema = z.object({
  heading: z.string().min(1),
  bullets: z.array(z.string()),
  footer: z.string().optional(),
  backgroundImage: z.string().url().optional(),
  layout: igSlideLayoutSchema.optional(),
  statValue: z.string().optional(),
  statDescription: z.string().optional(),
});

export const igMemeTemplateSchema = z.enum([
  "drake",
  "expanding-brain",
  "distracted",
  "starter-pack",
  "two-buttons",
  "tell-me",
  "nobody",
  "reaction",
  "comparison",
]);

export const igMemePanelSchema = z.object({
  text: z.string().min(1),
  emoji: z.string().optional(),
});

export const igMemeSlideSchema = z.object({
  template: igMemeTemplateSchema,
  panels: z.array(igMemePanelSchema).min(2).max(4),
  topicLine: z.string().optional(),
  tone: z.enum(["witty", "wholesome", "ironic", "hype"]),
});

export const igFormattedPayloadSchema = z.object({
  slides: z.array(igSlideSchema).min(1),
  caption: z.string().min(1),
  memeSlide: igMemeSlideSchema.optional(),
});

export const igQueueItemSchema = z.object({
  id: z.string().min(1),
  sourceContentId: z.string().min(1),
  igType: igPostTypeSchema,
  score: z.number().min(0).max(100),
  status: igQueueStatusSchema,
  scheduledFor: z.string().optional(),
  targetPostDate: z.string().optional(),
  queuedDate: z.string().optional(),
  renderRetries: z.number().int().min(0).optional(),
  igPostId: z.string().optional(),
  reasons: z.array(z.string()),
  payload: igFormattedPayloadSchema.optional(),
  dryRunPath: z.string().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createIGQueueItemSchema = igQueueItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateIGQueueItem = z.infer<typeof createIGQueueItemSchema>;

// ── IG Story schemas ───────────────────────────────────────────────────────

export const igStoryQueueStatusSchema = z.enum([
  "queued",
  "rendering",
  "posted",
  "skipped",
  "failed",
]);

export const igStorySlideSchema = z.object({
  heading: z.string().min(1),
  bullets: z.array(z.string()),
  eyebrow: z.string().optional(),
  subheading: z.string().optional(),
  meta: z.array(z.string()).optional(),
  footer: z.string().optional(),
  backgroundImage: z.string().optional(),
  accent: z.string().optional(),
  frameType: z
    .enum(["cover", "taux", "facts", "headline", "history", "cta"])
    .optional(),
});

export const igStoryPayloadSchema = z.object({
  slides: z.array(igStorySlideSchema).min(1).max(8),
  dateLabel: z.string().min(1),
});

export const igStoryQueueItemSchema = z.object({
  id: z.string().min(1),
  dateKey: z.string().min(1),
  status: igStoryQueueStatusSchema,
  sourceItemIds: z.array(z.string()),
  igMediaId: z.string().optional(),
  payload: igStoryPayloadSchema.optional(),
  error: z.string().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createIGStoryQueueItemSchema = igStoryQueueItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateIGStoryQueueItem = z.infer<
  typeof createIGStoryQueueItemSchema
>;

// ── WhatsApp pipeline schemas ──────────────────────────────────────────────

export const waQueueStatusSchema = z.enum([
  "queued",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "skipped",
]);

export const waMessagePayloadSchema = z.object({
  text: z.string().min(1),
  imageUrl: z.string().url().optional(),
  linkUrl: z.string().url().optional(),
});

export const waQueueItemSchema = z.object({
  id: z.string().min(1),
  sourceContentId: z.string().min(1),
  score: z.number().min(0).max(100),
  status: waQueueStatusSchema,
  scheduledFor: z.string().optional(),
  queuedDate: z.string().optional(),
  sendRetries: z.number().int().min(0).optional(),
  waMessageId: z.string().optional(),
  reasons: z.array(z.string()),
  payload: waMessagePayloadSchema.optional(),
  error: z.string().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createWaQueueItemSchema = waQueueItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateWaQueueItem = z.infer<typeof createWaQueueItemSchema>;

// ── Facebook pipeline schemas ──────────────────────────────────────────────

export const fbQueueStatusSchema = z.enum([
  "queued",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "skipped",
]);

export const fbMessagePayloadSchema = z.object({
  text: z.string().min(1),
  linkUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
});

export const fbQueueItemSchema = z.object({
  id: z.string().min(1),
  sourceContentId: z.string().min(1),
  score: z.number().min(0).max(100),
  status: fbQueueStatusSchema,
  scheduledFor: z.string().optional(),
  queuedDate: z.string().optional(),
  sendRetries: z.number().int().min(0).optional(),
  fbPostId: z.string().optional(),
  reasons: z.array(z.string()),
  payload: fbMessagePayloadSchema.optional(),
  error: z.string().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createFbQueueItemSchema = fbQueueItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateFbQueueItem = z.infer<typeof createFbQueueItemSchema>;

// ── Threads pipeline schemas ───────────────────────────────────────────────

export const thQueueStatusSchema = z.enum([
  "queued",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "skipped",
]);

export const thMessagePayloadSchema = z.object({
  text: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

export const thQueueItemSchema = z.object({
  id: z.string().min(1),
  sourceContentId: z.string().min(1),
  score: z.number().min(0).max(100),
  status: thQueueStatusSchema,
  scheduledFor: z.string().optional(),
  queuedDate: z.string().optional(),
  sendRetries: z.number().int().min(0).optional(),
  thPostId: z.string().optional(),
  reasons: z.array(z.string()),
  payload: thMessagePayloadSchema.optional(),
  error: z.string().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createThQueueItemSchema = thQueueItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateThQueueItem = z.infer<typeof createThQueueItemSchema>;

// ── X (Twitter) pipeline schemas ───────────────────────────────────────────

export const xQueueStatusSchema = z.enum([
  "queued",
  "scheduled",
  "sending",
  "sent",
  "failed",
  "skipped",
]);

export const xMessagePayloadSchema = z.object({
  text: z.string().min(1),
});

export const xQueueItemSchema = z.object({
  id: z.string().min(1),
  sourceContentId: z.string().min(1),
  score: z.number().min(0).max(100),
  status: xQueueStatusSchema,
  scheduledFor: z.string().optional(),
  queuedDate: z.string().optional(),
  sendRetries: z.number().int().min(0).optional(),
  xTweetId: z.string().optional(),
  reasons: z.array(z.string()),
  payload: xMessagePayloadSchema.optional(),
  error: z.string().optional(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createXQueueItemSchema = xQueueItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateXQueueItem = z.infer<typeof createXQueueItemSchema>;

// ── Inferred create types for datasets ─────────────────────────────────────

export type CreateUniversity = z.infer<typeof createUniversitySchema>;
export type CreateScholarship = z.infer<typeof createScholarshipSchema>;
export type CreateHaitiCalendarEvent = z.infer<
  typeof createHaitiCalendarEventSchema
>;
export type CreatePathway = z.infer<typeof createPathwaySchema>;
export type CreateDatasetJob = z.infer<typeof createDatasetJobSchema>;
export type CreateContributorProfile = z.infer<
  typeof createContributorProfileSchema
>;
export type CreateDraft = z.infer<typeof createDraftSchema>;
