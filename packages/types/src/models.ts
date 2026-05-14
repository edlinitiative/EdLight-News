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
  /**
   * Whether the source's publisher images are safe to embed in IG posts.
   * When false, IG formatters skip the publisher backgroundImage and use
   * a free-licensed alternative (Commons/Flickr) or the branded gradient.
   * Defaults to true when absent.
   */
  igImageSafe?: boolean;
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
  /** Real publisher URL extracted from Google News <source url="..."> tag. */
  publisherUrl?: string | null;
  status: RawItemStatus;
  /** Reason for skipping, if status=skipped */
  skipReason?: string;
  createdAt: Timestamp;
}

// ── Shared enums & value objects ───────────────────────────────────────────
export type GeoTag = "HT" | "Diaspora" | "Global";

/** How the article image was obtained */
export type ImageSource =
  | "publisher"
  | "wikidata"
  | "branded"
  | "screenshot"
  | "commons"
  | "gemini_ai";

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

/** Structured opportunity data (for Bourses / Ressources)
 *
 *  All fields are optional and additive — older Items without these
 *  enrichments keep working unchanged. The wider taxonomy fields
 *  (kind, audience, fundingType, locationType, haitiEligible, lifecycle,
 *  trustTier, applicationSteps) are populated by the deterministic
 *  classifier (`apps/worker/src/services/classify.ts` + the inference
 *  helpers in `@edlight-news/generator/opportunityTaxonomy`). They power
 *  the /opportunites filter UI and the admin review queue without
 *  requiring a new Firestore collection — the broad `category` enum on
 *  the Item still acts as the index key.
 */
export interface Opportunity {
  deadline?: string; // ISO date string
  eligibility?: string[];
  coverage?: string;
  howToApply?: string;
  officialLink?: string;

  // ── Wider taxonomy (v3 — additive, all optional) ─────────────────────
  /** Fine-grained opportunity kind (22 possible values — see
   *  `OpportunityKind` in @edlight-news/generator). */
  kind?: string;
  /** Audiences this opportunity targets (multi-label). */
  audience?: string[];
  /** "fully_funded" | "partially_funded" | "paid" | "free" | "unclear" */
  fundingType?: string;
  /** "online" | "in_person" | "hybrid" | "unclear" */
  locationType?: string;
  /** "yes" | "no" | "unclear" — does the eligibility text accept Haiti? */
  haitiEligible?: string;
  /** Free-form ISO list of regions / countries open to applicants. */
  eligibleRegions?: string[];
  /** Computed deadline-driven status — refreshed at read time too. */
  lifecycle?: string;
  /** Source provenance tier — "official" | "aggregator" | "media" | "social". */
  trustTier?: string;
  /** Ordered application walkthrough steps (when extractable from text). */
  applicationSteps?: string[];
}

// ── Synthesis types ────────────────────────────────────────────────────────

export type ItemType = "source" | "synthesis" | "utility" | "opinion";

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
  | "ScholarshipRadarWeekly"
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
  /**
   * Confidence score (0-100) that this item is a real, actionable
   * opportunity. Computed by `scoreOpportunity()` in @edlight-news/generator
   * during ingest. Items with score < OPPORTUNITY_SCORE_THRESHOLD (50) are
   * NOT given vertical=opportunites, and the /opportunites page also gates
   * on this field for legacy items.
   */
  opportunityScore?: number;
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
  /** "source" (default), "synthesis", "utility" (student-focused original content), or "opinion" (analysis / commentary) */
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

  /** Explicitly tagged as a success / achievement story */
  successTag?: boolean;

  /** Page view counter (incremented on article detail page load) */
  viewCount?: number;

  /** Number of failed Gemini generation attempts (for retry-limiting) */
  generationAttempts?: number;

  /**
   * Outcome of the auto-promotion of this opportunites item into the
   * structured `scholarships` collection.
   *  - "promoted" = a scholarship doc was created/updated from this item
   *  - "rejected" = LLM determined this is not a single applicable scholarship
   *  - "failed"   = transient error; will be retried up to scholarshipPromotionAttempts
   *  - undefined  = never evaluated yet
   */
  scholarshipPromotion?: "promoted" | "rejected" | "failed";
  /** Number of times we attempted to promote this item to scholarships (for retry-limiting). */
  scholarshipPromotionAttempts?: number;

  /** Slug of the contributor who authored this item (links to /auteur/[slug]) */
  authorSlug?: string;

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
  /** Optional illustration image URL for this section */
  imageUrl?: string;
  /** Human-readable image caption */
  imageCaption?: string;
  /** Attribution / credit line (e.g. "Wikimedia Commons, CC BY-SA 4.0") */
  imageCredit?: string;
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
  /** Continuous narrative (4-6 sentences) for IG carousel slides */
  narrative?: string | null;

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

