/**
 * Unified calendar item types shared across timeline components.
 * Merges HaitiCalendarEvent and Scholarship into a single discriminated union.
 */

import type { CalendarEventType } from "@edlight-news/types";
import type { CalendarGeo } from "@/lib/calendarGeo";
import type { CalendarAudience } from "@/lib/calendarAudience";

// ─── Item shapes ──────────────────────────────────────────────────────────────

export interface HaitiCalendarItem {
  id: string;
  kind: "haiti";
  title: string;
  dateISO?: string | null;
  endDateISO?: string | null;
  notes?: string | null;
  institution?: string | null;
  level?: string | string[] | null;
  eventType: CalendarEventType;
  officialUrl?: string | null;
  sources?: { label: string; url: string }[] | null;
  verifiedAt?: unknown;
  updatedAt?: unknown;
  geo: CalendarGeo;
  audience: CalendarAudience;
}

export interface IntlCalendarItem {
  id: string;
  kind: "international";
  name: string;
  dateISO: string | null;
  country: string;
  countryLabel?: string;
  countryFlag?: string;
  eligibility?: string | null;
  howToApplyUrl?: string | null;
  geo: CalendarGeo;
  audience: CalendarAudience;
}

export type CalendarItem = HaitiCalendarItem | IntlCalendarItem;

// ─── Filter types ─────────────────────────────────────────────────────────────

export type GeoFilter = "tous" | "haiti" | "international";
export type CategoryFilter =
  | "tous"
  | "examens"
  | "admissions"
  | "bourses"
  | "concours"
  | "autres";

// ─── Accessor helpers ─────────────────────────────────────────────────────────

/** Display title for any calendar item. */
export function getItemTitle(item: CalendarItem): string {
  return item.kind === "haiti" ? item.title : item.name;
}

/** Primary ISO date string (YYYY-MM-DD) or null when unknown. */
export function getItemDateISO(item: CalendarItem): string | null {
  return item.dateISO ?? null;
}

/** Derive category filter key from an item's type/kind. */
export function getItemCategory(item: CalendarItem): CategoryFilter {
  if (item.kind === "international") return "bourses";
  switch (item.eventType) {
    case "exam":
    case "results":
      return "examens";
    case "admissions":
      return "admissions";
    case "registration":
      return "concours";
    default:
      return "autres";
  }
}

/** Apply geo + category filters to a list of items. */
export function filterCalendarItems(
  items: CalendarItem[],
  geo: GeoFilter,
  category: CategoryFilter,
): CalendarItem[] {
  return items.filter((item) => {
    const geoOk =
      geo === "tous" ||
      (geo === "haiti" ? item.geo === "Haiti" : item.geo === "International");
    const catOk = category === "tous" || getItemCategory(item) === category;
    return geoOk && catOk;
  });
}
