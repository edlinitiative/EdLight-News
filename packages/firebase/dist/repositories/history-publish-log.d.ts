import type { HistoryPublishLog, HistoryPublishStatus } from "@edlight-news/types";
/** Get the log entry for a specific date (YYYY-MM-DD). */
export declare function getByDate(dateISO: string): Promise<HistoryPublishLog | null>;
/** Create or update the log entry for today. */
export declare function upsert(data: {
    dateISO: string;
    publishedItemId?: string;
    almanacEntryIds: string[];
    holidayId?: string;
    status: HistoryPublishStatus;
    error?: string;
    validationWarnings?: string[];
    validationErrors?: string[];
}): Promise<HistoryPublishLog>;
/** List recent publish log entries. */
export declare function listRecent(limit?: number): Promise<HistoryPublishLog[]>;
//# sourceMappingURL=history-publish-log.d.ts.map