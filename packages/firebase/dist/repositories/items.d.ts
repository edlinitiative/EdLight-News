import type { Item } from "@edlight-news/types";
import { type CreateItem } from "@edlight-news/types";
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
export declare function updateItem(id: string, data: Partial<CreateItem>): Promise<void>;
/** Get a single item by its dedupeGroupId (newest first). */
export declare function listByDedupeGroupId(dedupeGroupId: string, limit?: number): Promise<Item[]>;
export declare function deleteItem(id: string): Promise<void>;
//# sourceMappingURL=items.d.ts.map