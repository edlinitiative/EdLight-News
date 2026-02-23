import type { DatasetJob, DatasetName, DatasetJobStatus } from "@edlight-news/types";
import { type CreateDatasetJob } from "@edlight-news/types";
export declare function create(data: CreateDatasetJob): Promise<DatasetJob>;
export declare function get(id: string): Promise<DatasetJob | null>;
/** List jobs with a given status, ordered by creation time. */
export declare function listByStatus(status: DatasetJobStatus): Promise<DatasetJob[]>;
/** Convenience: list all queued jobs. */
export declare function listQueued(): Promise<DatasetJob[]>;
export declare function update(id: string, data: Partial<CreateDatasetJob>): Promise<void>;
export declare function markProcessing(id: string): Promise<void>;
export declare function markDone(id: string): Promise<void>;
export declare function markFailed(id: string, error: string): Promise<void>;
/** Enqueue a refresh job for a dataset (idempotent: skip if one is already queued). */
export declare function enqueue(dataset: DatasetName): Promise<{
    job: DatasetJob;
    created: boolean;
}>;
/** Return the most recent "done" job for a given dataset, or null. */
export declare function lastDoneForDataset(dataset: DatasetName): Promise<DatasetJob | null>;
export declare function count(): Promise<number>;
//# sourceMappingURL=dataset-jobs.d.ts.map