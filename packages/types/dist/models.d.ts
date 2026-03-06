import { Timestamp } from "firebase-admin/firestore";
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
export type GeoTag = "HT" | "Diaspora" | "Global";
/** How the article image was obtained */
export type ImageSource = "publisher" | "wikidata" | "branded" | "screenshot" | "commons";
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
    deadline?: string;
    eligibility?: string[];
    coverage?: string;
    howToApply?: string;
    officialLink?: string;
}
export type ItemType = "source" | "synthesis" | "utility";
/** Denormalized reference to a source article included in a synthesis */
export interface SynthesisSourceRef {
    itemId: string;
    title: string;
    sourceName: string;
    publishedAt?: string;
}
/** Metadata about a synthesis (multi-source) article */
export interface SynthesisMeta {
    sourceItemIds: string[];
    sourceCount: number;
    publisherDomains: string[];
    model: string;
    promptVersion: string;
    validationPassed: boolean;
    lastSynthesizedAt: string;
}
export type UtilitySeries = "StudyAbroad" | "Career" | "ScholarshipRadar" | "ScholarshipRadarWeekly" | "HaitiHistory" | "HaitiFactOfTheDay" | "HaitianOfTheWeek" | "HaitiEducationCalendar";
export type UtilityType = "study_abroad" | "career" | "scholarship" | "opportunity" | "history" | "daily_fact" | "profile" | "school_calendar";
export type UtilityAudience = "lycee" | "universite" | "international";
export type UtilityRegion = "HT" | "US" | "CA" | "FR" | "DO" | "RU" | "Global";
export interface UtilityCitation {
    label: string;
    url: string;
}
export interface ExtractedFacts {
    deadlines?: {
        label: string;
        dateISO: string;
        sourceUrl: string;
    }[];
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
export interface SourceCitation {
    name: string;
    url: string;
}
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
export type ItemCategory = "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news" | "bourses" | "concours" | "stages" | "programmes";
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
    confidence: number;
    qualityFlags: QualityFlags;
    citations: Citation[];
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
    /** Explicitly tagged as a success / achievement story */
    successTag?: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export interface Citation {
    sourceName: string;
    sourceUrl: string;
}
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
export interface Metric {
    id: string;
    contentVersionId: string;
    channel: ContentChannel;
    views: number;
    clicks: number;
    shares: number;
    recordedAt: Timestamp;
}
export type AlmanacConfidence = "high" | "medium";
export type AlmanacCreatedBy = "seed" | "admin" | "intern" | "import";
export type AlmanacTag = "independence" | "culture" | "education" | "politics" | "science" | "military" | "economy" | "literature" | "art" | "religion" | "sports" | "disaster" | "diplomacy" | "resistance" | "revolution";
export interface HaitiHistoryAlmanacEntry {
    id: string;
    /** MM-DD (e.g. "02-22") */
    monthDay: string;
    /** Optional year; null for recurring or unspecified */
    year?: number | null;
    title_fr: string;
    summary_fr: string;
    /** 1-sentence student takeaway */
    student_takeaway_fr: string;
    tags?: AlmanacTag[];
    /** Optional historical illustration (stored server-side). */
    illustration?: {
        imageUrl: string;
        pageUrl: string;
        pageTitle?: string;
        provider?: "wikimedia_commons" | "manual";
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
export type AlmanacRawCategory = "political" | "education" | "culture" | "international" | "economy" | "social" | "science" | "birth" | "death";
export type AlmanacRawSourceType = "government" | "academic" | "institutional" | "press" | "reference";
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
export type IGPostType = "scholarship" | "opportunity" | "news" | "histoire" | "utility";
export type IGQueueStatus = "queued" | "scheduled" | "rendering" | "posted" | "skipped" | "scheduled_ready_for_manual";
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
/** A single carousel slide for IG. */
export interface IGSlide {
    heading: string;
    bullets: string[];
    footer?: string;
    /** Optional background image URL. Rendered with a dark overlay for text readability. */
    backgroundImage?: string;
}
/**
 * Meme templates inspired by popular viral formats.
 * Each maps to a specific visual layout in the renderer.
 */
export type IGMemeTemplate = "drake" | "expanding-brain" | "distracted" | "starter-pack" | "two-buttons" | "tell-me" | "nobody" | "reaction" | "comparison";
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
    scheduledFor?: string;
    igPostId?: string;
    reasons: string[];
    payload?: IGFormattedPayload;
    dryRunPath?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export type IGStoryQueueStatus = "queued" | "rendering" | "posted" | "skipped" | "failed";
/** A single story slide (1080×1920 / 9:16). */
export interface IGStorySlide {
    /** Main headline for the story frame */
    heading: string;
    /** Supporting text lines */
    bullets: string[];
    /** Optional background image (cover frame) */
    backgroundImage?: string;
    /** Accent colour override for this frame */
    accent?: string;
}
/** Formatted Story payload ready for rendering. */
export interface IGStoryPayload {
    /** Ordered story frames (1-6 images; IG shows each for 5 s) */
    slides: IGStorySlide[];
    /** Date label for the story (e.g. "6 mars 2026") */
    dateLabel: string;
}
/** Firestore collection: ig_story_queue */
export interface IGStoryQueueItem {
    id: string;
    /** ISO date key YYYY-MM-DD — one story per day */
    dateKey: string;
    status: IGStoryQueueStatus;
    /** Source item IDs included in the summary */
    sourceItemIds: string[];
    igMediaId?: string;
    payload?: IGStoryPayload;
    error?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
export type DatasetCountry = "US" | "CA" | "FR" | "UK" | "DO" | "MX" | "CN" | "RU" | "HT" | "Global";
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
/** Whether the record is a direct application programme or a directory listing */
export type ScholarshipKind = "program" | "directory";
/** Haitian student eligibility status */
export type ScholarshipHaitianEligibility = "yes" | "no" | "unknown";
/** How precise the deadline information is */
export type ScholarshipDeadlineAccuracy = "exact" | "month-only" | "varies" | "unknown";
export type ScholarshipFundingType = "full" | "partial" | "stipend" | "tuition-only" | "unknown";
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
    verifiedAt: Timestamp;
    updatedAt: Timestamp;
}
export type CalendarEventType = "rentree" | "registration" | "exam" | "results" | "admissions" | "closure";
export type CalendarLevel = "ns1" | "ns2" | "ns3" | "ns4" | "bac" | "university" | "general";
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
export type PathwayGoalKey = "study_abroad" | "career" | "scholarship" | "haiti_calendar";
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
export type DatasetName = "universities" | "scholarships" | "haiti_calendar" | "pathways" | "haiti_history_almanac" | "haiti_holidays";
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
//# sourceMappingURL=models.d.ts.map