import type { UtilitySource, UtilitySeries } from "@edlight-news/types";
import { type CreateUtilitySource } from "@edlight-news/types";
export declare function createUtilitySource(data: CreateUtilitySource): Promise<UtilitySource>;
export declare function getUtilitySource(id: string): Promise<UtilitySource | null>;
/** List all active utility sources. */
export declare function listActive(): Promise<UtilitySource[]>;
/** List active utility sources matching a specific utilityType. */
/** List active sources for a given series. */
export declare function listBySeries(series: UtilitySeries): Promise<UtilitySource[]>;
/** List active sources for a given series + rotation key. */
export declare function listBySeriesAndRotation(series: UtilitySeries, rotationKey: string): Promise<UtilitySource[]>;
/** Upsert a utility source by URL. Used for seeding. */
export declare function upsertByUrl(data: CreateUtilitySource): Promise<{
    source: UtilitySource;
    created: boolean;
}>;
//# sourceMappingURL=utility-sources.d.ts.map