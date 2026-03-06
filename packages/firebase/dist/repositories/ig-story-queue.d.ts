import type { IGStoryQueueItem, IGStoryQueueStatus } from "@edlight-news/types";
import { type CreateIGStoryQueueItem } from "@edlight-news/types";
export declare function createStoryQueueItem(data: CreateIGStoryQueueItem): Promise<IGStoryQueueItem>;
export declare function getByDateKey(dateKey: string): Promise<IGStoryQueueItem | null>;
export declare function listByStatus(status: IGStoryQueueStatus, limit?: number): Promise<IGStoryQueueItem[]>;
export declare function updateStatus(id: string, status: IGStoryQueueStatus, extra?: Partial<Pick<IGStoryQueueItem, "igMediaId" | "error">>): Promise<void>;
//# sourceMappingURL=ig-story-queue.d.ts.map