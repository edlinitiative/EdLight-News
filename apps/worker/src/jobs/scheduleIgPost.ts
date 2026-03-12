/**
 * Worker job: scheduleIgPost
 *
 * Runs on every tick. Guarantees the 3 daily staple posts (taux, histoire,
 * utility/fait-du-jour) are scheduled FIRST, then fills up to 5 more
 * regular posts for a total of 8/day (10 if urgent score ≥ 90).
 *
 * In a single tick the scheduler will:
 *  1. Expire stale items (queued + overdue scheduled)
 *  2. Schedule ALL missing daily staples at once (up to 3)
 *  3. Schedule 1 additional regular post if under the daily cap
 *
 * Rules:
 * - 3 daily staples guaranteed: taux, histoire, utility (fait-du-jour)
 * - Up to 5 additional regular posts (8 total / 10 for urgent ≥ 90)
 * - Quiet hours: 23:00–07:00 Haiti time (America/Port-au-Prince)
 * - 9 slots spread across the day for best engagement
 * - Per-type caps prevent any single type from dominating the feed
 */

import { igQueueRepo } from "@edlight-news/firebase";
import type { IGPostType } from "@edlight-news/types";

// Haiti timezone
const HAITI_TZ = "America/Port-au-Prince";

// ── Staleness TTLs per IG post type (hours) ─────────────────────────────────
// News goes stale fast; scholarships with deadlines stay relevant longer.
const STALENESS_TTL_HOURS: Record<IGPostType, number> = {
  news: 48,          // 2 days — breaking/current events
  taux: 24,          // 1 day  — exchange rates are daily
  utility: 72,       // 3 days — fait-du-jour, study tips
  histoire: 168,     // 7 days — historical content is evergreen-ish
  opportunity: 336,  // 14 days — jobs/programs (capped by deadline)
  scholarship: 336,  // 14 days — scholarships (capped by deadline)
};

// ── Per-type daily caps ─────────────────────────────────────────────────────
// Prevent any single type from dominating the feed. undefined = no cap.
const TYPE_DAILY_CAPS: Partial<Record<IGPostType, number>> = {
  scholarship: 2,
  opportunity: 2,
  taux: 1,
};

// ── Daily staples: types that MUST post every day ───────────────────────────
// These are scheduled in bulk before any regular items.
// Order matters — first gets the earliest morning slot.
const DAILY_STAPLES: IGPostType[] = ["taux", "histoire", "utility"];

// ── Daily cap: 3 staples + 5 regular = 8 (10 for urgent) ───────────────────
const DAILY_CAP_NORMAL = 8;
const DAILY_CAP_URGENT = 10; // for items with score >= 90

export interface ScheduleIgPostResult {
  scheduled: number;
  skipped: string;
  expired: number;
}

/** Check if an IG queue item is too old to post. */
function isStale(item: { igType: IGPostType; createdAt: any }): boolean {
  const ttlHours = STALENESS_TTL_HOURS[item.igType] ?? 72;
  const createdMs =
    item.createdAt && typeof item.createdAt === "object" && "seconds" in item.createdAt
      ? (item.createdAt as { seconds: number }).seconds * 1000
      : item.createdAt instanceof Date
        ? item.createdAt.getTime()
        : 0;
  if (createdMs === 0) return false; // can't determine age — don't expire
  return Date.now() - createdMs > ttlHours * 60 * 60 * 1000;
}

function toHaitiDate(date: Date): Date {
  // Convert UTC date to Haiti local time representation
  const haitiStr = date.toLocaleString("en-US", { timeZone: HAITI_TZ });
  return new Date(haitiStr);
}

function isQuietHour(date: Date): boolean {
  const haitiDate = toHaitiDate(date);
  const hour = haitiDate.getHours();
  return hour >= 23 || hour < 7;
}

/**
 * Compute the current UTC offset for Haiti dynamically.
 * Haiti observes US Eastern time rules (EST = UTC-5, EDT = UTC-4).
 * Returns the offset in hours (positive = behind UTC, e.g. 4 for EDT, 5 for EST).
 */
function getHaitiOffsetHours(date: Date = new Date()): number {
  const haitiStr = date.toLocaleString("en-US", { timeZone: HAITI_TZ });
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const diffMs = new Date(utcStr).getTime() - new Date(haitiStr).getTime();
  return Math.round(diffMs / (60 * 60 * 1000));
}

// 9 slots spread across the day (Haiti local time) — enough for 3 staples + 5 regular + 1 buffer
const SLOTS = [
  { hour: 8, minute: 0 },    // Morning — early scrollers (staple slot)
  { hour: 9, minute: 30 },    // Mid-morning (staple slot)
  { hour: 10, minute: 30 },   // Late morning (staple slot)
  { hour: 12, minute: 30 },   // Lunch break
  { hour: 14, minute: 30 },   // Early afternoon
  { hour: 16, minute: 0 },    // After school
  { hour: 17, minute: 30 },   // After work
  { hour: 19, minute: 0 },    // Evening prime time
  { hour: 21, minute: 0 },    // Late evening
];

