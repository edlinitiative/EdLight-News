import type { Metric } from "@edlight-news/types";
import { type CreateMetric } from "@edlight-news/types";
export declare function createMetric(data: CreateMetric): Promise<Metric>;
export declare function listByContentVersion(contentVersionId: string): Promise<Metric[]>;
export declare function updateMetric(id: string, data: Partial<Pick<Metric, "views" | "clicks" | "shares">>): Promise<void>;
//# sourceMappingURL=metrics.d.ts.map