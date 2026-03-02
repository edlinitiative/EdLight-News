import type { Item, ImageAttribution, EntityRef } from "@edlight-news/types";
import { type CreateItem } from "@edlight-news/types";
/** Fields that can be updated on an item (superset of CreateItem for image pipeline). */
export type ItemUpdate = Partial<CreateItem> & {
    imageConfidence?: number;
    imageAttribution?: ImageAttribution;
    entity?: EntityRef;
};
export declare function createItem(data: CreateItem): Promise<Item>;
export declare function getItem(id: string): Promise<Item | null>;
export declare function findByCanonicalUrl(canonicalUrl: string): Promise<Item | null>;
/**
 * Insert or update an item keyed by canonicalUrl.
 * If an item with the same canonicalUrl exists, it is updated.
 * Returns the upserted Item and whether it was newly created.
 */
export declare function upsertItemByCanonicalUrl(data: CreateItem): Promise<{
    item: Item;
    created: boolean;
}>;
/**
 * List items that do NOT yet have content_versions.
 * Used by the generate step to find items needing content generation.
 */
export declare function listItemsByCategory(category: string): Promise<Item[]>;
export declare function listRecentItems(limit?: number): Promise<Item[]>;
export declare function updateItem(id: string, data: ItemUpdate): Promise<void>;
/** Get a single item by its dedupeGroupId (newest first). */
export declare function listByDedupeGroupId(dedupeGroupId: string, limit?: number): Promise<Item[]>;
export declare function deleteItem(id: string): Promise<void>;
/**
 * Find a recent utility item with the given dedupeGroupId.
 * Used to prevent the utility engine from creating duplicate daily_fact /
 * scholarship / career items about the same underlying story.
 */
export declare function findRecentUtilityByDedupeGroup(dedupeGroupId: string, sinceDaysAgo?: number): Promise<Item | null>;
/** Find an existing synthesis item by its clusterId. */
export declare function findSynthesisByClusterId(clusterId: string): Promise<Item | null>;
/**
 * List recent source items (non-synthesis) that have a dedupeGroupId.
 * Used by synthesis cluster selection.
 */
export declare function listRecentSourceItems(sinceDaysAgo: number, limit?: number): Promise<Item[]>;
/** Set lastMajorUpdateAt to server timestamp (for synthesis living updates). */
export declare function setLastMajorUpdate(id: string): Promise<void>;
export declare function listItemsNeedingImages(limit: number): Promise<Item[]>;
//# sourceMappingURL=items.d.ts.map