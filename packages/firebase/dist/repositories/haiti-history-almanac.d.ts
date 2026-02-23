import type { HaitiHistoryAlmanacEntry } from "@edlight-news/types";
import { type CreateHaitiHistoryAlmanacEntry } from "@edlight-news/types";
export declare function create(data: CreateHaitiHistoryAlmanacEntry): Promise<HaitiHistoryAlmanacEntry>;
export declare function get(id: string): Promise<HaitiHistoryAlmanacEntry | null>;
export declare function listAll(): Promise<HaitiHistoryAlmanacEntry[]>;
/** List entries for a specific day (MM-DD). */
export declare function listByMonthDay(monthDay: string): Promise<HaitiHistoryAlmanacEntry[]>;
/** List entries for a specific month (MM). */
export declare function listByMonth(month: string): Promise<HaitiHistoryAlmanacEntry[]>;
/** Upsert by monthDay + title_fr (idempotent seeding). */
export declare function upsertByTitle(data: CreateHaitiHistoryAlmanacEntry): Promise<{
    entry: HaitiHistoryAlmanacEntry;
    created: boolean;
}>;
export declare function update(id: string, data: Partial<CreateHaitiHistoryAlmanacEntry>): Promise<void>;
/** Delete an almanac entry by ID. */
export declare function remove(id: string): Promise<void>;
/** Find and delete by monthDay + title_fr (inverse of upsertByTitle). */
export declare function removeByMonthDayAndTitle(monthDay: string, title_fr: string): Promise<boolean>;
//# sourceMappingURL=haiti-history-almanac.d.ts.map