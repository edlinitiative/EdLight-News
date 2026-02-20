import type { RawItem } from "@edlight-news/types";
import { type CreateRawItem } from "@edlight-news/types";
export declare function createRawItem(data: CreateRawItem): Promise<RawItem>;
export declare function getRawItem(id: string): Promise<RawItem | null>;
export declare function findByHash(hash: string): Promise<RawItem | null>;
/**
 * Insert a raw_item only if no existing doc has the same hash.
 * Returns { created: true, item } or { created: false } for dupes.
 */
export declare function addRawItemIfNew(data: CreateRawItem): Promise<{
    created: true;
    item: RawItem;
} | {
    created: false;
}>;
/**
 * Returns raw_items with status="new" ordered by createdAt, limited.
 */
export declare function getNewRawItems(limit?: number): Promise<RawItem[]>;
/** Alias for backwards-compat */
export declare const listNewRawItems: typeof getNewRawItems;
export declare function markProcessed(id: string): Promise<void>;
export declare function markSkipped(id: string, reason: string): Promise<void>;
/** Generic status update */
export declare function updateRawItemStatus(id: string, status: RawItem["status"]): Promise<void>;
//# sourceMappingURL=raw-items.d.ts.map