// ── Firestore collection: haiti_history_almanac ────────────────────────────

export type AlmanacConfidence = "high" | "medium";
export type AlmanacCreatedBy = "seed" | "admin" | "intern" | "import";
export type AlmanacTag =
  | "independence"
  | "culture"
  | "education"
  | "politics"
  | "science"
  | "military"
  | "economy"
  | "literature"
  | "art"
  | "religion"
  | "sports"
  | "disaster"
  | "diplomacy"
  | "resistance"
  | "revolution";

export interface HaitiHistoryAlmanacEntry {
  id: string;
  /** MM-DD (e.g. "02-22") */
  monthDay: string;
  /** Optional year; null for recurring or unspecified */
  year?: number | null;
  title_fr: string;
  /** Haitian Creole title — optional; falls back to title_fr when absent */
  title_ht?: string;
  summary_fr: string;
  /** Haitian Creole summary — optional; falls back to summary_fr when absent */
  summary_ht?: string;
  /** 1-sentence student takeaway */
  student_takeaway_fr: string;
  /** Haitian Creole takeaway — optional; falls back to student_takeaway_fr when absent */
  student_takeaway_ht?: string;
  tags?: AlmanacTag[];
  /** Optional historical illustration (stored server-side). */
  illustration?: {
    imageUrl: string;
    pageUrl: string;
    pageTitle?: string;
    provider?: "wikimedia_commons" | "manual" | "gemini_ai";
    author?: string;
    license?: string;
    /** 0-1 confidence that the illustration matches the fact. */
    confidence?: number;
  };
  sources: DatasetCitation[];
  confidence: AlmanacConfidence;
  createdBy: AlmanacCreatedBy;
  verifiedAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Firestore collection: haiti_holidays ───────────────────────────────────

export interface HaitiHoliday {
  id: string;
  /** MM-DD */
  monthDay: string;
  name_fr: string;
  name_ht: string;
  description_fr?: string;
  description_ht?: string;
  isNationalHoliday?: boolean;
  sources: DatasetCitation[];
  verifiedAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Firestore collection: history_publish_log ──────────────────────────────

export type HistoryPublishStatus = "done" | "skipped" | "failed";

export interface HistoryPublishLog {
  id: string;
  /** YYYY-MM-DD */
  dateISO: string;
  publishedItemId?: string;
  almanacEntryIds: string[];
  holidayId?: string;
  status: HistoryPublishStatus;
  error?: string;
  /** Validation warnings logged during publish (not user-facing) */
  validationWarnings?: string[];
  /** Validation errors that blocked publishing */
  validationErrors?: string[];
  createdAt: Timestamp;
}

// ── Firestore collection: haiti_history_almanac_raw ────────────────────────

export type AlmanacRawCategory =
  | "political"
  | "education"
  | "culture"
  | "international"
  | "economy"
  | "social"
  | "science"
  | "birth"
  | "death";

export type AlmanacRawSourceType =
  | "government"
  | "academic"
  | "institutional"
  | "press"
  | "reference";

export type AlmanacRawVerificationStatus = "unverified" | "verified";

export interface AlmanacRawSource {
  name: string;
  url: string;
}

export interface HaitiHistoryAlmanacRaw {
  id: string;
  /** MM-DD (e.g. "02-23") */
  monthDay: string;
  year: number;
  title: string;
  shortSummary: string;
  category: AlmanacRawCategory;
  sourcePrimary: AlmanacRawSource;
  sourceSecondary?: AlmanacRawSource;
  sourceType: AlmanacRawSourceType;
  verificationStatus: AlmanacRawVerificationStatus;
  createdAt: Timestamp;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Instagram pipeline types ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export type IGPostType =
  | "scholarship"
  | "opportunity"
  | "news"
  | "histoire"
  | "utility"
  | "taux"
  /** Single-slide breaking news (MASTER_PROMPT T1) — auto-routed for thin news (80-199 words) */
  | "breaking"
  /** Single-slide stat/quote card (MASTER_PROMPT T6) — manually triggered */
  | "stat";

export type IGQueueStatus =
  | "queued"
  | "scheduled"
  | "rendering"
  | "posted"
  | "skipped"
  | "expired"
  | "scheduled_ready_for_manual";

/** Decision record produced by the IG selection logic. */
export interface IGDecision {
  igEligible: boolean;
  igType: IGPostType | null;
  igPriorityScore: number;
  reasons: string[];
  /** Delay posting until this ISO date */
  igPostAfter?: string;
  /** Do not post after this ISO date */
  igExpiresAt?: string;
}

/** Slide layout hint for the renderer. */
export type IGSlideLayout = "headline" | "explanation" | "data" | "cta";

/** A single carousel slide for IG. */
export interface IGSlide {
  heading: string;
  bullets: string[];
  footer?: string;
  /** Optional background image URL. Rendered with a dark overlay for text readability. */
  backgroundImage?: string;
  /** Layout hint for the renderer (headline / explanation / data). */
  layout?: IGSlideLayout;
  /** Big stat number for data slides (e.g. "100 %"). */
  statValue?: string;
  /** One-line description below the stat (e.g. "Frais de scolarité couverts"). */
  statDescription?: string;
}

// ── Meme slide types (Litquidity-style viral content) ──────────────────────

/**
 * Meme templates inspired by popular viral formats.
 * Each maps to a specific visual layout in the renderer.
 */
export type IGMemeTemplate =
  | "drake" // Top: bad option, Bottom: good option (two-panel)
  | "expanding-brain" // 3-4 tiers of increasing "enlightenment"
  | "distracted" // Distracted boyfriend: current / distraction / ignored
  | "starter-pack" // "X Starter Pack" — 4 relatable items
  | "two-buttons" // Anxious choice between two options
  | "tell-me" // "Tell me X without telling me X" + punchline
  | "nobody" // "Nobody: … / Haitian students: …"
  | "reaction" // Single reaction caption over a bold emoji/icon
  | "comparison"; // Side-by-side "Expectation vs Reality"

/** A single panel/tier within a meme. */
export interface IGMemePanel {
  /** The text label for this panel */
  text: string;
  /** Optional emoji/icon to render alongside the text */
  emoji?: string;
}

/** A meme slide to be rendered as a separate carousel image. */
export interface IGMemeSlide {
  /** Which meme layout template to use */
  template: IGMemeTemplate;
  /** The panels/tiers of the meme (2-4 depending on template) */
  panels: IGMemePanel[];
  /** Optional topic/setup text displayed at the top of the meme */
  topicLine?: string;
  /** Tone tag for moderation: must be student-safe humor */
  tone: "witty" | "wholesome" | "ironic" | "hype";
}

/** Formatted output ready for rendering. */
export interface IGFormattedPayload {
  slides: IGSlide[];
  caption: string;
  /** Optional meme slide inserted as the last carousel image for virality. */
  memeSlide?: IGMemeSlide;
}

/** Firestore collection: ig_queue */
export interface IGQueueItem {
  id: string;
  sourceContentId: string;
  igType: IGPostType;
  score: number;
  status: IGQueueStatus;
  scheduledFor?: string; // ISO date-time
  /** Target post date (YYYY-MM-DD, Haiti time). For histoire items this is
   *  the date the content refers to — ensures same-day posting. */
  targetPostDate?: string;
  /** The Haiti-local date (YYYY-MM-DD) when this item was queued.
   *  Used by the scheduler to prefer same-day items over stale carry-overs. */
  queuedDate?: string;
  /** Number of times rendering/publishing has been attempted and failed.
   *  Items exceeding the cap are moved to manual review. */
  renderRetries?: number;
  igPostId?: string;
  reasons: string[];
  payload?: IGFormattedPayload;
  dryRunPath?: string;
  /** Which renderer produced the carousel assets. */
  renderedBy?: "ig-engine";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Instagram Stories pipeline types ────────────────────────────────────────

export type IGStoryQueueStatus =
  | "queued"
  | "rendering"
  | "posted"
  | "skipped"
  | "failed";

/** A single story slide (1080×1920 / 9:16). */
export interface IGStorySlide {
  /** Main headline for the story frame */
  heading: string;
  /** Supporting text lines */
  bullets: string[];
  /** Optional small overline / category chip text */
  eyebrow?: string;
  /** Optional supporting dek shown as paragraph copy */
  subheading?: string;
  /** Optional compact metadata chips/rows */
  meta?: string[];
  /** Optional attribution/footer line */
  footer?: string;
  /** Optional background image (cover frame) */
  backgroundImage?: string;
  /** Accent colour override for this frame */
  accent?: string;
  /** Frame type for rendering dispatch (new story design) */
  frameType?: "cover" | "taux" | "facts" | "headline" | "history" | "cta";
}

/** Formatted Story payload ready for rendering. */
export interface IGStoryPayload {
  /** Ordered story frames (1-6 images; IG shows each for 5 s) */
  slides: IGStorySlide[];
  /** Date label for the story (e.g. "6 mars 2026") */
  dateLabel: string;
}

/**
 * Cold-start story slot tag.
 *
 *  - `midday_poll`     12:00 — binary poll on today's taux
 *  - `afternoon_quiz`  15:00 — quiz / fact poll
 *  - `summary_recap`   20:30 — daily recap (taux + facts + headlines)
 *  - `summary`         legacy daily-summary tag (kept for back-compat)
 *
 * Per-post story echoes (published inline by `processIgScheduled`) are
 * not persisted in `ig_story_queue` so they have no slot.
 */
export type IGStoryQueueSlot =
  | "midday_poll"
  | "afternoon_quiz"
  | "summary_recap"
  | "summary";

/** Firestore collection: ig_story_queue */
export interface IGStoryQueueItem {
  id: string;
  /** ISO date key YYYY-MM-DD — multiple stories per day allowed (one per slot) */
  dateKey: string;
  status: IGStoryQueueStatus;
  /** Source item IDs included in the summary */
  sourceItemIds: string[];
  igMediaId?: string;
  payload?: IGStoryPayload;
  /** Cold-start slot tag — enforces one story per slot per day. */
  slot?: IGStoryQueueSlot;
  /**
   * If true, the worker logs `igStoryHighlightCandidate` after a successful
   * publish so the operator (or a future Graph API endpoint) can add the
   * frame to a daily Highlights reel.
   */
  addToHighlight?: boolean;
  /**
   * Optional sticker overlays attached at publish time (P4 followup).
   * All fields are best-effort: the publisher silently skips any sticker
   * the IG Graph API rejects so the underlying story still goes out.
   */
  storyFeatures?: {
    /** Link sticker target URL (typically the article landing page). */
    linkUrl?: string;
    /** Poll sticker question — kept short so it fits the IG sticker UI. */
    pollQuestion?: string;
    /** 2 to 4 poll answer choices. */
    pollOptions?: string[];
    /** Default fallback CTA text used when no poll is shown. */
    ctaText?: string;
  };
  /**
   * Per-feature attempt outcomes recorded by the publisher (rollout PR).
   * One entry per sticker we tried to attach to the story container. Empty
   * or missing when no features were requested. Used by the admin
   * dashboard to flag silent IG sticker rejections (Task 3).
   */
  stickerAttempt?: Array<{
    feature: "linkSticker" | "poll";
    status: "attached" | "skipped";
    /** Short error/skip reason — present when status="skipped". */
    reason?: string;
  }>;
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Firestore collection: social_boost_log
 *
 * One entry per call to `applySocialBoost` that produced a non-zero boost.
 * Used by `/api/admin/social-metrics` to compute the "Boost health" panel
 * (Task 2 — rollout PR). Pruned by retention policy after 30 days.
 */
export interface SocialBoostLogEntry {
  id: string;
  /** The Item.id (sourceContentId) the boost was applied to. */
  itemId: string;
  /** Topic bucket the item belonged to (news, scholarship, opportunity, ...). */
  topic: string;
  /** Score before boost (0-100). */
  baseScore: number;
  /** Score after boost (0-100). */
  boostedScore: number;
  /** Final boost applied (0-20). */
  boost: number;
  /** Which platforms contributed >0 boost — e.g. ["fb", "th"]. */
  platformsContributed: string[];
  /** True when the boost hit the +20 cap. */
  capped: boolean;
  appliedAt: Timestamp;
}

/**
 * Firestore collection: wa_channel_snapshots
 *
 * Manual or scripted snapshots of the WhatsApp Channel follower count.
 * The Meta API does not currently expose this number, so we record it by
 * hand (one entry per check) and let the admin UI compute trends.
 */
export interface WaChannelSnapshot {
  id: string;
  /** ISO date (YYYY-MM-DD) the snapshot was taken. */
  dateISO: string;
  /** Reported follower count at the time of the snapshot. */
  followerCount: number;
  /** Where the number came from — "manual" | "script" | "api". */
  source: "manual" | "script" | "api";
  /** Optional free-text note (campaign label, anomaly, etc.). */
  notes?: string;
  createdAt: Timestamp;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── WhatsApp pipeline types ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export type WaQueueStatus =
  | "queued"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

/** The formatted message payload ready to send via WhatsApp Business API. */
export interface WaMessagePayload {
  /** Text body of the WhatsApp message (supports basic formatting *bold*, _italic_). */
  text: string;
  /** Optional public image URL to send as a media message. */
  imageUrl?: string;
  /** Optional link preview URL (appended or embedded in the text). */
  linkUrl?: string;
}

/** Firestore collection: wa_queue */
export interface WaQueueItem {
  id: string;
  /** The content_versions doc ID that sourced this message. */
  sourceContentId: string;
  /** The IG post type inherited from the source item (used for per-type daily caps). */
  igType?: IGPostType;
  /** Priority score (0-100) — higher = send first. */
  score: number;
  status: WaQueueStatus;
  /** ISO date-time when the message is scheduled to be sent. */
  scheduledFor?: string;
  /** The Haiti-local date (YYYY-MM-DD) when this item was queued. */
  queuedDate?: string;
  /** Number of send attempts (for retry logic). */
  sendRetries?: number;
  /** WhatsApp message ID returned by the API after successful send. */
  waMessageId?: string;
  /** Human-readable reasons for queuing / skipping. */
  reasons: string[];
  /** The message content to send. */
  payload?: WaMessagePayload;
  /** Last error message if status is "failed". */
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Facebook pipeline types ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export type FbQueueStatus =
  | "queued"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

/** The formatted message payload ready to publish via Facebook Graph API. */
export interface FbMessagePayload {
  /** Text body of the Facebook post. */
  text: string;
  /** Article URL — FB auto-generates a link preview card. */
  linkUrl?: string;
  /** Optional public image URL for photo posts (used when no link preview). */
  imageUrl?: string;
}

/** Firestore collection: fb_queue */
export interface FbQueueItem {
  id: string;
  sourceContentId: string;
  /** The IG post type inherited from the source item (used for per-type daily caps). */
  igType?: IGPostType;
  score: number;
  status: FbQueueStatus;
  scheduledFor?: string;
  queuedDate?: string;
  sendRetries?: number;
  /** Facebook post ID returned by the API after successful publish. */
  fbPostId?: string;
  /** ID of the auto-comment containing the article link (P1.1). */
  fbCommentId?: string;
  /** A/B test: which hook variant was used in the post text (P4). */
  hookVariant?: string;
  /** Engagement metrics fetched from FB Insights (P2). */
  socialMetrics?: Record<string, number>;
  socialMetricsFetchedAt?: Timestamp;
  reasons: string[];
  payload?: FbMessagePayload;
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Threads pipeline types ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export type ThQueueStatus =
  | "queued"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

/** The formatted message payload ready to publish via Threads API. */
export interface ThMessagePayload {
  /** Text body of the Threads post (max 500 chars). */
  text: string;
  /** Optional public image URL for image posts. */
  imageUrl?: string;
  /**
   * Article URL that should be posted as a self-reply (P1.2).
   * Threads suppresses outbound links in the parent post body, so we keep
   * the parent text clean and reply with the link. When unset, no reply
   * is posted (legacy posts that already embedded the link inline).
   */
  replyLinkUrl?: string;
}

/** Firestore collection: th_queue */
export interface ThQueueItem {
  id: string;
  sourceContentId: string;
  /** The IG post type inherited from the source item (used for per-type daily caps). */
  igType?: IGPostType;
  score: number;
  status: ThQueueStatus;
  scheduledFor?: string;
  queuedDate?: string;
  sendRetries?: number;
  /** Threads media ID returned by the API after successful publish. */
  thPostId?: string;
  /** Threads media ID of the self-reply containing the article link (P1.2). */
  thReplyMediaId?: string;
  /** A/B test: which hook variant was used in the post text (P4 followup). */
  hookVariant?: string;
  /** Engagement metrics fetched from Threads Insights (P2). */
  socialMetrics?: Record<string, number>;
  socialMetricsFetchedAt?: Timestamp;
  reasons: string[];
  payload?: ThMessagePayload;
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── X (Twitter) pipeline types ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

export type XQueueStatus =
  | "queued"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "skipped";

/** The formatted message payload ready to publish via X API v2. */
export interface XMessagePayload {
  /** Tweet text (max 280 chars). Links and hashtags embedded inline. */
  text: string;
  /** Optional public image URL — uploaded via v1.1 media endpoint when OAuth1 creds are configured (P1.3). */
  imageUrl?: string;
}

/** Firestore collection: x_queue */
export interface XQueueItem {
  id: string;
  sourceContentId: string;
  /** The IG post type inherited from the source item (used for per-type daily caps). */
  igType?: IGPostType;
  score: number;
  status: XQueueStatus;
  scheduledFor?: string;
  queuedDate?: string;
  sendRetries?: number;
  /** Tweet ID returned by the X API after successful publish. */
  xTweetId?: string;
  /** Media ID attached to the tweet, when image upload succeeded (P1.3). */
  xMediaId?: string;
  /** A/B test: which hook variant was used in the post text (P4 followup). */
  hookVariant?: string;
  /** Engagement metrics fetched from X public_metrics (P2). */
  socialMetrics?: Record<string, number>;
  socialMetricsFetchedAt?: Timestamp;
  reasons: string[];
  payload?: XMessagePayload;
  error?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Shared enums for datasets ──────────────────────────────────────────────

export type DatasetCountry =
  | "US"
  | "CA"
  | "FR"
  | "UK"
  | "DO"
  | "MX"
  | "CN"
  | "RU"
  | "HT"
  | "Global";

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

/** Whether the record is a direct application programme or a directory listing */
export type ScholarshipKind = "program" | "directory";

/** Haitian student eligibility status */
export type ScholarshipHaitianEligibility = "yes" | "no" | "unknown";

/** How precise the deadline information is */
export type ScholarshipDeadlineAccuracy =
  | "exact"
  | "month-only"
  | "varies"
  | "unknown";

export type ScholarshipFundingType =
  | "full"
  | "partial"
  | "stipend"
  | "tuition-only"
  | "unknown";

export interface ScholarshipDeadline {
  dateISO?: string;
  month?: number;
  notes?: string;
  sourceUrl: string;
}

/** A single image displayed on the scholarship detail page (hero or gallery). */
export interface ScholarshipImage {
  url: string;
  caption?: string;
  /** Attribution / credit line (e.g. "Wikimedia Commons, CC BY-SA 4.0"). */
  credit?: string;
}

/** A single step in the application walkthrough. */
export interface ScholarshipApplicationStep {
  title: string;
  description: string;
  /** Optional URL the user should visit for this step (form, portal, doc). */
  url?: string;
}

/** A sub-programme of a larger scholarship family (e.g. UWC HS vs UWC Latin America). */
export interface ScholarshipSubProgram {
  name: string;
  description: string;
  level?: AcademicLevel[];
  /** One-sentence eligibility note specific to this sub-programme. */
  eligibility?: string;
  /** External application or info URL. */
  url?: string;
  /** Internal site path if a curated page exists (e.g. "/uwc-haiti"). */
  relatedPagePath?: string;
}

/** A recurring milestone date for the scholarship cycle (open, deadline, results, etc.). */
export interface ScholarshipKeyDate {
  label: string;
  dateISO?: string;
  /** Free-form e.g. "Septembre – Octobre" when only a window is known. */
  monthRange?: string;
  notes?: string;
}

export interface Scholarship {
  id: string;
  name: string;
  country: DatasetCountry;
  eligibleCountries?: string[];
  level: AcademicLevel[];
  fundingType: ScholarshipFundingType;
  /** Whether this is a direct programme or a directory listing */
  kind?: ScholarshipKind;
  /** Explicit Haitian eligibility status */
  haitianEligibility?: ScholarshipHaitianEligibility;
  /** How precise the deadline information is */
  deadlineAccuracy?: ScholarshipDeadlineAccuracy;
  deadline?: ScholarshipDeadline;
  officialUrl: string;
  howToApplyUrl?: string;
  requirements?: string[];
  eligibilitySummary?: string;
  recurring?: boolean;
  tags?: string[];
  sources: DatasetCitation[];