/**
 * Return the next available slot that isn't already taken.
 * `takenSlotISOs` contains ISO strings of slots already allocated this tick
 * (or by previously scheduled items).
 * When `todayOnly` is true the search is limited to today's remaining slots
 * (used for daily staples so they never spill into tomorrow).
 */
function getNextAvailableSlot(takenSlotISOs: Set<string>, todayOnly = false): Date | null {
  const now = new Date();
  const haitiNow = toHaitiDate(now);
  const haitiHour = haitiNow.getHours();
  const haitiMinute = haitiNow.getMinutes();
  const offsetHours = getHaitiOffsetHours(now);

  const haitiYear = haitiNow.getFullYear();
  const haitiMonth = haitiNow.getMonth();
  const haitiDay = haitiNow.getDate();

  const maxDayOffset = todayOnly ? 0 : 1;

  for (let dayOffset = 0; dayOffset <= maxDayOffset; dayOffset++) {
    for (const slot of SLOTS) {
      // If today, must be in the future
      if (dayOffset === 0) {
        if (
          haitiHour > slot.hour ||
          (haitiHour === slot.hour && haitiMinute >= slot.minute)
        ) {
          continue;
        }
      }

      const slotDate = new Date(
        Date.UTC(
          haitiYear,
          haitiMonth,
          haitiDay + dayOffset,
          slot.hour + offsetHours,
          slot.minute,
          0,
          0,
        ),
      );
      const iso = slotDate.toISOString();

      // Skip if this slot is already taken
      if (takenSlotISOs.has(iso)) continue;

      // Also skip if within 30 min of any taken slot (safety margin)
      let conflict = false;
      for (const taken of takenSlotISOs) {
        if (Math.abs(new Date(taken).getTime() - slotDate.getTime()) < 30 * 60 * 1000) {
          conflict = true;
          break;
        }
      }
      if (conflict) continue;

      return slotDate;
    }
  }

  return null; // all slots taken
}

/** Return today's date in Haiti timezone as YYYY-MM-DD. */
function getHaitiTodayISO(): string {
  return toHaitiDate(new Date()).toISOString().slice(0, 10);
}

