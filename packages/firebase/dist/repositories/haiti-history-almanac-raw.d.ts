/**
 * Firestore repository for haiti_history_almanac_raw.
 *
 * Stores structured FACTS only — no LLM-generated narrative.
 * Each record represents a single historical event with verified sources.
 */
import type { HaitiHistoryAlmanacRaw } from "@edlight-news/types";
import { type CreateHaitiHistoryAlmanacRaw } from "@edlight-news/types";
export declare function create(data: CreateHaitiHistoryAlmanacRaw): Promise<HaitiHistoryAlmanacRaw>;
export declare function get(id: string): Promise<HaitiHistoryAlmanacRaw | null>;
export declare function listAll(): Promise<HaitiHistoryAlmanacRaw[]>;
/** List entries for a specific day (MM-DD). */
export declare function listByMonthDay(monthDay: string): Promise<HaitiHistoryAlmanacRaw[]>;
/** List verified entries for a specific day (MM-DD). */
export declare function listVerifiedByMonthDay(monthDay: string): Promise<HaitiHistoryAlmanacRaw[]>;
/** List entries for a specific month (MM). */
export declare function listByMonth(month: string): Promise<HaitiHistoryAlmanacRaw[]>;
/** List all unverified entries. */
export declare function listUnverified(): Promise<HaitiHistoryAlmanacRaw[]>;
export declare function update(id: string, data: Partial<CreateHaitiHistoryAlmanacRaw>): Promise<void>;
export declare function markVerified(id: string): Promise<void>;
export declare function markUnverified(id: string): Promise<void>;
/** Upsert by monthDay + year + title (idempotent seeding). */
export declare function upsertByKey(data: CreateHaitiHistoryAlmanacRaw): Promise<{
    entry: HaitiHistoryAlmanacRaw;
    created: boolean;
}>;
export declare function remove(id: string): Promise<void>;
/** Get total count of entries. */
export declare function count(): Promise<number>;
//# sourceMappingURL=haiti-history-almanac-raw.d.ts.map