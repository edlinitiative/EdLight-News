import type { HaitiHoliday } from "@edlight-news/types";
import { type CreateHaitiHoliday } from "@edlight-news/types";
export declare function create(data: CreateHaitiHoliday): Promise<HaitiHoliday>;
export declare function get(id: string): Promise<HaitiHoliday | null>;
export declare function listAll(): Promise<HaitiHoliday[]>;
/** Get holidays for a specific day (MM-DD). */
export declare function listByMonthDay(monthDay: string): Promise<HaitiHoliday[]>;
/** Upsert by monthDay + name_fr (idempotent seeding). */
export declare function upsertByName(data: CreateHaitiHoliday): Promise<{
    holiday: HaitiHoliday;
    created: boolean;
}>;
export declare function update(id: string, data: Partial<CreateHaitiHoliday>): Promise<void>;
//# sourceMappingURL=haiti-holidays.d.ts.map