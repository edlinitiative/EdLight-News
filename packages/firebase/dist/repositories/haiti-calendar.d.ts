import type { HaitiCalendarEvent, CalendarEventType, CalendarLevel } from "@edlight-news/types";
import { type CreateHaitiCalendarEvent } from "@edlight-news/types";
export declare function create(data: CreateHaitiCalendarEvent): Promise<HaitiCalendarEvent>;
export declare function get(id: string): Promise<HaitiCalendarEvent | null>;
export declare function listAll(): Promise<HaitiCalendarEvent[]>;
export declare function listByEventType(eventType: CalendarEventType): Promise<HaitiCalendarEvent[]>;
export declare function listByLevel(level: CalendarLevel): Promise<HaitiCalendarEvent[]>;
/** List events from today onward. */
export declare function listUpcoming(): Promise<HaitiCalendarEvent[]>;
export declare function update(id: string, data: Partial<CreateHaitiCalendarEvent>): Promise<void>;
/** Upsert by title + dateISO (used for seeding). */
export declare function upsertByTitle(data: CreateHaitiCalendarEvent): Promise<{
    event: HaitiCalendarEvent;
    created: boolean;
}>;
export declare function count(): Promise<number>;
//# sourceMappingURL=haiti-calendar.d.ts.map