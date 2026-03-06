import type { IGQueueItem, IGQueueStatus, IGFormattedPayload } from "@edlight-news/types";
import { type CreateIGQueueItem } from "@edlight-news/types";
export declare function createIGQueueItem(data: CreateIGQueueItem): Promise<IGQueueItem>;
export declare function getIGQueueItem(id: string): Promise<IGQueueItem | null>;
export declare function findBySourceContentId(sourceContentId: string): Promise<IGQueueItem | null>;
export declare function listByStatus(status: IGQueueStatus, limit?: number): Promise<IGQueueItem[]>;
export declare function listQueuedByScore(limit?: number): Promise<IGQueueItem[]>;
export declare function listScheduled(limit?: number): Promise<IGQueueItem[]>;
export declare function listRecentPosted(sinceDaysAgo?: number, limit?: number): Promise<IGQueueItem[]>;
export declare function countPostedToday(): Promise<number>;
/**
 * Returns all items posted or scheduled today (for type-diversity checks).
 * Only includes minimal fields: id, igType, status.
 */
export declare function listPostedAndScheduledToday(): Promise<Pick<IGQueueItem, "id" | "igType" | "status">[]>;
export declare function countScheduledToday(): Promise<number>;
export declare function updateStatus(id: string, status: IGQueueStatus, extra?: Record<string, unknown>): Promise<void>;
export declare function setPayload(id: string, payload: IGFormattedPayload): Promise<void>;
export declare function setScheduled(id: string, scheduledFor: string): Promise<void>;
export declare function markPosted(id: string, igPostId?: string): Promise<void>;
export declare function listAll(limit?: number): Promise<IGQueueItem[]>;
//# sourceMappingURL=ig-queue.d.ts.map