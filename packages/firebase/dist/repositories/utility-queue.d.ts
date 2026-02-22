import type { UtilityQueueEntry, UtilitySeries, ContentLanguage } from "@edlight-news/types";
export interface EnqueueUtilityJobInput {
    series: UtilitySeries;
    rotationKey?: string;
    langTargets: ContentLanguage[];
    sourceIds: string[];
    runAt?: Date;
}
/** Enqueue a new utility generation job. */
export declare function enqueueJob(input: EnqueueUtilityJobInput): Promise<UtilityQueueEntry>;
/** List queued jobs ready to process (status="queued", runAt <= now). */
export declare function listQueuedJobs(limit: number): Promise<UtilityQueueEntry[]>;
/** Mark a job as processing. */
export declare function markProcessing(id: string): Promise<void>;
/** Mark a job as done. */
export declare function markDone(id: string): Promise<void>;
/** Mark a job as failed with reasons. */
export declare function markFailed(id: string, reasons: string[], lastError?: string): Promise<void>;
/** Count utility items (itemType="utility") created in the last N hours.
 *  Uses the items collection, not the queue. */
export declare function countRecentUtilityItems(hoursAgo: number): Promise<number>;
//# sourceMappingURL=utility-queue.d.ts.map