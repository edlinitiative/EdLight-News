import { Timestamp } from "firebase-admin/firestore";

// ── Firestore collection: sources ──────────────────────────────────────────
export type SourceType = "rss" | "html";
export type SourcePriority = "hot" | "normal";

export interface SourceSelectors {
  /** CSS selector for the list of article links on index pages */
  listItem?: string;
  /** CSS selector for the main content area of an article */
  articleBody?: string;
  /** CSS selector for article title (fallback: <h1>) */
  title?: string;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  type: SourceType;
  /** CSS selector used for HTML scraping (only for type=html) — legacy */
  selector?: string;
  /** Structured selectors for fine-grained scraping */
  selectors?: SourceSelectors;
  language: "fr" | "ht";
  active: boolean;
  /** Seconds between polls (default 3600 = 1h) */
  pollCadenceSec: number;
  /** Priority level for ordering in tick */
  priority: SourcePriority;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Firestore collection: raw_items ────────────────────────────────────────
export type RawItemStatus = "new" | "processed" | "skipped";

export interface RawItem {
  id: string;
  sourceId: string;
  /** SHA-256 hash of (canonicalUrl + title) for deduplication */
  hash: string;
  title: string;
  url: string;
  description: string;
  publishedAt: Timestamp | null;
  status: RawItemStatus;
  /** Reason for skipping, if status=skipped */
  skipReason?: string;
  createdAt: Timestamp;
}

// ── Shared enums & value objects ───────────────────────────────────────────
export type GeoTag = "HT" | "Diaspora" | "Global";

/** How the article image was obtained */
export type ImageSource = "publisher" | "wikidata" | "branded" | "screenshot";

/** Metadata about the article image */
export interface ImageMeta {
  width?: number;
  height?: number;
  /** ISO date when the image was fetched/generated */
  fetchedAt?: string;
  /** Original image URL from the publisher (before re-hosting) */
  originalImageUrl?: string;
}

/** Attribution for images that require credit (Wikidata, etc.) */
export interface ImageAttribution {
  name?: string;
  url?: string;
  license?: string;
}

/** Linked entity reference (e.g., public personality) */
export interface EntityRef {
  personName?: string;
  wikidataId?: string;
}

/** The original + aggregator source links */
export interface ItemSource {
  name: string;
  originalUrl: string;
  aggregatorUrl?: string;
}

/** Structured opportunity data (for Bourses / Ressources) */
export interface Opportunity {
  deadline?: string; // ISO date string
  eligibility?: string[];
  coverage?: string;
  howToApply?: string;
  officialLink?: string;
}

// ── Synthesis types ────────────────────────────────────────────────────────

export type ItemType = "source" | "synthesis" | "utility";

/** Denormalized reference to a source article included in a synthesis */
export interface SynthesisSourceRef {
  itemId: string;
  title: string;
  sourceName: string;
  publishedAt?: string; // ISO date string
}

/** Metadata about a synthesis (multi-source) article */
export interface SynthesisMeta {
  sourceItemIds: string[];
  sourceCount: number;
  publisherDomains: string[];
  model: string;
  promptVersion: string;
  validationPassed: boolean;
  lastSynthesizedAt: string; // ISO date string
}

// ── Utility types ──────────────────────────────────────────────────────────
export type UtilitySeries =
  | "StudyAbroad"
  | "Career"
  | "ScholarshipRadar"
  | "HaitiHistory"
  | "HaitiFactOfTheDay"
  | "HaitianOfTheWeek"
  | "HaitiEducationCalendar";

export type UtilityType =
  | "study_abroad"
  | "career"
  | "scholarship"
  | "opportunity"
  | "history"
  | "daily_fact"
  | "profile"
  | "school_calendar";

export type UtilityAudience = "lycee" | "universite" | "international";
export type UtilityRegion = "HT" | "US" | "CA" | "FR" | "DO" | "RU" | "Global";

export interface UtilityCitation {
  label: string;
  url: string;
}

export interface ExtractedFacts {
  deadlines?: { label: string; dateISO: string; sourceUrl: string }[];
  requirements?: string[];
  steps?: string[];
  eligibility?: string[];
  notes?: string[];
}

export interface UtilityMeta {
  series: UtilitySeries;
  utilityType: UtilityType;
  region?: UtilityRegion[];
  audience?: UtilityAudience[];
  tags?: string[];
  citations: UtilityCitation[];
  extractedFacts?: ExtractedFacts;
  rotationKey?: string;
  /** SHA-256 hash of sorted deadlines for cheap change detection (calendar series) */
  calendarHash?: string;
}

// ── Source citation (displayed at bottom of content) ──────────────────────
export interface SourceCitation {
  name: string;
  url: string;
}

// ── Firestore collection: utility_sources ─────────────────────────────────
export type UtilitySourceType = "rss" | "html" | "pdf" | "calendar";

export interface UtilitySourceParsingHints {
  selectorMain?: string;
  selectorDate?: string;
}

export interface UtilitySource {
  id: string;
  label: string;
  url: string;
  series: UtilitySeries;
  rotationKey?: string;
  type: UtilitySourceType;
  allowlistDomain: string;
  priority: number;
  region: UtilityRegion[];
  utilityTypes: UtilityType[];
  parsingHints?: UtilitySourceParsingHints;
  active: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Firestore collection: utility_queue ───────────────────────────────────
export type UtilityQueueStatus = "queued" | "processing" | "done" | "failed";

export interface UtilityQueueEntry {
  id: string;
  status: UtilityQueueStatus;
  series: UtilitySeries;
  rotationKey?: string;
  langTargets: ContentLanguage[];
  sourceIds: string[];
  runAt: Timestamp;
  attempts: number;
  lastError?: string;
  failReasons?: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Quality flags (shared across items + content_versions) ─────────────────
export interface QualityFlags {
  hasSourceUrl: boolean;
  needsReview: boolean;
  lowConfidence: boolean;
  /** Source could not be traced to original publisher */
  weakSource?: boolean;
  /** Bourses item without a deadline */
  missingDeadline?: boolean;
  /** Content deemed off-mission for student audience */
  offMission?: boolean;
  reasons: string[];
}

// ── Firestore collection: items ────────────────────────────────────────────
export type ItemCategory =
  | "scholarship"
  | "opportunity"
  | "news"
  | "event"
  | "resource"
  | "local_news"
  | "bourses"
  | "concours"
  | "stages"
  | "programmes";

export interface Item {
  id: string;
  rawItemId: string;
  sourceId: string;
  title: string;
  summary: string;
  /** The original article URL */
  canonicalUrl: string;
  /** Full extracted article text */
  extractedText?: string | null;
  category: ItemCategory;
  /** ISO date string for deadline; null if evergreen */
  deadline: string | null;
  evergreen: boolean;
  confidence: number; // 0-1 scale
  qualityFlags: QualityFlags;
  citations: Citation[];