export async function scheduleIgPost(): Promise<ScheduleIgPostResult> {
  let expired = 0;
  let totalScheduled = 0;

  // Check quiet hours
  if (isQuietHour(new Date())) {
    return { scheduled: 0, skipped: "quiet-hours", expired: 0 };
  }

  // ── Expire stale SCHEDULED items ────────────────────────────────────
  const allScheduled = await igQueueRepo.listAllScheduled(50);
  const now = new Date();
  for (const item of allScheduled) {
    if (isStale(item)) {
      await igQueueRepo.updateStatus(item.id, "expired", {
        reasons: [...(item.reasons ?? []), `Expired scheduled: exceeded ${STALENESS_TTL_HOURS[item.igType]}h TTL for ${item.igType}`],
      });
      expired++;
      continue;
    }
    if (item.scheduledFor) {
      const scheduledTime = new Date(item.scheduledFor).getTime();
      const overduMs = now.getTime() - scheduledTime;
      if (overduMs > 2 * 60 * 60 * 1000) {
        await igQueueRepo.updateStatus(item.id, "expired", {
          reasons: [...(item.reasons ?? []), `Expired: scheduled slot missed by ${Math.round(overduMs / 3600000)}h (scheduledFor=${item.scheduledFor})`],
        });
        expired++;
      }
    }
  }
  if (expired > 0) {
    console.log(`[scheduleIgPost] expired ${expired} stale/overdue scheduled item(s)`);
  }

  // ── Gather today's state ─────────────────────────────────────────────
  const postedToday = await igQueueRepo.countPostedToday();
  const scheduledToday = await igQueueRepo.countScheduledToday();
  let totalToday = postedToday + scheduledToday;

  // Get a broader pool of queued items so we can enforce type diversity
  const queued = await igQueueRepo.listQueuedByScore(30);

  // ── Expire stale queued items ────────────────────────────────────────
  const fresh: typeof queued = [];
  for (const item of queued) {
    if (isStale(item)) {
      await igQueueRepo.updateStatus(item.id, "expired", {
        reasons: [...item.reasons, `Expired: exceeded ${STALENESS_TTL_HOURS[item.igType]}h TTL for ${item.igType}`],
      });
      expired++;
    } else {
      fresh.push(item);
    }
  }

  if (fresh.length === 0) {
    return { scheduled: 0, skipped: "no-queued-items", expired };
  }

  // ── Build set of already-taken slot times ────────────────────────────
  const scheduledItems = await igQueueRepo.listScheduled(20);
  const takenSlots = new Set<string>();
  for (const s of scheduledItems) {
    if (s.scheduledFor) takenSlots.add(new Date(s.scheduledFor).toISOString());
  }

  // ── What's already posted/scheduled today by type ────────────────────
  const todayStatuses = await igQueueRepo.listPostedAndScheduledToday();
  const todayTypeCounts = new Map<string, number>();
  for (const s of todayStatuses) {
    todayTypeCounts.set(s.igType, (todayTypeCounts.get(s.igType) ?? 0) + 1);
  }

  // Track items scheduled this tick so we don't double-pick from fresh[]
  const scheduledThisTick = new Set<string>();

  // Today's Haiti date for date-aware staple checks
  const haitiToday = getHaitiTodayISO();

  // ════════════════════════════════════════════════════════════════════
  // PHASE 1 — Schedule ALL missing daily staples in one pass
  // ════════════════════════════════════════════════════════════════════
  for (const stapleType of DAILY_STAPLES) {
    // Date-aware check: for types that carry a targetPostDate (e.g. histoire),
    // only consider an item as "already covered" if its targetPostDate matches
    // today. This prevents yesterday's spilled histoire from blocking today's.
    const alreadyCovered = todayStatuses.some(
      (s) =>
        s.igType === stapleType &&
        // If the scheduled item has a targetPostDate, it must match today;
        // otherwise fall back to the old "any item of this type" logic.
        (!s.targetPostDate || s.targetPostDate === haitiToday),
    );
    if (alreadyCovered) continue;

    const candidate = fresh.find(
      (q) => q.igType === stapleType && !scheduledThisTick.has(q.id),
    );
    if (!candidate) continue; // no item of this type in queue

    // Staples always count — even if we're over the normal cap
    // (they're guaranteed daily content).
    // todayOnly=true → staples never spill into tomorrow's slots.
    const slot = getNextAvailableSlot(takenSlots, /* todayOnly */ true);
    if (!slot) {
      console.log(`[scheduleIgPost] no today-slot available for staple ${stapleType} — will retry next tick`);
      continue;
    }

    const slotISO = slot.toISOString();
    await igQueueRepo.setScheduled(candidate.id, slotISO);
    takenSlots.add(slotISO);
    scheduledThisTick.add(candidate.id);
    todayTypeCounts.set(stapleType, (todayTypeCounts.get(stapleType) ?? 0) + 1);
    totalToday++;
    totalScheduled++;
    console.log(
      `[scheduleIgPost] daily-staple: scheduled ${stapleType} item ${candidate.id} (score=${candidate.score}) → ${slotISO}`,
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // PHASE 2 — Schedule 1 regular item (if under daily cap)
  // ════════════════════════════════════════════════════════════════════

  // Determine effective cap — urgent content (score ≥ 90) gets higher cap
  const topFreshScore = fresh.find((f) => !scheduledThisTick.has(f.id))?.score ?? 0;
  const maxToday = topFreshScore >= 90 ? DAILY_CAP_URGENT : DAILY_CAP_NORMAL;

  if (totalToday >= maxToday) {
    if (totalScheduled > 0) {
      console.log(`[scheduleIgPost] daily cap reached after staples (${totalToday}/${maxToday})`);
      return { scheduled: totalScheduled, skipped: "", expired };
    }
    return { scheduled: 0, skipped: `daily-cap-reached (${totalToday}/${maxToday})`, expired };
  }

  let regularItem: typeof fresh[0] | undefined;

  // ── Type diversity: ensure news gets represented ─────────────────────
  const hasNewsToday = (todayTypeCounts.get("news") ?? 0) > 0;
  const nonNewsToday = todayStatuses.filter((i) => i.igType !== "news").length;
  const needsNewsDiversity = !hasNewsToday && (nonNewsToday >= 2 || totalToday >= 2);

  if (needsNewsDiversity) {
    regularItem = fresh.find(
      (q) => q.igType === "news" && !scheduledThisTick.has(q.id),
    );
    if (regularItem) {
      console.log(
        `[scheduleIgPost] type-diversity: picking news item ${regularItem.id} (score=${regularItem.score})`,
      );
    }
  }

  // ── Per-type cap enforcement ─────────────────────────────────────────
  if (!regularItem) {
    for (const candidate of fresh) {
      if (scheduledThisTick.has(candidate.id)) continue;
      const cap = TYPE_DAILY_CAPS[candidate.igType];
      if (cap != null && (todayTypeCounts.get(candidate.igType) ?? 0) >= cap) {
        continue;
      }
      regularItem = candidate;
      break;
    }
  }

  // Absolute fallback — pick the top-scoring item ignoring caps
  if (!regularItem) {
    regularItem = fresh.find((f) => !scheduledThisTick.has(f.id));
    if (regularItem) {
      console.log(
        `[scheduleIgPost] fallback: all types at cap, using top-score item ${regularItem.id} (type=${regularItem.igType})`,
      );
    }
  }

  if (regularItem) {
    const slot = getNextAvailableSlot(takenSlots);
    if (slot) {
      const slotISO = slot.toISOString();
      await igQueueRepo.setScheduled(regularItem.id, slotISO);
      takenSlots.add(slotISO);
      totalScheduled++;
      console.log(
        `[scheduleIgPost] regular: scheduled ${regularItem.igType} item ${regularItem.id} (score=${regularItem.score}) → ${slotISO}`,
      );
    } else {
      console.log(`[scheduleIgPost] no slot available for regular item`);
    }
  }

  return {
    scheduled: totalScheduled,
    skipped: totalScheduled > 0 ? "" : "no-available-slots",
    expired,
  };
}
