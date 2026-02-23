/**
 * Shared date utilities for the retention / urgency engine.
 *
 * All helpers are pure functions — no side effects, no Firestore calls.
 * Used by DeadlineBadge, the homepage urgency block, and /closing-soon.
 */

import type { HaitiCalendarEvent } from "@edlight-news/types";

// ── Core date helpers ────────────────────────────────────────────────────────

/** Safely parse an ISO date string (YYYY-MM-DD). Returns null on any invalid input. */
export function parseISODateSafe(dateISO?: string | null): Date | null {
  if (!dateISO || typeof dateISO !== "string") return null;
  // Accept YYYY-MM-DD only — append T00:00:00 to avoid timezone shift
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
  const d = new Date(dateISO + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Integer days until `date` from `now`.
 * Positive = future, 0 = today, negative = past.
 * Uses ceiling so "any time remaining in the day" counts as 1.
 */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const msPerDay = 86_400_000;
  // Strip time portion for both dates
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

/**
 * Human-readable urgency label.
 *
 * FR: "Clôture dans 3 jours" / "Clôture aujourd'hui" / "Clôture demain"
 * HT: "Fèmen nan 3 jou" / "Fèmen jodi a" / "Fèmen demen"
 *
 * `prefix` overrides the default verb (e.g. "Événement" / "Evènman").
 */
export function formatDaysLabel(
  days: number,
  lang: "fr" | "ht",
  prefix?: { fr: string; ht: string },
): string {
  const pfx = prefix ?? { fr: "Clôture", ht: "Fèmen" };
  const p = lang === "fr" ? pfx.fr : pfx.ht;

  if (days === 0) {
    return lang === "fr" ? `${p} aujourd'hui` : `${p} jodi a`;
  }
  if (days === 1) {
    return lang === "fr" ? `${p} demain` : `${p} demen`;
  }
  if (lang === "fr") {
    return `${p} dans ${days} jour${days > 1 ? "s" : ""}`;
  }
  return `${p} nan ${days} jou`;
}

/** Check whether `date` is within `windowDays` from now (inclusive, future only). */
export function isWithinDays(date: Date, windowDays: number, now: Date = new Date()): boolean {
  const d = daysUntil(date, now);
  return d >= 0 && d <= windowDays;
}

// ── Calendar event date resolver ─────────────────────────────────────────────

/**
 * Extract the most relevant upcoming date from a HaitiCalendarEvent.
 * Priority: dateISO → startDateISO → null.
 */
export function getNextRelevantDate(
  event: Pick<HaitiCalendarEvent, "dateISO" | "startDateISO">,
): Date | null {
  return parseISODateSafe(event.dateISO) ?? parseISODateSafe(event.startDateISO) ?? null;
}

// ── Urgency tier (for badge styling) ─────────────────────────────────────────

export type UrgencyTier = "critical" | "soon" | "upcoming" | "none";

/** Map days-until to an urgency tier for visual styling. */
export function urgencyTier(days: number): UrgencyTier {
  if (days <= 1) return "critical";
  if (days <= 7) return "soon";
  return "upcoming";
}