  // ── Rich detail-page fields (all optional; backwards compatible) ──────
  /** Big illustrative image at the top of the detail page. */
  heroImageUrl?: string;
  /** Additional photos (campus, alumni, ceremony, …). */
  gallery?: ScholarshipImage[];
  /** Long-form description of the programme (markdown-light, plain text). */
  programDescription?: string;
  /** Ordered "How to apply" walkthrough. */
  applicationSteps?: ScholarshipApplicationStep[];
  /** Sub-programmes / tracks (e.g. UWC's high-school + Latin America branches). */
  subPrograms?: ScholarshipSubProgram[];
  /** Internal site path to a curated page (e.g. "/uwc-haiti"). */
  relatedPagePath?: string;
  /** Recurring milestones in the application cycle. */
  keyDates?: ScholarshipKeyDate[];

  verifiedAt: Timestamp;
  updatedAt: Timestamp;
}

// ── Firestore collection: haiti_education_calendar ─────────────────────────

export type CalendarEventType =
  | "rentree"
  | "registration"
  | "exam"
  | "results"
  | "admissions"
  | "closure";

export type CalendarLevel =
  | "ns1"
  | "ns2"
  | "ns3"
  | "ns4"
  | "bac"
  | "university"
  | "general";

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
  | "study_abroad"
  | "career"
  | "scholarship"
  | "haiti_calendar";

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
  | "universities"
  | "scholarships"
  | "haiti_calendar"
  | "pathways"
  | "haiti_history_almanac"
  | "haiti_holidays";

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

export interface ContributorSocialLinks {
  twitter?: string;
  linkedin?: string;
  website?: string;
}

export interface ContributorProfile {
  id: string;
  /** URL-safe slug for the /auteur/[slug] page */
  slug: string;
  /** Public display name (may differ from internal `name`) */
  displayName: string;
  name: string;
  email?: string;
  role: ContributorRole;
  verified: boolean;
  /** Short public bio (1-3 sentences) */
  bio?: string;
  /** Public profile photo URL */
  photoUrl?: string;
  /** Social / web links */
  socialLinks?: ContributorSocialLinks;
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
