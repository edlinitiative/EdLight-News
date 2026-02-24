/**
 * Time-bucket partitioning for the calendar timeline dashboard.
 * Each item appears in exactly one bucket.
 */

import type { CalendarItem } from "./types";
import { getItemDateISO } from "./types";
import { parseISODateSafe, daysUntil } from "@/lib/deadlines";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarBuckets {
  /** Up to 6 items with deadline in [today, today+14], sorted ascending. */
  urgent: CalendarItem[];
  /** Items in [today, today+7] NOT already in urgent. */
  thisWeek: CalendarItem[];
  /** Remaining items in the current calendar month. */
  thisMonth: CalendarItem[];
  /** Everything else — future months and items with no date. */
  archive: CalendarItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveDate(item: CalendarItem): Date | null {
  return parseISODateSafe(getItemDateISO(item));
}

// ─── Main bucketing function ──────────────────────────────────────────────────

/**
 * Partition `items` into four mutually exclusive time buckets.
 * Items are sorted by ascending date before partitioning.
 */
export function bucketItems(
  items: CalendarItem[],
  now: Date = new Date(),
): CalendarBuckets {
  const shownIds = new Set<string>();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Sort ascending; undated items go to the end.
  const sorted = [...items].sort((a, b) => {
    const da = resolveDate(a);
    const db = resolveDate(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.getTime() - db.getTime();
  });

  // 1. Urgent — next 14 days, max 6
  const urgent: CalendarItem[] = [];
  for (const item of sorted) {
    if (urgent.length >= 6) break;
    const date = resolveDate(item);
    if (!date) continue;
    const days = daysUntil(date, now);
    if (days >= 0 && days <= 14) {
      urgent.push(item);
      shownIds.add(item.id);
    }
  }

  // 2. This Week — [today, today+7] not already shown
  const thisWeek: CalendarItem[] = [];
  for (const item of sorted) {
    if (shownIds.has(item.id)) continue;
    const date = resolveDate(item);
    if (!date) continue;
    const days = daysUntil(date, now);
    if (days >= 0 && days <= 7) {
      thisWeek.push(item);
      shownIds.add(item.id);
    }
  }

  // 3. This Month — rest of the current calendar month
  const thisMonth: CalendarItem[] = [];
  for (const item of sorted) {
    if (shownIds.has(item.id)) continue;
    const date = resolveDate(item);
    if (!date) continue;
    if (
      date.getFullYear() === currentYear &&
      date.getMonth() === currentMonth
    ) {
      thisMonth.push(item);
      shownIds.add(item.id);
    }
  }

  // 4. Archive — everything else
  const archive = sorted.filter((item) => !shownIds.has(item.id));

  return { urgent, thisWeek, thisMonth, archive };
}

/**
 * Group archive items by "YYYY-MM" key.
 * Undated items are keyed under "nodate".
 */
export function groupArchiveByMonth(
  items: CalendarItem[],
): Map<string, CalendarItem[]> {
  const groups = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const dateISO = getItemDateISO(item);
    const key = dateISO ? dateISO.slice(0, 7) : "nodate";
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}
