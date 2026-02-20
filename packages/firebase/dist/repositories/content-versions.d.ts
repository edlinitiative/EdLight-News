import type { ContentVersion, ContentLanguage, ContentStatus } from "@edlight-news/types";
import { type CreateContentVersion } from "@edlight-news/types";
export declare function createContentVersion(data: CreateContentVersion): Promise<ContentVersion>;
/**
 * Batch-create multiple draft content_versions for a single item.
 * Used after LLM generation to write FR + HT versions at once.
 */
export declare function createDraftVersionsForItem(itemId: string, versions: Omit<CreateContentVersion, "itemId">[]): Promise<ContentVersion[]>;
export declare function getContentVersion(id: string): Promise<ContentVersion | null>;
/**
 * List web content_versions (draft + published) for the news feed.
 */
export declare function listWebVersions(language: ContentLanguage, limit?: number): Promise<ContentVersion[]>;
export declare function listPublishedForWeb(language: ContentLanguage, limit?: number): Promise<ContentVersion[]>;
export declare function listByItemId(itemId: string): Promise<ContentVersion[]>;
/**
 * Check whether an item already has web content_versions.
 */
export declare function hasWebVersions(itemId: string): Promise<boolean>;
export declare function updateContentVersionStatus(id: string, status: ContentStatus): Promise<void>;
/**
 * Bulk-publish all draft content_versions that have passed quality gates
 * (no draftReason set). Called as a cleanup sweep after generate.
 */
export declare function publishEligibleDrafts(): Promise<number>;
//# sourceMappingURL=content-versions.d.ts.map