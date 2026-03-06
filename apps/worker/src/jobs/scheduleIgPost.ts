/**
 * Worker job: scheduleIgPost
 *
 * Runs on every tick. Picks the highest-score queued item and schedules it
 * for the next available posting slot.
 *
 * Rules:
 * - Max 5 feed posts/day (up to 7 if score >= 90 urgent content)
 * - Quiet hours: 23:00–07:00 Haiti time (UTC-5 / America/Port-au-Prince)
 * - Preferred slots spread across the day for best engagement
 */

import { igQueueRepo } from "@edlight-news/firebase";

// Haiti timezone
const HAITI_TZ = "America/Port-au-Prince";

export interface ScheduleIgPostResult {
  scheduled: number;
  skipped: string;
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

// Haiti is UTC−5 year-round (no DST since 2016).
const HAITI_OFFSET_HOURS = 5;

function getNextSlot(): Date {
  const now = new Date();
  const haitiNow = toHaitiDate(now);
  const haitiHour = haitiNow.getHours();
  const haitiMinute = haitiNow.getMinutes();

  // 7 slots spread across the day (Haiti local time) for 3-7 posts
  const slots = [
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
    for (const slot of slots) {
      // If today, must be in the future
      if (dayOffset === 0) {
        if (
          haitiHour > slot.hour ||
          (haitiHour === slot.hour && haitiMinute >= slot.minute)
        ) {
          continue;
        }
      }

      // Convert Haiti local time → proper UTC
      // Date.UTC handles day/month overflow automatically
      return new Date(
        Date.UTC(
          haitiYear,
          haitiMonth,
          haitiDay + dayOffset,
          slot.hour + HAITI_OFFSET_HOURS,
          slot.minute,
          0,
          0,
        ),
      );
    }
  }

  // Fallback: tomorrow 08:00 Haiti = 13:00 UTC
  return new Date(
    Date.UTC(haitiYear, haitiMonth, haitiDay + 1, 8 + HAITI_OFFSET_HOURS, 0, 0, 0),
  );
}

export async function scheduleIgPost(): Promise<ScheduleIgPostResult> {
  // Check quiet hours
  if (isQuietHour(new Date())) {
    return { scheduled: 0, skipped: "quiet-hours" };
  }

  // Check daily caps
  const postedToday = await igQueueRepo.countPostedToday();
  const scheduledToday = await igQueueRepo.countScheduledToday();
  const totalToday = postedToday + scheduledToday;

  // Get a broader pool of queued items so we can enforce type diversity
  const queued = await igQueueRepo.listQueuedByScore(30);
  if (queued.length === 0) {
    return { scheduled: 0, skipped: "no-queued-items" };
  }

  // ── Type diversity: ensure news gets represented ─────────────────────
  // Check what types have already been scheduled/posted today.
  // If no news has been scheduled today and there are news items in queue,
  // pick the top news item instead of the global top item.
  const todayStatuses = await igQueueRepo.listPostedAndScheduledToday();
  const todayTypes = new Set(todayStatuses.map((i) => i.igType));
  const hasNewsToday = todayTypes.has("news");

  let topItem = queued[0]!;

  // Every other post slot, prefer news if none today yet
  // Also: if 3+ non-news posts are scheduled and 0 news, force news
  const nonNewsToday = todayStatuses.filter((i) => i.igType !== "news").length;
  const needsNewsDiversity = !hasNewsToday && (nonNewsToday >= 2 || totalToday >= 2);

  if (needsNewsDiversity) {
    const topNewsItem = queued.find((q) => q.igType === "news");
    if (topNewsItem) {
      topItem = topNewsItem;
      console.log(`[scheduleIgPost] type-diversity: picking news item ${topItem.id} (score=${topItem.score}) — no news posted today`);
    }
  }

  // Cap enforcement: 5 normal, 7 for urgent (score >= 90)
  const isUrgent = topItem.score >= 90;
  const maxToday = isUrgent ? 7 : 5;

  if (totalToday >= maxToday) {
    return { scheduled: 0, skipped: `daily-cap-reached (${totalToday}/${maxToday})` };
  }

  // Check if there's already a scheduled post for the next slot
  const scheduled = await igQueueRepo.listScheduled(10);
  const nextSlot = getNextSlot();
  const nextSlotISO = nextSlot.toISOString();

  // If there's already a post scheduled within 1 hour of the next slot, skip
  const hasConflict = scheduled.some((s) => {
    if (!s.scheduledFor) return false;
    const scheduledTime = new Date(s.scheduledFor).getTime();
    const slotTime = nextSlot.getTime();
    return Math.abs(scheduledTime - slotTime) < 1 * 60 * 60 * 1000;
  });

  if (hasConflict) {
    return { scheduled: 0, skipped: "slot-already-filled" };
  }

  // Schedule the post
  await igQueueRepo.setScheduled(topItem.id, nextSlotISO);
  console.log(`[scheduleIgPost] scheduled item ${topItem.id} (score=${topItem.score}, type=${topItem.igType}) for ${nextSlotISO}`);

  return { scheduled: 1, skipped: "" };
}