  // ── New v2 fields (optional for backwards compat) ─────────────────────
  /** High-level content vertical (e.g. "opportunites") */
  vertical?: string;
  /** Geographic relevance tag */
  geoTag?: GeoTag;
  /** 0-1 audience-fit score for auto-publish gating */
  audienceFitScore?: number;
  /** SHA-256 hash for dedup clustering (normalizedTitle + domain) */
  dedupeGroupId?: string;
  /** Structured source provenance */
  source?: ItemSource;
  /** Structured opportunity data (Bourses / Ressources) */
  opportunity?: Opportunity;
  /** When the original article was published */
  publishedAt?: Timestamp | null;

  // ── Image fields (optional for backwards compat) ──────────────────────
  /** Public URL of the article image (Firebase Storage or publisher CDN) */
  imageUrl?: string | null;
  /** How the image was obtained */
  imageSource?: ImageSource;
  /** 0-1 confidence that the image is relevant/correct */
  imageConfidence?: number;
  /** Image metadata */
  imageMeta?: ImageMeta;
  /** Attribution for images that require credit */
  imageAttribution?: ImageAttribution;
  /** Linked entity (e.g., person detected in title) */
  entity?: EntityRef;

  // ── Synthesis fields (only for itemType="synthesis") ──────────────────
  /** "source" (default), "synthesis", or "utility" (student-focused original content) */
  itemType?: ItemType;
  /** Utility content metadata (only for itemType="utility") */
  utilityMeta?: UtilityMeta;
  /** Cluster identifier (= dedupeGroupId of source items) */
  clusterId?: string;
  /** Synthesis metadata: sources, model, validation */
  synthesisMeta?: SynthesisMeta;
  /** When the synthesis was last meaningfully updated */
  lastMajorUpdateAt?: Timestamp | null;
  /** Latest publishedAt among source items (ISO string) */
  effectiveDate?: string;
  /** Denormalized list of source article references */
  sourceList?: SynthesisSourceRef[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Citation {
  sourceName: string;
  sourceUrl: string;
}

// ── Firestore collection: content_versions ─────────────────────────────────
export type ContentChannel = "web" | "ig" | "wa";
export type ContentLanguage = "fr" | "ht";
export type ContentStatus = "draft" | "review" | "published";

/** Structured body section for rich rendering */
export interface ContentSection {
  heading: string;
  content: string;
}

export interface ContentVersion {
  id: string;
  itemId: string;
  channel: ContentChannel;
  language: ContentLanguage;
  title: string;
  summary: string;
  body: string;
  status: ContentStatus;
  /** Reason if auto-drafted instead of published */
  draftReason?: string;
  /** Denormalized from parent item for filtering */
  category?: ItemCategory;
  qualityFlags?: QualityFlags;
  citations: Citation[];

  // ── New v2 fields ─────────────────────────────────────────────────────
  /** Structured body sections for richer rendering */
  sections?: ContentSection[];
  /** Editorial note about what changed (synthesis only) */
  whatChanged?: string;
  /** Status tags: "confirmed", "unconfirmed", "evolving" (synthesis only) */
  synthesisTags?: string[];
  /** Source citations displayed at bottom of content (utility posts) */
  sourceCitations?: SourceCitation[];

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Firestore collection: assets ───────────────────────────────────────────
export type AssetType = "carousel_image" | "story_image";

export interface Asset {
  id: string;
  contentVersionId: string;
  type: AssetType;
  /** GCS or public URL */
  url: string;
  width: number;
  height: number;
  createdAt: Timestamp;
}

// ── Firestore collection: publish_queue ────────────────────────────────────
export type PublishTarget = "ig" | "wa";
export type PublishStatus = "pending" | "in_progress" | "done" | "failed";

export interface PublishQueueEntry {
  id: string;
  contentVersionId: string;
  target: PublishTarget;
  status: PublishStatus;
  scheduledAt: Timestamp;
  attemptCount: number;
  lastError?: string;
  completedAt?: Timestamp;
  createdAt: Timestamp;
}

// ── Firestore collection: metrics ──────────────────────────────────────────
export interface Metric {
  id: string;
  contentVersionId: string;
  channel: ContentChannel;
  views: number;
  clicks: number;
  shares: number;
  recordedAt: Timestamp;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Student Intelligence Platform — structured datasets ─────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// ── Shared enums for datasets ──────────────────────────────────────────────

export type DatasetCountry =
  | "US" | "CA" | "FR" | "UK" | "DO" | "MX" | "CN" | "RU" | "HT" | "Global";

export type AcademicLevel = "bachelor" | "master" | "phd" | "short_programs";

export type TuitionBand = "low" | "medium" | "high" | "unknown";

/** Reusable citation for structured records */
export interface DatasetCitation {
  label: string;
  url: string;
}

/** Reusable deadline entry with required sourceUrl */
export interface DatasetDeadline {
  label: string;
  monthRange?: string;
  dateISO?: string;
  sourceUrl: string;
}

// ── Firestore collection: universities ─────────────────────────────────────

export interface UniversityRequirements {
  englishTests?: string[];
  frenchTests?: string[];
  applicationPlatform?: string;
}

export interface University {
  id: string;
  name: string;
  country: DatasetCountry;
  city?: string;
  languages?: string[];
  levelSupport?: AcademicLevel[];
  tuitionBand?: TuitionBand;
  admissionsUrl: string;
  internationalAdmissionsUrl?: string;
  scholarshipUrl?: string;
  requirements?: UniversityRequirements;
  typicalDeadlines?: DatasetDeadline[];
  haitianFriendly?: boolean;
  tags?: string[];
  sources: DatasetCitation[];
  verifiedAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Firestore collection: scholarships ─────────────────────────────────────

export type ScholarshipFundingType =
  | "full" | "partial" | "stipend" | "tuition-only" | "unknown";

export interface ScholarshipDeadline {
  dateISO?: string;
  month?: number;
  notes?: string;
  sourceUrl: string;
}

export interface Scholarship {
  id: string;
  name: string;
  country: DatasetCountry;
  eligibleCountries?: string[];
  level: AcademicLevel[];
  fundingType: ScholarshipFundingType;
  deadline?: ScholarshipDeadline;
  officialUrl: string;
  howToApplyUrl?: string;
  requirements?: string[];
  eligibilitySummary?: string;
  recurring?: boolean;
  tags?: string[];
  sources: DatasetCitation[];
  verifiedAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Firestore collection: haiti_education_calendar ─────────────────────────

export type CalendarEventType =
  | "rentree" | "registration" | "exam" | "results" | "admissions" | "closure";

export type CalendarLevel =
  | "ns1" | "ns2" | "ns3" | "ns4" | "bac" | "university" | "general";

export interface HaitiCalendarEvent {
  id: string;
  institution: string;
  eventType: CalendarEventType;
  level: CalendarLevel[];
  title: string;
  startDateISO?: string;
  endDateISO?: string;
  dateISO?: string;
  location?: string;
  officialUrl: string;
  notes?: string;
  sources: DatasetCitation[];
  verifiedAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Firestore collection: pathways ─────────────────────────────────────────

export type PathwayGoalKey =
  | "study_abroad" | "career" | "scholarship" | "haiti_calendar";

export interface PathwayStep {
  title_fr: string;
  title_ht: string;
  description_fr: string;
  description_ht: string;
  links: DatasetCitation[];
}

export interface Pathway {
  id: string;
  title_fr: string;
  title_ht: string;
  goalKey: PathwayGoalKey;
  country?: DatasetCountry;
  steps: PathwayStep[];
  recommendedUniversityIds?: string[];
  recommendedScholarshipIds?: string[];
  sources: DatasetCitation[];
  updatedAt: Timestamp;
}

// ── Firestore collection: dataset_jobs ─────────────────────────────────────

export type DatasetName =
  | "universities" | "scholarships" | "haiti_calendar" | "pathways";

export type DatasetJobStatus = "queued" | "processing" | "done" | "failed";

export interface DatasetJob {
  id: string;
  status: DatasetJobStatus;
  dataset: DatasetName;
  runAt: Timestamp;
  attempts: number;
  sourceIds?: string[];
  targetId?: string;
  lastError?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Firestore collection: contributor_profiles ─────────────────────────────

export type ContributorRole = "intern" | "editor" | "admin";

export interface ContributorProfile {
  id: string;
  name: string;
  email?: string;
  role: ContributorRole;
  verified: boolean;
  payoutRate?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Firestore collection: drafts ───────────────────────────────────────────

export type DraftStatus = "draft" | "submitted" | "approved" | "rejected";

export interface Draft {
  id: string;
  authorId: string;
  title_fr: string;
  body_fr: string;
  title_ht?: string;
  body_ht?: string;
  series?: UtilitySeries;
  status: DraftStatus;
  citations: DatasetCitation[];
  reviewNote?: string;
  payoutDue?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
