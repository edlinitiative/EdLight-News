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
 * List items that have no imageSource field yet and meet the minimum score
 * threshold for image generation (audienceFitScore >= 0.5).
 *
 * Uses a Firestore inequality filter on audienceFitScore so low-value items
 * are excluded at the query level. The imageSource check is still done
 * in-memory because Firestore can't query for missing fields.
 */
export declare function listItemsNeedingImages(limit: number): Promise<Item[]>;
//# sourceMappingURL=items.d.ts.map