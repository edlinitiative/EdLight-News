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
export interface QualityFlags {
    hasSourceUrl: boolean;
    needsReview: boolean;
    lowConfidence: boolean;
    reasons: string[];
}
export type ItemCategory = "scholarship" | "opportunity" | "news" | "event" | "resource" | "local_news";
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
//# sourceMappingURL=models.d.ts.map