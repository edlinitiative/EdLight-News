import type { Source } from "@edlight-news/types";
import { type CreateSource } from "@edlight-news/types";
export declare function createSource(data: CreateSource): Promise<Source>;
export declare function getSource(id: string): Promise<Source | null>;
/**
 * Returns all sources where active == true.
 * This is the primary query for the worker tick.
 */
export declare function getEnabledSources(): Promise<Source[]>;
/** Alias kept for backwards-compat */
export declare const listActiveSources: typeof getEnabledSources;
export declare function updateSource(id: string, data: Partial<CreateSource>): Promise<void>;
export declare function deleteSource(id: string): Promise<void>;
//# sourceMappingURL=sources.d.ts.map