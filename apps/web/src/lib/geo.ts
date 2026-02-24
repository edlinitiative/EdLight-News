/**
 * Deterministic geo-classification for calendar & deadline items.
 *
 * Delegates to the comprehensive classifier in `calendarGeo.ts` and maps
 * to the legacy "HT" | "International" labels for backward compatibility.
 *
 * New code should import directly from `@/lib/calendarGeo` instead.
 */

import { getCalendarGeo, type CalendarGeoInput } from "./calendarGeo";

// ── Public API (legacy — prefer calendarGeo.ts for new code) ─────────────────

/** Minimal shape accepted by {@link getCalendarGeoLabel}. */
export interface GeoClassifiable {
  geoTag?: string | null;
  country?: string | null;
  officialUrl?: string | null;
  institution?: string | null;
  sources?: { url: string }[] | null;
  title?: string | null;
  name?: string | null;
  summary?: string | null;
  notes?: string | null;
  eligibilitySummary?: string | null;
}

export type CalendarGeoLabel = "HT" | "International";

/**
 * Classify a calendar / deadline item as **"HT"** (Haïti) or **"International"**.
 *
 * Delegates to {@link getCalendarGeo} and maps `"Haiti"` → `"HT"`.
 */
export function getCalendarGeoLabel(item: GeoClassifiable): CalendarGeoLabel {
  const geo = getCalendarGeo(item as CalendarGeoInput);
  return geo === "Haiti" ? "HT" : "International";
}
