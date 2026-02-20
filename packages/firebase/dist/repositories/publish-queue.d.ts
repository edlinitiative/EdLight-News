import { FieldValue } from "firebase-admin/firestore";
import type { PublishQueueEntry, PublishStatus } from "@edlight-news/types";
import { type CreatePublishQueueEntry } from "@edlight-news/types";
export declare function createPublishQueueEntry(data: CreatePublishQueueEntry): Promise<PublishQueueEntry>;
export declare function getPublishQueueEntry(id: string): Promise<PublishQueueEntry | null>;
export declare function listPending(limit?: number): Promise<PublishQueueEntry[]>;
export declare function updatePublishStatus(id: string, status: PublishStatus, extra?: {
    lastError?: string;
    completedAt?: FieldValue;
}): Promise<void>;
export declare function incrementAttemptCount(id: string): Promise<void>;
//# sourceMappingURL=publish-queue.d.ts.map