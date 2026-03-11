/**
 * Worker job: scheduleIgPost
 *
 * Runs on every tick. Picks the highest-score queued item and schedules it
 * for the next available posting slot.
 *
 * Rules:
 * - Max 5 feed posts/day (up to 7 if score >= 90 urgent content)
 * - Quiet hours: 23:00–07:00 Haiti time (America/Port-au-Prince)
 * - Preferred slots spread across the day for best engagement
 * - Daily staples (taux, histoire, utility) get priority morning slots
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

// ── Daily staples: types that should post every day, early ──────────────────
// Order matters — first match gets the earliest available slot.
const DAILY_STAPLES: IGPostType[] = ["taux", "histoire", "utility"];

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

function getNextSlot(): Date {
  const now = new Date();
  const haitiNow = toHaitiDate(now);
  const haitiHour = haitiNow.getHours();
  const haitiMinute = haitiNow.getMinutes();
  const offsetHours = getHaitiOffsetHours(now);

  // 7 slots spread across the day (Haiti local time) for 3-7 posts
  const SLOTS = [
    { hour: 8, minute: 0 },    // Morning — early scrollers
    { hour: 10, minute: 30 },   // Mid-morning
    { hour: 12, minute: 30 },   // Lunch break
    { hour: 15, minute: 0 },    // Afternoon
    { hour: 17, minute: 30 },   // After school/work
    { hour: 19, minute: 0 },    // Evening prime time
    { hour: 21, minute: 0 },    // Late evening
  ];

  // haitiNow's year/month/date reflect Haiti calendar (system-TZ shifted)
  const haitiYear = haitiNow.getFullYear();
  const haitiMonth = haitiNow.getMonth(); // 0-indexed
  const haitiDay = haitiNow.getDate();

  // Find next available slot today or tomorrow
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
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

      // Convert Haiti local time → proper UTC using dynamic offset
      // Date.UTC handles day/month overflow automatically
      return new Date(
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
    }
  }

  // Fallback: tomorrow 08:00 Haiti
  return new Date(
    Date.UTC(haitiYear, haitiMonth, haitiDay + 1, 8 + offsetHours, 0, 0, 0),
  );
}

export async function scheduleIgPost(): Promise<ScheduleIgPostResult> {
  let expired = 0;

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

  // Check daily caps (Haiti-day-aware)
  const postedToday = await igQueueRepo.countPostedToday();
  const scheduledToday = await igQueueRepo.countScheduledToday();
  const totalToday = postedToday + scheduledToday;

  // Get a broader pool of queued items so we can enforce type diversity
  const queued = await igQueueRepo.listQueuedByScore(30);

  // ── Expire stale items ───────────────────────────────────────────────
  const fresh = [];
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
  if (expired > 0) {
    console.log(`[scheduleIgPost] expired ${expired} stale queued item(s)`);
  }

  if (fresh.length === 0) {
    return { scheduled: 0, skipped: "no-queued-items", expired };
  }

  // ── What's already posted/scheduled today ────────────────────────────
  const todayStatuses = await igQueueRepo.listPostedAndScheduledToday();
  const todayTypeCounts = new Map<string, number>();
  for (const s of todayStatuses) {
    todayTypeCounts.set(s.igType, (todayTypeCounts.get(s.igType) ?? 0) + 1);
  }

  let topItem: typeof fresh[0] | undefined;

  // ── Daily staples: guarantee taux, histoire, utility post daily ──────
  // If a staple type hasn't been posted/scheduled today and there's one in
  // the queue, pick it — regardless of score.
  for (const stapleType of DAILY_STAPLES) {
    if ((todayTypeCounts.get(stapleType) ?? 0) > 0) continue; // already covered
    const candidate = fresh.find((q) => q.igType === stapleType);
    if (candidate) {
      topItem = candidate;
      console.log(`[scheduleIgPost] daily-staple: picking ${stapleType} item ${candidate.id} (score=${candidate.score})`);
      break;
    }
  }

  // ── Type diversity: ensure news gets represented ─────────────────────
  if (!topItem) {
    const hasNewsToday = (todayTypeCounts.get("news") ?? 0) > 0;
    const nonNewsToday = todayStatuses.filter((i) => i.igType !== "news").length;
    const needsNewsDiversity = !hasNewsToday && (nonNewsToday >= 2 || totalToday >= 2);

    if (needsNewsDiversity) {
      const topNewsItem = fresh.find((q) => q.igType === "news");
      if (topNewsItem) {
        topItem = topNewsItem;
        console.log(`[scheduleIgPost] type-diversity: picking news item ${topItem.id} (score=${topItem.score}) — no news posted today`);
      }
    }
  }

  // ── Per-type cap enforcement ─────────────────────────────────────────
  // Use highest-score item that hasn't hit its type's daily cap.
  if (!topItem) {
    for (const candidate of fresh) {
      const cap = TYPE_DAILY_CAPS[candidate.igType];
      if (cap != null && (todayTypeCounts.get(candidate.igType) ?? 0) >= cap) {
        continue; // this type already hit its daily cap
      }
      topItem = candidate;
      break;
    }
  }

  // Absolute fallback — pick the top-scoring item ignoring caps
  if (!topItem) {
    topItem = fresh[0]!;
    console.log(`[scheduleIgPost] fallback: all types at cap, using top-score item ${topItem.id} (type=${topItem.igType})`);
  }

  // Cap enforcement: 5 normal, 7 for urgent (score >= 90)
  const isUrgent = topItem.score >= 90;
  const maxToday = isUrgent ? 7 : 5;

  if (totalToday >= maxToday) {
    return { scheduled: 0, skipped: `daily-cap-reached (${totalToday}/${maxToday})`, expired };
  }

  // Check if there's already a scheduled post for the next slot
  const scheduled = await igQueueRepo.listScheduled(10);
  const nextSlot = getNextSlot();
  const nextSlotISO = nextSlot.toISOString();

  const hasConflict = scheduled.some((s) => {
    if (!s.scheduledFor) return false;
    const scheduledTime = new Date(s.scheduledFor).getTime();
    const slotTime = nextSlot.getTime();
    return Math.abs(scheduledTime - slotTime) < 1 * 60 * 60 * 1000;
  });

  if (hasConflict) {
    return { scheduled: 0, skipped: "slot-already-filled", expired };
  }

  // Schedule the post
  await igQueueRepo.setScheduled(topItem.id, nextSlotISO);
  console.log(`[scheduleIgPost] scheduled item ${topItem.id} (score=${topItem.score}, type=${topItem.igType}) for ${nextSlotISO}`);

  return { scheduled: 1, skipped: "", expired };
}
